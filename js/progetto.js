/* --- PROGETTO SU DISCO: SALVATAGGIO AUTOMATICO, VERSIONI, ANNULLA E RIPETI, MENU PROGETTO --- */

import { appState, appSettings, pathStack, getCurrentLevel, activeNodeId, setActiveNodeId } from './state.js';
import { render } from './renderer.js';
import { renderUI } from './app.js';
import { initLibrary, loadLibraryFromPath } from './builder.js';
import { leggiFileJson, downloadJsonFile } from './storage.js';
import { escapeHtml, slugifyId } from './utils.js';
import { ricaricaLibreria, sovrascriviLibreria, aggiornaPulsantiLibreria } from './libreria.js';
import {
    problemaCliente, completaCliente, controllaClienteAllApertura, aggiornaPulsantiCliente,
    importClienteAperto, impostaSelezioneCliente, dettaglioClienteAperto
} from './cliente.js';
import { segnaSchedaCoerenzaDaAggiornare } from './coerenza.js';
import { azzeraSceltaGerarchia } from './gerarchia.js';

// 2 da quando il progetto può avere la chiave cliente (spec 0003): si leggono 1 e 2, si scrive sempre 2
const FORMAT_VERSION = 2;
const LUNGHEZZA_MAX_SLUG = 80;
const NOMI_RISERVATI = new Set(['con', 'prn', 'aux', 'nul',
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(i => [`com${i}`, `lpt${i}`])]);
// Attese tra un tentativo di salvataggio fallito e il successivo; l'ultima si ripete
const RITARDI_RITENTATIVO = [2000, 4000, 8000, 16000, 30000];
// Il browser rifiuta una richiesta keepalive oltre circa 64 KB
const LIMITE_KEEPALIVE = 60000;

const MSG_NOME_NON_VALIDO = "Il nome deve contenere almeno una lettera o cifra e non può essere un nome riservato di Windows";

const ETICHETTE_STATO = {
    salvato: 'Salvato',
    attesa: 'Modifiche in attesa',
    salvataggio: 'Salvataggio…',
    errore: 'Errore di salvataggio',
    conflitto: 'Conflitto'
};

// Progetto aperto: slug = nome del file in progetti/, impronta = SHA1 del file letto o scritto
const progetto = { slug: null, nome: '', libraryPath: '', impronta: null, versioni: 0 };

let stato = 'salvato';
let ultimoTestoSalvato = null;
let motivoErrore = '';          // non vuoto finché un salvataggio fallisce: banner rosso e ritentativi
let timerSalvataggio = null;
let timerRitentativo = null;
let tentativiFalliti = 0;
let mousePremuto = false;
let salvataggioInVolo = null;
let pilaRipeti = [];
let prossimoDaRipeti = false;   // il prossimo salvataggio viene da Ripeti e non svuota la pila
let operazioneInCorso = false;
let libreriaCaricata = null;    // percorso dell'ultima libreria caricata con successo
let avvisoLibreria = '';
let avvisoServer = '';
let avvisoCliente = '';          // id cliente uguali a id della libreria, trovati all'apertura
// Stati della libreria su disco mostrati nel banner, impostati da js/libreria.js
const statoLibreriaBanner = { conflitto: false, avviso: '' };

/* --- TESTO DEL PROGETTO E CHIAMATE AL SERVER --- */

// Workspace e requisiti cliente insieme: ogni cambiamento dei due fa partire il salvataggio
function testoProgetto() {
    const contenuto = {
        formatVersion: FORMAT_VERSION,
        nome: progetto.nome,
        libraryPath: progetto.libraryPath,
        workspace: pathStack[0].graph
    };
    if (appState.cliente) contenuto.cliente = appState.cliente;
    return JSON.stringify(contenuto);
}

// Un progetto è aperto (e si salva su disco)
export function progettoAperto() {
    return !!progetto.slug;
}

function urlProgetto(slug, suffisso = '') {
    return `/api/progetti/${encodeURIComponent(slug)}${suffisso}`;
}

// Risponde sempre con { ok, stato, dati } oppure { ok: false, errore, messaggio }, mai con un'eccezione
export async function chiamaApi(metodo, percorso, corpo) {
    const opzioni = { method: metodo, headers: { 'Content-Type': 'application/json' } };
    if (corpo !== undefined) opzioni.body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
    let risposta;
    try {
        risposta = await fetch(percorso, opzioni);
    } catch {
        return { ok: false, stato: 0, errore: 'rete', messaggio: 'Server non raggiungibile' };
    }
    let dati = null;
    if (risposta.status !== 204) {
        try { dati = await risposta.json(); } catch { dati = null; }
    }
    if (risposta.ok) return { ok: true, stato: risposta.status, dati };
    return {
        ok: false,
        stato: risposta.status,
        errore: dati?.errore || `http_${risposta.status}`,
        messaggio: dati?.messaggio || `Errore del server (HTTP ${risposta.status})`,
        dati
    };
}

function slugDaNome(nome) {
    const slug = slugifyId(nome).slice(0, LUNGHEZZA_MAX_SLUG).replace(/_+$/, '');
    return NOMI_RISERVATI.has(slug) ? '' : slug;
}

/* --- COMPLETAMENTO E SOSTITUZIONE DEL MODELLO --- */

// Aggiunge a ogni livello i campi che render() ed enterNode scriverebbero, così la sola vista non genera salvataggi
export function completaModello(graph) {
    if (!Array.isArray(graph.nodes)) graph.nodes = [];
    if (!Array.isArray(graph.edges)) graph.edges = [];
    if (!graph.parentReqPositions) graph.parentReqPositions = {};
    graph.edges.forEach(edge => {
        if (!edge.waypoints) edge.waypoints = [];
    });
    graph.nodes.forEach(node => {
        if (!node.pinPositions) node.pinPositions = {};
        if (!node.internal_graph) node.internal_graph = { nodes: [], edges: [] };
        completaModello(node.internal_graph);
    });
    return graph;
}

function svuotaIspettore() {
    const propsContent = document.getElementById('propsContent');
    if (propsContent) propsContent.innerHTML = `<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>`;
}

// Ricostruisce pathStack dalla radice seguendo gli id dei nodi; false se un id non c'è (restano aperti i livelli trovati)
export function apriPercorso(ids) {
    pathStack.length = 1;
    for (const id of ids) {
        const nodo = getCurrentLevel().graph.nodes.find(n => n.id === id);
        if (!nodo) return false;
        if (!nodo.internal_graph) nodo.internal_graph = { nodes: [], edges: [] };
        pathStack.push({ id: nodo.id, label: nodo.label || nodo.id, graph: nodo.internal_graph, parentNode: nodo });
    }
    return true;
}

// Sostituisce workspace e requisiti cliente, sempre insieme; con mantieniLivello riapre gli stessi blocchi seguendo i loro id
function sostituisciModello(workspace, cliente, mantieniLivello) {
    const idAperti = mantieniLivello ? pathStack.slice(1).map(livello => livello.id) : [];
    completaModello(workspace);
    appState.workspace = workspace;
    appState.cliente = completaCliente(cliente ?? null);
    pathStack.length = 0;
    pathStack.push({ id: 'root', label: progetto.nome, graph: workspace, parentNode: null });
    apriPercorso(idAperti);
    const selezionePersa = activeNodeId && !getCurrentLevel().graph.nodes.some(n => n.id === activeNodeId);
    if (!mantieniLivello || selezionePersa) {
        setActiveNodeId(null);
        svuotaIspettore();
    }
    // Un altro progetto: la scelta della Gerarchia si toglie; con Annulla, Ripeti e Ricarica resta (spec 0005)
    if (!mantieniLivello) azzeraSceltaGerarchia();
    // Il dettaglio di un requisito cliente mostrerebbe valori di un altro momento
    if (dettaglioClienteAperto()) {
        impostaSelezioneCliente(null);
        svuotaIspettore();
    }
}

// Rende attivo un progetto appena letto o scritto; la libreria va caricata prima
function impostaProgetto(slug, nome, libraryPath, workspace, cliente, impronta, versioni, mantieniLivello) {
    annullaTimer();
    fermaRitentativi();
    Object.assign(progetto, { slug, nome, libraryPath, impronta, versioni });
    sostituisciModello(workspace, cliente, mantieniLivello);
    const libPathInput = document.getElementById('libPathInput');
    if (libPathInput) libPathInput.value = libraryPath;
    renderUI();
    render();
    annullaTimer();
    ultimoTestoSalvato = testoProgetto();
    prossimoDaRipeti = false;
    motivoErrore = '';
    impostaStato('salvato');
}

// Primo problema che impedisce di aprire il contenuto di un file progetto, oppure null
function problemaFileProgetto(dati, slug) {
    if (!dati || typeof dati !== 'object' || Array.isArray(dati)) {
        return `Il file del progetto "${slug}" non contiene un progetto valido.`;
    }
    if (dati.formatVersion !== undefined && !(Number.isInteger(dati.formatVersion) && dati.formatVersion <= FORMAT_VERSION)) {
        return `Il progetto "${slug}" usa un formato più recente (${dati.formatVersion}) di quello che questa versione dell'app sa leggere: non viene aperto né sovrascritto.`;
    }
    const ws = dati.workspace;
    if (!ws || typeof ws !== 'object' || !Array.isArray(ws.nodes) || !Array.isArray(ws.edges)) {
        return `Il file del progetto "${slug}" non contiene un workspace valido (servono gli elenchi "nodes" ed "edges").`;
    }
    const cliente = problemaCliente(dati.cliente);
    if (cliente) return `Il file del progetto "${slug}" ha requisiti cliente non validi: ${cliente}.`;
    return null;
}

// Dopo l'apertura: fili cliente orfani, posizioni mancanti, collisioni con la libreria (spec 0003, AC-20)
function controllaCliente() {
    const { cambiato, avviso } = controllaClienteAllApertura();
    avvisoCliente = avviso;
    aggiornaBanner();
    // Le correzioni vanno su disco con il salvataggio automatico
    if (cambiato) render();
}

/* --- LIBRERIA DEL PROGETTO --- */

async function caricaLibreria(percorso) {
    const libPathInput = document.getElementById('libPathInput');
    if (libPathInput) libPathInput.value = percorso;
    // Solo per l'apertura dei progetti: il pulsante 🔄 ricarica sempre
    if (percorso === libreriaCaricata) return;
    const esito = await loadLibraryFromPath(percorso);
    if (esito.ok) {
        libreriaCaricata = percorso;
        avvisoLibreria = '';
    } else {
        avvisoLibreria = `Impossibile caricare la libreria "${percorso}" (${esito.messaggio}): resta in uso la libreria precedente. Il progetto continua a salvarsi.`;
        if (libreriaCaricata === null) initLibrary();
    }
    aggiornaInterfaccia();
}

// Il pulsante 🔄 ha caricato una nuova libreria: diventa la libreria del progetto
export function aggiornaPercorsoLibreria(percorso) {
    libreriaCaricata = percorso;
    avvisoLibreria = '';
    if (progetto.slug) progetto.libraryPath = percorso;
    aggiornaInterfaccia();
    render();
}

// Il Salva della libreria è bloccato finché il progetto è in conflitto
export function progettoInConflitto() {
    return stato === 'conflitto';
}

// Aggiorna solo i campi passati: { conflitto, avviso }
export function impostaStatoLibreriaBanner(nuovo) {
    Object.assign(statoLibreriaBanner, nuovo);
    aggiornaBanner();
}

/* --- SALVATAGGIO AUTOMATICO --- */

function annullaTimer() {
    clearTimeout(timerSalvataggio);
    timerSalvataggio = null;
}

function fermaRitentativi() {
    clearTimeout(timerRitentativo);
    timerRitentativo = null;
    tentativiFalliti = 0;
}

function pianificaRitentativo() {
    clearTimeout(timerRitentativo);
    const ritardo = RITARDI_RITENTATIVO[Math.min(tentativiFalliti, RITARDI_RITENTATIVO.length - 1)];
    tentativiFalliti++;
    timerRitentativo = setTimeout(() => salva(), ritardo);
}

// Chiamata da render(): riavvia l'attesa; il confronto del testo avviene solo allo scadere
export function pianificaSalvataggio() {
    if (!progetto.slug || stato === 'conflitto' || motivoErrore) return;
    annullaTimer();
    // Durante un trascinamento si aspetta il rilascio: un trascinamento è sempre un solo salvataggio
    if (mousePremuto) return;
    timerSalvataggio = setTimeout(() => salva(), appSettings.progetti.debounceMs);
}

// Scrive il progetto se il testo è cambiato; restituisce true se su disco c'è lo stato attuale
async function salva({ forza = false } = {}) {
    annullaTimer();
    while (salvataggioInVolo) {
        if (stato === 'salvataggio') impostaStato('attesa');
        await salvataggioInVolo;
    }
    annullaTimer();
    if (!progetto.slug) return true;
    if (stato === 'conflitto' && !forza) return false;

    const testo = testoProgetto();
    if (testo === ultimoTestoSalvato && !forza) {
        fermaRitentativi();
        motivoErrore = '';
        impostaStato('salvato');
        return true;
    }

    impostaStato('salvataggio');
    clearTimeout(timerRitentativo);
    const slug = progetto.slug;
    const daRipeti = prossimoDaRipeti;
    const corpo = `{"progetto":${testo},"improntaAttesa":${JSON.stringify(progetto.impronta)},"forza":${forza}}`;
    salvataggioInVolo = chiamaApi('PUT', urlProgetto(slug), corpo);
    let r;
    try {
        r = await salvataggioInVolo;
    } finally {
        salvataggioInVolo = null;
    }
    if (slug !== progetto.slug) return r.ok;

    if (r.ok) {
        ultimoTestoSalvato = testo;
        progetto.impronta = r.dati.impronta;
        progetto.versioni = r.dati.versioni;
        if (!daRipeti) pilaRipeti = [];
        prossimoDaRipeti = false;
        motivoErrore = '';
        fermaRitentativi();
        if (testoProgetto() !== ultimoTestoSalvato) {
            impostaStato('attesa');
            pianificaSalvataggio();
        } else {
            impostaStato('salvato');
        }
        return true;
    }
    if (r.errore === 'conflitto') {
        fermaRitentativi();
        motivoErrore = '';
        impostaStato('conflitto');
        return false;
    }
    motivoErrore = r.messaggio;
    impostaStato('errore');
    pianificaRitentativo();
    return false;
}

// Prima di cambiare progetto o versione (o dopo un import cliente): salva subito quanto in attesa, altrimenti blocca l'azione
export async function svuota() {
    if (stato === 'conflitto') {
        alert('Il file del progetto è cambiato sul disco: scegli prima "Ricarica dal disco" o "Sovrascrivi" nel banner.');
        return false;
    }
    if (motivoErrore) {
        alert(`Il salvataggio non riesce (${motivoErrore}). Risolvi prima il problema indicato nel banner rosso.`);
        return false;
    }
    if (await salva()) return true;
    if (stato !== 'conflitto') alert(`Salvataggio non riuscito: l'operazione è stata annullata.`);
    return false;
}

// Una sola operazione alla volta (Ctrl+Z ripetuti, clic doppi sul menu)
async function esegui(azione) {
    if (operazioneInCorso) return;
    operazioneInCorso = true;
    try {
        await azione();
    } finally {
        operazioneInCorso = false;
        aggiornaInterfaccia();
    }
}

/* --- APERTURA E CREAZIONE --- */

// Restituisce 'ok', 'non_trovato' o 'errore'; se non va a buon fine il progetto precedente resta aperto
async function apriProgetto(slug, { silenzioso404 = false } = {}) {
    const r = await chiamaApi('GET', urlProgetto(slug));
    if (!r.ok) {
        if (r.stato === 404 && silenzioso404) return 'non_trovato';
        if (r.errore === 'json_non_valido') {
            alert(`Il file del progetto "${slug}" non è JSON valido: non viene aperto né sovrascritto.`);
        } else {
            alert(`Impossibile aprire il progetto "${slug}": ${r.messaggio}`);
        }
        return r.stato === 404 ? 'non_trovato' : 'errore';
    }

    const dati = r.dati.progetto;
    const problema = problemaFileProgetto(dati, slug);
    if (problema) {
        alert(problema);
        return 'errore';
    }
    try {
        completaModello(dati.workspace);
    } catch (err) {
        alert(`Il file del progetto "${slug}" contiene un modello non valido: ${err.message}`);
        return 'errore';
    }

    const libraryPath = typeof dati.libraryPath === 'string' && dati.libraryPath
        ? dati.libraryPath
        : (progetto.libraryPath || appSettings.libraryPath);
    await caricaLibreria(libraryPath);

    const nome = typeof dati.nome === 'string' && dati.nome.trim() ? dati.nome : slug;
    impostaProgetto(slug, nome, libraryPath, dati.workspace, dati.cliente, r.dati.impronta, r.dati.versioni, false);
    controllaCliente();
    pilaRipeti = [];
    aggiornaInterfaccia();
    await chiamaApi('PUT', '/api/ultimo', { progetto: slug });
    return 'ok';
}

// Chiede un nome finché è valido e libero, poi crea il file; restituisce lo slug o null
async function chiediNomeECrea(domanda, proposta, costruisci) {
    let testo = proposta;
    for (;;) {
        const risposta = prompt(domanda, testo);
        if (risposta === null) return null;
        testo = risposta;
        const nome = risposta.trim();
        const slug = slugDaNome(nome);
        if (!nome || !slug) {
            alert(MSG_NOME_NON_VALIDO);
            continue;
        }
        const r = await chiamaApi('POST', '/api/progetti', { slug, progetto: costruisci(nome) });
        if (r.ok) return r.dati.slug;
        if (r.errore === 'esiste') {
            alert(`Esiste già un progetto con il nome "${slug}": scegline un altro.`);
            continue;
        }
        alert(`Impossibile creare il progetto: ${r.messaggio}`);
        return null;
    }
}

function progettoVuoto(nome) {
    return {
        formatVersion: FORMAT_VERSION,
        nome,
        libraryPath: progetto.libraryPath || appSettings.libraryPath,
        workspace: { nodes: [], edges: [] }
    };
}

// "Nuovo progetto" quando la cartella è vuota o l'ultimo progetto è stato eliminato
async function creaPrimoProgetto() {
    for (let n = 1; n < 1000; n++) {
        const slug = n === 1 ? 'nuovo_progetto' : `nuovo_progetto_${n}`;
        const r = await chiamaApi('POST', '/api/progetti', { slug, progetto: progettoVuoto('Nuovo progetto') });
        if (r.ok) return apriProgetto(slug);
        if (r.errore !== 'esiste') {
            alert(`Impossibile creare il progetto: ${r.messaggio}`);
            return 'errore';
        }
    }
    return 'errore';
}

async function leggiElenco() {
    const r = await chiamaApi('GET', '/api/progetti');
    if (!r.ok) {
        alert(`Impossibile leggere l'elenco dei progetti: ${r.messaggio}`);
        return null;
    }
    return r.dati.progetti;
}

// Dopo un'eliminazione: il progetto modificato più di recente, oppure uno nuovo
async function apriPiuRecenteOCreaNuovo() {
    const elenco = await leggiElenco();
    if (!elenco) return;
    if (elenco.length === 0) {
        await creaPrimoProgetto();
        return;
    }
    if (await apriProgetto(elenco[0].slug) !== 'ok') await mostraElenco();
}

/* --- ANNULLA, RIPETI, CONFLITTI --- */

async function annulla() {
    if (!progetto.slug || stato === 'conflitto' || progetto.versioni <= 0) return;
    if (!await svuota()) return;
    const testoAttuale = ultimoTestoSalvato;
    const r = await chiamaApi('POST', urlProgetto(progetto.slug, '/annulla'), { improntaAttesa: progetto.impronta });
    if (!r.ok) {
        if (r.errore === 'conflitto') impostaStato('conflitto');
        else if (r.errore === 'nessuna_versione') progetto.versioni = 0;
        else alert(`Annulla non riuscito: ${r.messaggio}`);
        return;
    }
    pilaRipeti.push(testoAttuale);
    while (pilaRipeti.length > appSettings.progetti.versioni) pilaRipeti.shift();
    impostaProgetto(progetto.slug, progetto.nome, progetto.libraryPath, r.dati.progetto.workspace,
        r.dati.progetto.cliente, r.dati.impronta, r.dati.versioni, true);
}

async function ripeti() {
    if (!progetto.slug || stato === 'conflitto' || pilaRipeti.length === 0) return;
    if (!await svuota()) return;
    const dati = JSON.parse(pilaRipeti.pop());
    sostituisciModello(dati.workspace, dati.cliente, true);
    renderUI();
    render();
    prossimoDaRipeti = true;
    await salva();
}

async function ricaricaDalDisco() {
    const r = await chiamaApi('GET', urlProgetto(progetto.slug));
    if (!r.ok) {
        alert(`Impossibile rileggere il progetto: ${r.messaggio}`);
        return;
    }
    const dati = r.dati.progetto;
    const problema = problemaFileProgetto(dati, progetto.slug);
    if (problema) {
        alert(problema);
        return;
    }
    const libraryPath = typeof dati.libraryPath === 'string' && dati.libraryPath ? dati.libraryPath : progetto.libraryPath;
    await caricaLibreria(libraryPath);
    const nome = typeof dati.nome === 'string' && dati.nome.trim() ? dati.nome : progetto.slug;
    impostaProgetto(progetto.slug, nome, libraryPath, dati.workspace, dati.cliente, r.dati.impronta, r.dati.versioni, true);
    controllaCliente();
    pilaRipeti = [];
}

async function sovrascrivi() {
    await salva({ forza: true });
}

async function riprova() {
    clearTimeout(timerRitentativo);
    await salva();
}

/* --- MENU PROGETTO --- */

async function nuovo() {
    if (!await svuota()) return;
    const slug = await chiediNomeECrea('Nome del nuovo progetto:', '', progettoVuoto);
    if (slug) await apriProgetto(slug);
}

async function salvaCopia() {
    if (!await svuota()) return;
    const contenuto = JSON.parse(testoProgetto());
    const slug = await chiediNomeECrea('Nome della copia:', `Copia di ${progetto.nome}`, nome => ({ ...contenuto, nome }));
    if (slug) await apriProgetto(slug);
}

async function rinomina() {
    if (!await svuota()) return;
    let testo = progetto.nome;
    for (;;) {
        const risposta = prompt('Nuovo nome del progetto:', testo);
        if (risposta === null) return;
        testo = risposta;
        const nome = risposta.trim();
        const slug = slugDaNome(nome);
        if (!nome || !slug) {
            alert(MSG_NOME_NON_VALIDO);
            continue;
        }
        if (nome === progetto.nome) return;
        const r = await chiamaApi('POST', urlProgetto(progetto.slug, '/rinomina'),
            { nuovoSlug: slug, nome, improntaAttesa: progetto.impronta });
        if (r.ok) {
            Object.assign(progetto, { slug: r.dati.slug, nome, impronta: r.dati.impronta, versioni: r.dati.versioni });
            pathStack[0].label = nome;
            ultimoTestoSalvato = testoProgetto();
            pilaRipeti = [];
            renderUI();
            // Il percorso delle voci della scheda Coerenza parte dal nome del progetto (spec 0004)
            segnaSchedaCoerenzaDaAggiornare();
            return;
        }
        if (r.errore === 'esiste') {
            alert(`Esiste già un progetto con il nome "${slug}": scegline un altro.`);
            continue;
        }
        if (r.errore === 'conflitto') {
            impostaStato('conflitto');
            return;
        }
        alert(`Rinomina non riuscita: ${r.messaggio}`);
        return;
    }
}

async function elimina() {
    if (!confirm(`Eliminare il progetto "${progetto.nome}"? Il file viene spostato in progetti/_cestino/.`)) return;
    if (!await svuota()) return;
    const r = await chiamaApi('DELETE', urlProgetto(progetto.slug));
    if (!r.ok) {
        alert(`Eliminazione non riuscita: ${r.messaggio}`);
        return;
    }
    // Il progetto non esiste più: niente salvataggi finché non se ne apre un altro
    annullaTimer();
    progetto.slug = null;
    pilaRipeti = [];
    aggiornaInterfaccia();
    await apriPiuRecenteOCreaNuovo();
}

// type di ogni nodo, a ogni livello, che la libreria caricata non conosce
function tipiMancanti(graph, trovati = new Set()) {
    graph.nodes.forEach(node => {
        if (!appState.library[node.type]) trovati.add(node.type);
        if (node.internal_graph) tipiMancanti(node.internal_graph, trovati);
    });
    return [...trovati];
}

async function importaDati(dati, file) {
    if (!dati || typeof dati !== 'object' || Array.isArray(dati)) {
        alert(`"${file.name}" non contiene un modello valido.`);
        return;
    }
    if (dati.formatVersion !== undefined && !(Number.isInteger(dati.formatVersion) && dati.formatVersion <= FORMAT_VERSION)) {
        alert(`"${file.name}" usa un formato più recente (${dati.formatVersion}) di quello che questa versione dell'app sa leggere.`);
        return;
    }
    // modello.json e file progetto hanno { workspace }; si accetta anche un grafo con nodes ed edges alla radice
    const workspace = dati.workspace && typeof dati.workspace === 'object' ? dati.workspace : dati;
    if (!Array.isArray(workspace.nodes) || !Array.isArray(workspace.edges)) {
        alert(`"${file.name}" non contiene un modello valido: servono gli elenchi "nodes" ed "edges".`);
        return;
    }
    const problema = problemaCliente(dati.cliente);
    if (problema) {
        alert(`"${file.name}" ha requisiti cliente non validi: ${problema}.`);
        return;
    }
    try {
        completaModello(workspace);
    } catch (err) {
        alert(`"${file.name}" contiene un modello non valido: ${err.message}`);
        return;
    }
    if (dati.library) {
        alert('Il file contiene anche una libreria: viene ignorata. Il progetto usa la libreria indicata dal suo percorso.');
    }
    if (!await svuota()) return;

    const nomeProposto = typeof dati.nome === 'string' && dati.nome.trim() ? dati.nome : file.name.replace(/\.json$/i, '');
    const libraryPath = typeof dati.libraryPath === 'string' && dati.libraryPath
        ? dati.libraryPath
        : (progetto.libraryPath || appSettings.libraryPath);
    const slug = await chiediNomeECrea('Nome del progetto importato:', nomeProposto,
        nome => ({ formatVersion: FORMAT_VERSION, nome, libraryPath, workspace, ...(dati.cliente ? { cliente: dati.cliente } : {}) }));
    if (!slug || await apriProgetto(slug) !== 'ok') return;

    const mancanti = tipiMancanti(pathStack[0].graph);
    if (mancanti.length > 0) {
        alert(`Questi tipi di blocco non sono nella libreria corrente: restano nel file ma non si vedono sul canvas.\n${mancanti.join('\n')}`);
    }
}

function importa() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (event) => {
        leggiFileJson(event, (dati, file) => esegui(() => importaDati(dati, file)));
    });
    input.click();
}

function scarica() {
    downloadJsonFile(JSON.parse(testoProgetto()), `${progetto.slug}.json`);
}

/* --- FINESTRA APRI --- */

// Anche il gestore di Esc della Gerarchia la usa
export function modaleAperta() {
    const modal = document.getElementById('reportModal');
    return (!!modal && modal.style.display !== 'none') || importClienteAperto();
}

function chiudiModale() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.style.display = 'none';
}

async function mostraElenco(messaggio = '') {
    const elenco = await leggiElenco();
    if (!elenco) return;
    const modal = document.getElementById('reportModal');
    document.getElementById('modalTitle').textContent = 'Apri progetto';
    // Senza un progetto aperto la finestra resta finché non ne scegli o crei uno
    document.getElementById('btnCloseModal').style.display = progetto.slug ? '' : 'none';

    const righe = elenco.map(p => `
        <tr class="riga-progetto${p.danneggiato ? ' progetto-danneggiato' : ''}${p.slug === progetto.slug ? ' progetto-aperto' : ''}" data-slug="${escapeHtml(p.slug)}">
            <td>${escapeHtml(p.nome)}${p.danneggiato ? ' <em>(file non leggibile)</em>' : ''}</td>
            <td><code>${escapeHtml(p.slug)}</code></td>
            <td>${escapeHtml(new Date(p.modificato).toLocaleString('it-IT'))}</td>
        </tr>`).join('');

    document.getElementById('modalContent').innerHTML = `
        ${messaggio ? `<p class="elenco-avviso">${escapeHtml(messaggio)}</p>` : ''}
        ${elenco.length > 0
            ? `<table class="report-table"><thead><tr><th>Nome</th><th>File</th><th>Ultima modifica</th></tr></thead><tbody>${righe}</tbody></table>`
            : `<p class="empty-props">Nessun progetto nella cartella progetti/.</p>`}
        <div style="margin-top: 10px;"><button id="btnElencoNuovo" class="pulsante-progetto">+ Nuovo progetto…</button></div>`;

    modal.style.display = 'flex';

    document.querySelectorAll('#modalContent .riga-progetto').forEach(riga => {
        riga.addEventListener('click', () => esegui(async () => {
            const slug = riga.dataset.slug;
            if (slug === progetto.slug) return chiudiModale();
            if (!await svuota()) return;
            if (await apriProgetto(slug) === 'ok') chiudiModale();
        }));
    });
    document.getElementById('btnElencoNuovo').addEventListener('click', () => esegui(async () => {
        if (!await svuota()) return;
        const slug = await chiediNomeECrea('Nome del nuovo progetto:', '', progettoVuoto);
        if (slug && await apriProgetto(slug) === 'ok') chiudiModale();
    }));
}

/* --- INTERFACCIA: BADGE, PULSANTI, MENU E BANNER --- */

function impostaStato(nuovo) {
    stato = nuovo;
    aggiornaInterfaccia();
}

function aggiornaInterfaccia() {
    const badge = document.getElementById('badgeSalvataggio');
    if (badge) {
        badge.hidden = !progetto.slug;
        badge.textContent = ETICHETTE_STATO[stato];
        badge.className = `badge-salvataggio stato-${motivoErrore && stato !== 'salvataggio' ? 'errore' : stato}`;
        badge.title = motivoErrore;
    }

    const bloccato = stato === 'conflitto';
    const btnAnnulla = document.getElementById('btnAnnulla');
    const btnRipeti = document.getElementById('btnRipeti');
    if (btnAnnulla) btnAnnulla.disabled = !progetto.slug || bloccato || progetto.versioni <= 0;
    if (btnRipeti) btnRipeti.disabled = !progetto.slug || bloccato || pilaRipeti.length === 0;

    document.querySelectorAll('#menuProgetto [data-azione]').forEach(voce => {
        const azione = voce.dataset.azione;
        const serveProgetto = ['copia', 'rinomina', 'elimina', 'scarica'].includes(azione);
        voce.disabled = (serveProgetto && !progetto.slug) || (bloccato && azione !== 'scarica');
    });

    aggiornaPulsantiLibreria();
    aggiornaPulsantiCliente();
    aggiornaBanner();
}

// Priorità: conflitto del progetto, conflitto della libreria, errore di salvataggio del progetto, avvisi
function aggiornaBanner() {
    const banner = document.getElementById('bannerProgetto');
    if (!banner) return;
    let html = '';
    let classe = 'banner-errore';
    const avviso = avvisoServer || avvisoLibreria || avvisoCliente || statoLibreriaBanner.avviso;
    if (stato === 'conflitto') {
        html = `<span>Il file del progetto è cambiato sul disco dopo che l'app l'ha letto (modifica a mano o un'altra scheda). Il salvataggio automatico è sospeso finché non scegli.</span>
            <button data-banner="ricarica">Ricarica dal disco</button>
            <button data-banner="sovrascrivi">Sovrascrivi</button>`;
    } else if (statoLibreriaBanner.conflitto) {
        html = `<span>La libreria è cambiata su disco dopo che l'app l'ha letta. Il blocco non è stato salvato: il form resta aperto finché non scegli.</span>
            <button data-banner="ricaricaLibreria">Ricarica la libreria</button>
            <button data-banner="sovrascriviLibreria">Sovrascrivi</button>`;
    } else if (motivoErrore) {
        html = `<span>Salvataggio non riuscito: ${escapeHtml(motivoErrore)}. L'app riprova da sola.</span>
            <button data-banner="riprova">Riprova</button>`;
    } else if (avviso) {
        classe = 'banner-avviso';
        html = `<span>${escapeHtml(avviso)}</span>
            <button data-banner="chiudi" title="Chiudi">✕</button>`;
    }
    banner.hidden = !html;
    banner.className = `banner-progetto ${classe}`;
    banner.innerHTML = html;
}

const AZIONI_MENU = {
    nuovo: () => esegui(nuovo),
    apri: () => esegui(() => mostraElenco()),
    copia: () => esegui(salvaCopia),
    rinomina: () => esegui(rinomina),
    elimina: () => esegui(elimina),
    importa: () => { if (!operazioneInCorso) importa(); },
    scarica
};

const AZIONI_BANNER = {
    ricarica: () => esegui(ricaricaDalDisco),
    sovrascrivi: () => esegui(sovrascrivi),
    riprova: () => esegui(riprova),
    ricaricaLibreria: () => esegui(ricaricaLibreria),
    sovrascriviLibreria: () => esegui(sovrascriviLibreria),
    chiudi: () => {
        if (avvisoServer) avvisoServer = '';
        else if (avvisoLibreria) avvisoLibreria = '';
        else if (avvisoCliente) avvisoCliente = '';
        else statoLibreriaBanner.avviso = '';
        aggiornaBanner();
    }
};

function installaEventi() {
    // In cattura: i trascinamenti del canvas fermano la propagazione dei loro eventi
    const rilascio = () => {
        if (!mousePremuto) return;
        mousePremuto = false;
        pianificaSalvataggio();
    };
    window.addEventListener('mousedown', () => { mousePremuto = true; }, true);
    window.addEventListener('mouseup', rilascio, true);
    // Il trascinamento di un blocco dalla libreria finisce con drop o dragend, senza mouseup
    window.addEventListener('drop', rilascio, true);
    window.addEventListener('dragend', rilascio, true);
    // Rilascio avvenuto fuori dalla finestra
    window.addEventListener('mousemove', (e) => {
        if (e.buttons === 0) rilascio();
    }, true);

    document.getElementById('btnAnnulla')?.addEventListener('click', () => esegui(annulla));
    document.getElementById('btnRipeti')?.addEventListener('click', () => esegui(ripeti));

    const btnMenu = document.getElementById('btnMenuProgetto');
    const menu = document.getElementById('menuProgetto');
    btnMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', () => { if (menu) menu.hidden = true; });
    menu?.addEventListener('click', (e) => {
        const voce = e.target.closest('[data-azione]');
        if (!voce || voce.disabled) return;
        menu.hidden = true;
        AZIONI_MENU[voce.dataset.azione]();
    });

    document.getElementById('bannerProgetto')?.addEventListener('click', (e) => {
        const pulsante = e.target.closest('[data-banner]');
        if (pulsante) AZIONI_BANNER[pulsante.dataset.banner]();
    });

    document.getElementById('btnCloseModal')?.addEventListener('click', chiudiModale);

    // Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z: mai dentro un campo di testo o con una finestra aperta
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        if (e.target.closest?.('input, textarea, select, [contenteditable]') || modaleAperta()) return;
        const tasto = e.key.toLowerCase();
        const vuoleAnnulla = tasto === 'z' && !e.shiftKey;
        const vuoleRipeti = tasto === 'y' || (tasto === 'z' && e.shiftKey);
        if (vuoleAnnulla && !document.getElementById('btnAnnulla')?.disabled) {
            e.preventDefault();
            esegui(annulla);
        } else if (vuoleRipeti && !document.getElementById('btnRipeti')?.disabled) {
            e.preventDefault();
            esegui(ripeti);
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (!progetto.slug) return;
        if (stato !== 'salvato' || motivoErrore || testoProgetto() !== ultimoTestoSalvato) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Ultimo tentativo alla chiusura, solo se il progetto sta nel limite di una richiesta keepalive
    window.addEventListener('pagehide', () => {
        if (!progetto.slug || stato === 'conflitto' || salvataggioInVolo) return;
        const testo = testoProgetto();
        if (testo === ultimoTestoSalvato) return;
        const corpo = `{"progetto":${testo},"improntaAttesa":${JSON.stringify(progetto.impronta)},"forza":false}`;
        if (new Blob([corpo]).size > LIMITE_KEEPALIVE) return;
        fetch(urlProgetto(progetto.slug), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: corpo,
            keepalive: true
        }).catch(() => {});
    });
}

/* --- AVVIO --- */

// Ordine: ultimo progetto → suo file → sua libreria → modello → render → ultimoTestoSalvato → _ultimo.json
export async function avviaProgetti() {
    installaEventi();
    aggiornaInterfaccia();

    const ultimo = await chiamaApi('GET', '/api/ultimo');
    if (!ultimo.ok) {
        // Server senza API (ad esempio un server statico): si lavora in memoria, senza salvare
        avvisoServer = "Server dei progetti non raggiungibile: il lavoro non viene salvato. Avvia l'app con start.py.";
        await caricaLibreria(appSettings.libraryPath);
        renderUI();
        render();
        return;
    }

    const slug = ultimo.dati.progetto;
    if (slug) {
        const esito = await apriProgetto(slug, { silenzioso404: true });
        if (esito === 'ok') return;
        const elenco = await leggiElenco();
        if (!elenco) return;
        if (elenco.length === 0) {
            await creaPrimoProgetto();
            return;
        }
        await caricaLibreria(appSettings.libraryPath);
        render();
        await mostraElenco(esito === 'non_trovato' ? "L'ultimo progetto non è stato trovato" : '');
        return;
    }

    const elenco = await leggiElenco();
    if (!elenco) return;
    if (elenco.length === 0) {
        await creaPrimoProgetto();
        return;
    }
    if (await apriProgetto(elenco[0].slug) === 'ok') return;
    await caricaLibreria(appSettings.libraryPath);
    render();
    await mostraElenco();
}
