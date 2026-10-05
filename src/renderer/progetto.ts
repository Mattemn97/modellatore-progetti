/* --- PROGETTO SU DISCO: SALVATAGGIO AUTOMATICO, VERSIONI, ANNULLA E RIPETI, MENU PROGETTO --- */

import { chiamaApi } from './api.js';
import { appState, appSettings, pathStack, getCurrentLevel, activeNodeId, setActiveNodeId } from './state.js';
import { render } from './renderer.js';
import { renderUI } from './app.js';
import { initLibrary, loadLibraryFromPath } from './builder.js';
import { leggiFileJson, downloadJsonFile } from './storage.js';
import { chiediTesto, escapeHtml, messaggioDi, slugifyId } from './utils.js';
import { ricaricaLibreria, sovrascriviLibreria, aggiornaPulsantiLibreria } from './libreria.js';
import {
    problemaCliente, completaCliente, controllaClienteAllApertura, aggiornaPulsantiCliente,
    importClienteAperto, impostaSelezioneCliente, dettaglioClienteAperto
} from './cliente.js';
import { segnaSchedaCoerenzaDaAggiornare } from './coerenza.js';
import { azzeraSceltaGerarchia } from './gerarchia.js';
import { tourAttivo } from './tour.js';
import type { Cliente, FileProgetto, Grafo } from './tipi.js';

// Riesportata per i moduli che la importano da qui
export { chiamaApi };

// 2 da quando il progetto può avere la chiave cliente (spec 0003): si leggono 1 e 2, si scrive sempre 2
const FORMAT_VERSION = 2;
const LUNGHEZZA_MAX_SLUG = 80;
const NOMI_RISERVATI = new Set(['con', 'prn', 'aux', 'nul',
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((i) => [`com${i}`, `lpt${i}`])]);
// Attese tra un tentativo di salvataggio fallito e il successivo; l'ultima si ripete
const RITARDI_RITENTATIVO = [2000, 4000, 8000, 16000, 30000];
// Il browser rifiuta una richiesta keepalive oltre circa 64 KB
const LIMITE_KEEPALIVE = 60000;

const MSG_NOME_NON_VALIDO = 'Il nome deve contenere almeno una lettera o cifra e non può essere un nome riservato di Windows';

type StatoSalvataggio = 'salvato' | 'attesa' | 'salvataggio' | 'errore' | 'conflitto';

const ETICHETTE_STATO: Record<StatoSalvataggio, string> = {
    salvato: 'Salvato',
    attesa: 'Modifiche in attesa',
    salvataggio: 'Salvataggio…',
    errore: 'Errore di salvataggio',
    conflitto: 'Conflitto'
};

/* --- Forme delle risposte dell'API dei progetti (spec 0001, 0018) --- */

interface Scrittura {
    impronta: string;
    versioni: number;
}

interface Lettura extends Scrittura {
    progetto: unknown;
}

interface VoceElenco {
    slug: string;
    nome: string;
    modificato: number;
    danneggiato: boolean;
}

// Contenuto di un file progetto già controllato da problemaFileProgetto
type DatiProgetto = Partial<FileProgetto> & { workspace: Grafo; cliente?: Cliente | null; library?: unknown };

// Progetto aperto: slug = nome del file in progetti/, impronta = SHA1 del file letto o scritto
const progetto: { slug: string | null; nome: string; libraryPath: string; impronta: string | null; versioni: number } =
    { slug: null, nome: '', libraryPath: '', impronta: null, versioni: 0 };

let stato: StatoSalvataggio = 'salvato';
let ultimoTestoSalvato: string | null = null;
let motivoErrore = '';          // non vuoto finché un salvataggio fallisce: banner rosso e ritentativi
let timerSalvataggio: ReturnType<typeof setTimeout> | undefined;
let timerRitentativo: ReturnType<typeof setTimeout> | undefined;
let tentativiFalliti = 0;
let mousePremuto = false;
let salvataggioInVolo: ReturnType<typeof chiamaApi<Scrittura>> | null = null;
let pilaRipeti: string[] = [];
let prossimoDaRipeti = false;   // il prossimo salvataggio viene da Ripeti e non svuota la pila
let operazioneInCorso = false;
let libreriaCaricata: string | null = null;    // percorso dell'ultima libreria caricata con successo
let avvisoLibreria = '';
let avvisoServer = '';
let avvisoCliente = '';          // id cliente uguali a id della libreria, trovati all'apertura
// Stati della libreria su disco mostrati nel banner, impostati da libreria.ts
const statoLibreriaBanner = { conflitto: false, avviso: '' };

/* --- TESTO DEL PROGETTO E CHIAMATE AL SERVER --- */

// Workspace e requisiti cliente insieme: ogni cambiamento dei due fa partire il salvataggio
function testoProgetto(): string {
    const contenuto: FileProgetto = {
        formatVersion: FORMAT_VERSION,
        nome: progetto.nome,
        libraryPath: progetto.libraryPath,
        workspace: pathStack[0]!.graph
    };
    if (appState.cliente) contenuto.cliente = appState.cliente;
    return JSON.stringify(contenuto);
}

// Un progetto è aperto (e si salva su disco)
export function progettoAperto(): boolean {
    return !!progetto.slug;
}

// Slug e nome del progetto aperto, per il file della matrice (spec 0006); slug null se nessun progetto è aperto
export function infoProgetto(): { slug: string | null; nome: string } {
    return { slug: progetto.slug, nome: progetto.nome };
}

function urlProgetto(slug: string, suffisso = ''): string {
    return `/api/progetti/${encodeURIComponent(slug)}${suffisso}`;
}

function slugDaNome(nome: string): string {
    const slug = slugifyId(nome).slice(0, LUNGHEZZA_MAX_SLUG).replace(/_+$/, '');
    return NOMI_RISERVATI.has(slug) ? '' : slug;
}

/* --- COMPLETAMENTO E SOSTITUZIONE DEL MODELLO --- */

// Aggiunge a ogni livello i campi che render() ed enterNode scriverebbero, così la sola vista non genera salvataggi
export function completaModello(graph: Grafo): Grafo {
    if (!Array.isArray(graph.nodes)) graph.nodes = [];
    if (!Array.isArray(graph.edges)) graph.edges = [];
    if (!graph.parentReqPositions) graph.parentReqPositions = {};
    graph.edges.forEach((edge) => {
        if (!edge.waypoints) edge.waypoints = [];
    });
    graph.nodes.forEach((node) => {
        if (!node.pinPositions) node.pinPositions = {};
        if (!node.internal_graph) node.internal_graph = { nodes: [], edges: [] };
        completaModello(node.internal_graph);
    });
    return graph;
}

function svuotaIspettore(): void {
    const propsContent = document.getElementById('propsContent');
    if (propsContent) propsContent.innerHTML = '<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>';
}

// Ricostruisce pathStack dalla radice seguendo gli id dei nodi; false se un id non c'è (restano aperti i livelli trovati)
export function apriPercorso(ids: string[]): boolean {
    pathStack.length = 1;
    for (const id of ids) {
        const nodo = getCurrentLevel().graph.nodes.find((n) => n.id === id);
        if (!nodo) return false;
        if (!nodo.internal_graph) nodo.internal_graph = { nodes: [], edges: [] };
        pathStack.push({ id: nodo.id, label: nodo.label || nodo.id, graph: nodo.internal_graph, parentNode: nodo });
    }
    return true;
}

// Sostituisce workspace e requisiti cliente, sempre insieme; con mantieniLivello riapre gli stessi blocchi seguendo i loro id
function sostituisciModello(workspace: Grafo, cliente: Cliente | null | undefined, mantieniLivello: boolean): void {
    const idAperti = mantieniLivello ? pathStack.slice(1).map((livello) => livello.id) : [];
    completaModello(workspace);
    appState.workspace = workspace;
    appState.cliente = completaCliente(cliente ?? null);
    pathStack.length = 0;
    pathStack.push({ id: 'root', label: progetto.nome, graph: workspace, parentNode: null });
    apriPercorso(idAperti);
    const selezionePersa = activeNodeId && !getCurrentLevel().graph.nodes.some((n) => n.id === activeNodeId);
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
function impostaProgetto(slug: string, nome: string, libraryPath: string, workspace: Grafo, cliente: Cliente | null | undefined,
    impronta: string, versioni: number, mantieniLivello: boolean): void {
    annullaTimer();
    fermaRitentativi();
    Object.assign(progetto, { slug, nome, libraryPath, impronta, versioni });
    sostituisciModello(workspace, cliente, mantieniLivello);
    const libPathInput = document.getElementById('libPathInput') as HTMLInputElement | null;
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
function problemaFileProgetto(dati: unknown, slug: string): string | null {
    if (!dati || typeof dati !== 'object' || Array.isArray(dati)) {
        return `Il file del progetto "${slug}" non contiene un progetto valido.`;
    }
    const d = dati as Record<string, unknown>;
    if (d.formatVersion !== undefined && !(Number.isInteger(d.formatVersion) && (d.formatVersion as number) <= FORMAT_VERSION)) {
        return `Il progetto "${slug}" usa un formato più recente (${String(d.formatVersion)}) di quello che questa versione dell'app sa leggere: non viene aperto né sovrascritto.`;
    }
    const ws = d.workspace as Partial<Grafo> | null | undefined;
    if (!ws || typeof ws !== 'object' || !Array.isArray(ws.nodes) || !Array.isArray(ws.edges)) {
        return `Il file del progetto "${slug}" non contiene un workspace valido (servono gli elenchi "nodes" ed "edges").`;
    }
    const cliente = problemaCliente(d.cliente);
    if (cliente) return `Il file del progetto "${slug}" ha requisiti cliente non validi: ${cliente}.`;
    return null;
}

// Dopo l'apertura: fili cliente orfani, posizioni mancanti, collisioni con la libreria (spec 0003, AC-20)
function controllaCliente(): void {
    const { cambiato, avviso } = controllaClienteAllApertura();
    avvisoCliente = avviso;
    aggiornaBanner();
    // Le correzioni vanno su disco con il salvataggio automatico
    if (cambiato) render();
}

/* --- LIBRERIA DEL PROGETTO --- */

async function caricaLibreria(percorso: string): Promise<void> {
    const libPathInput = document.getElementById('libPathInput') as HTMLInputElement | null;
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
export function aggiornaPercorsoLibreria(percorso: string): void {
    libreriaCaricata = percorso;
    avvisoLibreria = '';
    if (progetto.slug) progetto.libraryPath = percorso;
    aggiornaInterfaccia();
    render();
}

// Il Salva della libreria è bloccato finché il progetto è in conflitto
export function progettoInConflitto(): boolean {
    return stato === 'conflitto';
}

// Aggiorna solo i campi passati: { conflitto, avviso }
export function impostaStatoLibreriaBanner(nuovo: Partial<typeof statoLibreriaBanner>): void {
    Object.assign(statoLibreriaBanner, nuovo);
    aggiornaBanner();
}

/* --- SALVATAGGIO AUTOMATICO --- */

function annullaTimer(): void {
    clearTimeout(timerSalvataggio);
    timerSalvataggio = undefined;
}

function fermaRitentativi(): void {
    clearTimeout(timerRitentativo);
    timerRitentativo = undefined;
    tentativiFalliti = 0;
}

function pianificaRitentativo(): void {
    clearTimeout(timerRitentativo);
    const ritardo = RITARDI_RITENTATIVO[Math.min(tentativiFalliti, RITARDI_RITENTATIVO.length - 1)];
    tentativiFalliti++;
    timerRitentativo = setTimeout(() => void salva(), ritardo);
}

// Chiamata da render(): riavvia l'attesa; il confronto del testo avviene solo allo scadere
export function pianificaSalvataggio(): void {
    if (!progetto.slug || stato === 'conflitto' || motivoErrore) return;
    annullaTimer();
    // Durante un trascinamento si aspetta il rilascio: un trascinamento è sempre un solo salvataggio
    if (mousePremuto) return;
    timerSalvataggio = setTimeout(() => void salva(), appSettings.progetti.debounceMs);
}

// Scrive il progetto se il testo è cambiato; restituisce true se su disco c'è lo stato attuale
async function salva({ forza = false } = {}): Promise<boolean> {
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
    const richiesta = chiamaApi<Scrittura>('PUT', urlProgetto(slug), corpo);
    salvataggioInVolo = richiesta;
    let r;
    try {
        r = await richiesta;
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
export async function svuota(): Promise<boolean> {
    if (stato === 'conflitto') {
        alert('Il file del progetto è cambiato sul disco: scegli prima "Ricarica dal disco" o "Sovrascrivi" nel banner.');
        return false;
    }
    if (motivoErrore) {
        alert(`Il salvataggio non riesce (${motivoErrore}). Risolvi prima il problema indicato nel banner rosso.`);
        return false;
    }
    if (await salva()) return true;
    // salva() può aver portato lo stato in conflitto
    if ((stato as StatoSalvataggio) !== 'conflitto') alert("Salvataggio non riuscito: l'operazione è stata annullata.");
    return false;
}

// Una sola operazione alla volta (Ctrl+Z ripetuti, clic doppi sul menu)
async function esegui(azione: () => Promise<unknown> | unknown): Promise<void> {
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
async function apriProgetto(slug: string, { silenzioso404 = false } = {}): Promise<'ok' | 'non_trovato' | 'errore'> {
    const r = await chiamaApi<Lettura>('GET', urlProgetto(slug));
    if (!r.ok) {
        if (r.stato === 404 && silenzioso404) return 'non_trovato';
        if (r.errore === 'json_non_valido') {
            alert(`Il file del progetto "${slug}" non è JSON valido: non viene aperto né sovrascritto.`);
        } else {
            alert(`Impossibile aprire il progetto "${slug}": ${r.messaggio}`);
        }
        return r.stato === 404 ? 'non_trovato' : 'errore';
    }

    const problema = problemaFileProgetto(r.dati.progetto, slug);
    if (problema) {
        alert(problema);
        return 'errore';
    }
    const dati = r.dati.progetto as DatiProgetto;
    try {
        completaModello(dati.workspace);
    } catch (err) {
        alert(`Il file del progetto "${slug}" contiene un modello non valido: ${messaggioDi(err)}`);
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
async function chiediNomeECrea(domanda: string, proposta: string, costruisci: (nome: string) => unknown): Promise<string | null> {
    let testo = proposta;
    for (;;) {
        const risposta = chiediTesto(domanda, testo);
        if (risposta === null) return null;
        testo = risposta;
        const nome = risposta.trim();
        const slug = slugDaNome(nome);
        if (!nome || !slug) {
            alert(MSG_NOME_NON_VALIDO);
            continue;
        }
        const r = await chiamaApi<{ slug: string }>('POST', '/api/progetti', { slug, progetto: costruisci(nome) });
        if (r.ok) return r.dati.slug;
        if (r.errore === 'esiste') {
            alert(`Esiste già un progetto con il nome "${slug}": scegline un altro.`);
            continue;
        }
        alert(`Impossibile creare il progetto: ${r.messaggio}`);
        return null;
    }
}

function progettoVuoto(nome: string): FileProgetto {
    return {
        formatVersion: FORMAT_VERSION,
        nome,
        libraryPath: progetto.libraryPath || appSettings.libraryPath,
        workspace: { nodes: [], edges: [] }
    };
}

// "Nuovo progetto" quando la cartella è vuota o l'ultimo progetto è stato eliminato
async function creaPrimoProgetto(): Promise<'ok' | 'non_trovato' | 'errore'> {
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

async function leggiElenco(): Promise<VoceElenco[] | null> {
    const r = await chiamaApi<{ progetti: VoceElenco[] }>('GET', '/api/progetti');
    if (!r.ok) {
        alert(`Impossibile leggere l'elenco dei progetti: ${r.messaggio}`);
        return null;
    }
    return r.dati.progetti;
}

// Dopo un'eliminazione: il progetto modificato più di recente, oppure uno nuovo
async function apriPiuRecenteOCreaNuovo(): Promise<void> {
    const elenco = await leggiElenco();
    if (!elenco) return;
    const primo = elenco[0];
    if (!primo) {
        await creaPrimoProgetto();
        return;
    }
    if (await apriProgetto(primo.slug) !== 'ok') await mostraElenco();
}

/* --- ANNULLA, RIPETI, CONFLITTI --- */

async function annulla(): Promise<void> {
    if (!progetto.slug || stato === 'conflitto' || progetto.versioni <= 0) return;
    if (!await svuota()) return;
    const slug = progetto.slug;
    const testoAttuale = ultimoTestoSalvato;
    const r = await chiamaApi<Lettura>('POST', urlProgetto(slug, '/annulla'), { improntaAttesa: progetto.impronta });
    if (!r.ok) {
        if (r.errore === 'conflitto') impostaStato('conflitto');
        else if (r.errore === 'nessuna_versione') progetto.versioni = 0;
        else alert(`Annulla non riuscito: ${r.messaggio}`);
        return;
    }
    if (testoAttuale !== null) pilaRipeti.push(testoAttuale);
    while (pilaRipeti.length > appSettings.progetti.versioni) pilaRipeti.shift();
    const dati = r.dati.progetto as DatiProgetto;
    impostaProgetto(slug, progetto.nome, progetto.libraryPath, dati.workspace, dati.cliente, r.dati.impronta, r.dati.versioni, true);
}

async function ripeti(): Promise<void> {
    if (!progetto.slug || stato === 'conflitto' || pilaRipeti.length === 0) return;
    if (!await svuota()) return;
    const testo = pilaRipeti.pop();
    if (testo === undefined) return;
    const dati = JSON.parse(testo) as DatiProgetto;
    sostituisciModello(dati.workspace, dati.cliente, true);
    renderUI();
    render();
    prossimoDaRipeti = true;
    await salva();
}

async function ricaricaDalDisco(): Promise<void> {
    const slug = progetto.slug;
    if (!slug) return;
    const r = await chiamaApi<Lettura>('GET', urlProgetto(slug));
    if (!r.ok) {
        alert(`Impossibile rileggere il progetto: ${r.messaggio}`);
        return;
    }
    const problema = problemaFileProgetto(r.dati.progetto, slug);
    if (problema) {
        alert(problema);
        return;
    }
    const dati = r.dati.progetto as DatiProgetto;
    const libraryPath = typeof dati.libraryPath === 'string' && dati.libraryPath ? dati.libraryPath : progetto.libraryPath;
    await caricaLibreria(libraryPath);
    const nome = typeof dati.nome === 'string' && dati.nome.trim() ? dati.nome : slug;
    impostaProgetto(slug, nome, libraryPath, dati.workspace, dati.cliente, r.dati.impronta, r.dati.versioni, true);
    controllaCliente();
    pilaRipeti = [];
}

async function sovrascrivi(): Promise<void> {
    await salva({ forza: true });
}

async function riprova(): Promise<void> {
    clearTimeout(timerRitentativo);
    await salva();
}

/* --- MENU PROGETTO --- */

async function nuovo(): Promise<void> {
    if (!await svuota()) return;
    const slug = await chiediNomeECrea('Nome del nuovo progetto:', '', progettoVuoto);
    if (slug) await apriProgetto(slug);
}

async function salvaCopia(): Promise<void> {
    if (!await svuota()) return;
    const contenuto = JSON.parse(testoProgetto()) as FileProgetto;
    const slug = await chiediNomeECrea('Nome della copia:', `Copia di ${progetto.nome}`, (nome) => ({ ...contenuto, nome }));
    if (slug) await apriProgetto(slug);
}

async function rinomina(): Promise<void> {
    if (!await svuota()) return;
    let testo = progetto.nome;
    for (;;) {
        const risposta = chiediTesto('Nuovo nome del progetto:', testo);
        if (risposta === null) return;
        testo = risposta;
        const nome = risposta.trim();
        const slug = slugDaNome(nome);
        if (!nome || !slug) {
            alert(MSG_NOME_NON_VALIDO);
            continue;
        }
        if (nome === progetto.nome || !progetto.slug) return;
        const r = await chiamaApi<Scrittura & { slug: string }>('POST', urlProgetto(progetto.slug, '/rinomina'),
            { nuovoSlug: slug, nome, improntaAttesa: progetto.impronta });
        if (r.ok) {
            Object.assign(progetto, { slug: r.dati.slug, nome, impronta: r.dati.impronta, versioni: r.dati.versioni });
            pathStack[0]!.label = nome;
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

async function elimina(): Promise<void> {
    if (!confirm(`Eliminare il progetto "${progetto.nome}"? Il file viene spostato in progetti/_cestino/.`)) return;
    if (!await svuota()) return;
    if (!progetto.slug) return;
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
function tipiMancanti(graph: Grafo, trovati = new Set<string>()): string[] {
    graph.nodes.forEach((node) => {
        if (!appState.library[node.type]) trovati.add(node.type);
        if (node.internal_graph) tipiMancanti(node.internal_graph, trovati);
    });
    return [...trovati];
}

async function importaDati(datiGrezzi: unknown, file: File): Promise<void> {
    if (!datiGrezzi || typeof datiGrezzi !== 'object' || Array.isArray(datiGrezzi)) {
        alert(`"${file.name}" non contiene un modello valido.`);
        return;
    }
    const dati = datiGrezzi as Record<string, unknown>;
    if (dati.formatVersion !== undefined && !(Number.isInteger(dati.formatVersion) && (dati.formatVersion as number) <= FORMAT_VERSION)) {
        alert(`"${file.name}" usa un formato più recente (${String(dati.formatVersion)}) di quello che questa versione dell'app sa leggere.`);
        return;
    }
    // modello.json e file progetto hanno { workspace }; si accetta anche un grafo con nodes ed edges alla radice
    const workspace = (dati.workspace && typeof dati.workspace === 'object' ? dati.workspace : dati) as Grafo;
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
        alert(`"${file.name}" contiene un modello non valido: ${messaggioDi(err)}`);
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
        (nome) => ({ formatVersion: FORMAT_VERSION, nome, libraryPath, workspace, ...(dati.cliente ? { cliente: dati.cliente } : {}) }));
    if (!slug || await apriProgetto(slug) !== 'ok') return;

    const mancanti = tipiMancanti(pathStack[0]!.graph);
    if (mancanti.length > 0) {
        alert(`Questi tipi di blocco non sono nella libreria corrente: restano nel file ma non si vedono sul canvas.\n${mancanti.join('\n')}`);
    }
}

function importa(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (event) => {
        leggiFileJson(event, (dati, file) => void esegui(() => importaDati(dati, file)));
    });
    input.click();
}

function scarica(): void {
    downloadJsonFile(JSON.parse(testoProgetto()), `${progetto.slug}.json`);
}

/* --- FINESTRA APRI --- */

// Anche il gestore di Esc della Gerarchia la usa; il tour guidato conta come finestra aperta (spec 0012)
export function modaleAperta(): boolean {
    const aperta = (id: string) => {
        const modal = document.getElementById(id);
        return !!modal && modal.style.display !== 'none';
    };
    return tourAttivo() || aperta('reportModal') || aperta('matriceModal') || aperta('documentiModal') || aperta('impostazioniModal') || importClienteAperto();
}

function chiudiModale(): void {
    const modal = document.getElementById('reportModal');
    if (modal) modal.style.display = 'none';
}

async function mostraElenco(messaggio = ''): Promise<void> {
    const elenco = await leggiElenco();
    if (!elenco) return;
    const modal = document.getElementById('reportModal');
    const titolo = document.getElementById('modalTitle');
    const chiudi = document.getElementById('btnCloseModal');
    const contenuto = document.getElementById('modalContent');
    if (!modal || !titolo || !chiudi || !contenuto) return;
    titolo.textContent = 'Apri progetto';
    // Senza un progetto aperto la finestra resta finché non ne scegli o crei uno
    chiudi.style.display = progetto.slug ? '' : 'none';

    const righe = elenco.map((p) => `
        <tr class="riga-progetto${p.danneggiato ? ' progetto-danneggiato' : ''}${p.slug === progetto.slug ? ' progetto-aperto' : ''}" data-slug="${escapeHtml(p.slug)}">
            <td>${escapeHtml(p.nome)}${p.danneggiato ? ' <em>(file non leggibile)</em>' : ''}</td>
            <td><code>${escapeHtml(p.slug)}</code></td>
            <td>${escapeHtml(new Date(p.modificato).toLocaleString('it-IT'))}</td>
        </tr>`).join('');

    contenuto.innerHTML = `
        ${messaggio ? `<p class="elenco-avviso">${escapeHtml(messaggio)}</p>` : ''}
        ${elenco.length > 0
            ? `<table class="report-table"><thead><tr><th>Nome</th><th>File</th><th>Ultima modifica</th></tr></thead><tbody>${righe}</tbody></table>`
            : '<p class="empty-props">Nessun progetto nella cartella progetti/.</p>'}
        <div style="margin-top: 10px;"><button id="btnElencoNuovo" class="pulsante-progetto">+ Nuovo progetto…</button></div>`;

    modal.style.display = 'flex';

    document.querySelectorAll<HTMLElement>('#modalContent .riga-progetto').forEach((riga) => {
        riga.addEventListener('click', () => void esegui(async () => {
            const slug = riga.dataset.slug ?? '';
            if (slug === progetto.slug) return chiudiModale();
            if (!await svuota()) return;
            if (await apriProgetto(slug) === 'ok') chiudiModale();
        }));
    });
    document.getElementById('btnElencoNuovo')?.addEventListener('click', () => void esegui(async () => {
        if (!await svuota()) return;
        const slug = await chiediNomeECrea('Nome del nuovo progetto:', '', progettoVuoto);
        if (slug && await apriProgetto(slug) === 'ok') chiudiModale();
    }));
}

/* --- INTERFACCIA: BADGE, PULSANTI, MENU E BANNER --- */

function impostaStato(nuovo: StatoSalvataggio): void {
    stato = nuovo;
    aggiornaInterfaccia();
}

function aggiornaInterfaccia(): void {
    const badge = document.getElementById('badgeSalvataggio');
    if (badge) {
        badge.hidden = !progetto.slug;
        badge.textContent = ETICHETTE_STATO[stato];
        badge.className = `badge-salvataggio stato-${motivoErrore && stato !== 'salvataggio' ? 'errore' : stato}`;
        badge.dataset.titoloNativo = motivoErrore || '';
    }

    const bloccato = stato === 'conflitto';
    const btnAnnulla = document.getElementById('btnAnnulla') as HTMLButtonElement | null;
    const btnRipeti = document.getElementById('btnRipeti') as HTMLButtonElement | null;
    if (btnAnnulla) btnAnnulla.disabled = !progetto.slug || bloccato || progetto.versioni <= 0;
    if (btnRipeti) btnRipeti.disabled = !progetto.slug || bloccato || pilaRipeti.length === 0;

    document.querySelectorAll<HTMLButtonElement>('#menuProgetto [data-azione]').forEach((voce) => {
        const azione = voce.dataset.azione ?? '';
        const serveProgetto = ['copia', 'rinomina', 'elimina', 'scarica'].includes(azione);
        voce.disabled = (serveProgetto && !progetto.slug) || (bloccato && azione !== 'scarica');
    });

    aggiornaPulsantiLibreria();
    aggiornaPulsantiCliente();
    aggiornaBanner();
}

// Priorità: conflitto del progetto, conflitto della libreria, errore di salvataggio del progetto, avvisi
function aggiornaBanner(): void {
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

const AZIONI_MENU: Record<string, () => void> = {
    nuovo: () => void esegui(nuovo),
    apri: () => void esegui(() => mostraElenco()),
    copia: () => void esegui(salvaCopia),
    rinomina: () => void esegui(rinomina),
    elimina: () => void esegui(elimina),
    importa: () => { if (!operazioneInCorso) importa(); },
    scarica
};

const AZIONI_BANNER: Record<string, () => void> = {
    ricarica: () => void esegui(ricaricaDalDisco),
    sovrascrivi: () => void esegui(sovrascrivi),
    riprova: () => void esegui(riprova),
    ricaricaLibreria: () => void esegui(ricaricaLibreria),
    sovrascriviLibreria: () => void esegui(sovrascriviLibreria),
    chiudi: () => {
        if (avvisoServer) avvisoServer = '';
        else if (avvisoLibreria) avvisoLibreria = '';
        else if (avvisoCliente) avvisoCliente = '';
        else statoLibreriaBanner.avviso = '';
        aggiornaBanner();
    }
};

function installaEventi(): void {
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

    document.getElementById('btnAnnulla')?.addEventListener('click', () => void esegui(annulla));
    document.getElementById('btnRipeti')?.addEventListener('click', () => void esegui(ripeti));

    const btnMenu = document.getElementById('btnMenuProgetto');
    const menu = document.getElementById('menuProgetto');
    btnMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu) menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', () => { if (menu) menu.hidden = true; });
    menu?.addEventListener('click', (e) => {
        const voce = (e.target as Element).closest<HTMLButtonElement>('[data-azione]');
        if (!voce || voce.disabled) return;
        menu.hidden = true;
        AZIONI_MENU[voce.dataset.azione ?? '']?.();
    });

    document.getElementById('bannerProgetto')?.addEventListener('click', (e) => {
        const pulsante = (e.target as Element).closest<HTMLElement>('[data-banner]');
        if (pulsante) AZIONI_BANNER[pulsante.dataset.banner ?? '']?.();
    });

    document.getElementById('btnCloseModal')?.addEventListener('click', chiudiModale);

    // Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z: mai dentro un campo di testo o con una finestra aperta
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]') || modaleAperta()) return;
        const tasto = e.key.toLowerCase();
        const vuoleAnnulla = tasto === 'z' && !e.shiftKey;
        const vuoleRipeti = tasto === 'y' || (tasto === 'z' && e.shiftKey);
        if (vuoleAnnulla && !(document.getElementById('btnAnnulla') as HTMLButtonElement | null)?.disabled) {
            e.preventDefault();
            void esegui(annulla);
        } else if (vuoleRipeti && !(document.getElementById('btnRipeti') as HTMLButtonElement | null)?.disabled) {
            e.preventDefault();
            void esegui(ripeti);
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
export async function avviaProgetti(): Promise<void> {
    installaEventi();
    aggiornaInterfaccia();

    const ultimo = await chiamaApi<{ progetto: string | null }>('GET', '/api/ultimo');
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
    const primo = elenco[0];
    if (!primo) {
        await creaPrimoProgetto();
        return;
    }
    if (await apriProgetto(primo.slug) === 'ok') return;
    await caricaLibreria(appSettings.libraryPath);
    render();
    await mostraElenco();
}
