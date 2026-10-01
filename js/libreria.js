/* --- LIBRERIA SU DISCO: APERTURA, SALVATAGGIO PER BLOCCO, CONFLITTI, SOLA LETTURA E CHANGELOG --- */

import { appState } from './state.js';
import { render } from './renderer.js';
import { impostaLibreria } from './builder.js';
import { openLibraryBlock } from './inspector.js';
import { chiamaApi, progettoInConflitto, impostaStatoLibreriaBanner } from './progetto.js';
import { escapeHtml } from './utils.js';

const MSG_FUORI_SHARED = "La libreria è fuori dalla cartella shared/: l'app può solo leggerla.";
const MSG_WEB = "Libreria caricata da un indirizzo web: l'app può solo leggerla.";
const MSG_SERVER_ASSENTE = "Server delle librerie non raggiungibile: la libreria è aperta in sola lettura.";
const MSG_CONFLITTO = 'La libreria è cambiata su disco: scegli "Ricarica la libreria" o "Sovrascrivi" nel banner.';

const ETICHETTE_ORIGINE = { app: 'App', esterna: 'Modifica esterna', iniziale: 'Voce iniziale' };
const ETICHETTE_LIVELLO = { major: 'Major', minor: 'Minor', patch: 'Patch' };
const ETICHETTE_CAMPO = {
    metodoVerifica: 'metodo di verifica',
    testiExport: 'testi da esportare',
    ordineRequisiti: 'ordine dei requisiti'
};

// Stato della libreria in memoria: cambia solo quando un caricamento o un salvataggio riesce.
// percorso è null per le librerie lette senza API (indirizzo web o percorso rifiutato)
const libreria = {
    caricata: false,
    percorso: null,
    nomeFile: '',
    versione: null,
    impronta: null,
    scrivibile: false,
    formato: 1,
    motivoSolaLettura: ''
};

let conflitto = null;           // { corpo, alSuccesso, blockId, nodeId } del salvataggio rifiutato con 409
let salvataggioInCorso = false;

// Nome del file e versione della libreria caricata, per l'intestazione della matrice esportata (spec 0006)
export function infoLibreria() {
    if (!libreria.caricata) return { nomeFile: '', versione: null };
    return { nomeFile: libreria.nomeFile, versione: libreria.versione };
}

/* --- PERCORSI --- */

function eIndirizzoWeb(percorso) {
    return /^(https?:|\/\/)/i.test(percorso.trim());
}

// Forma usata dall'API: \ diventa /, senza ./ e / iniziali, senza ?… e #…
export function normalizzaPercorso(percorso) {
    let p = percorso.trim().replace(/\\/g, '/').replace(/[?#].*$/, '');
    while (p.startsWith('./') || p.startsWith('/')) p = p.startsWith('./') ? p.slice(2) : p.slice(1);
    return p;
}

function nomeFileDi(percorso) {
    return percorso.replace(/[?#].*$/, '').split(/[\\/]/).pop() || percorso;
}

/* --- CARICAMENTO --- */

function avvisoDa(dati) {
    const parti = [];
    const esterne = (dati.vociAggiunte || []).filter(v => v.origine === 'esterna');
    if (esterne.length > 0) {
        parti.push(`La libreria è stata modificata fuori dall'app: registrata come versione ${esterne[esterne.length - 1].versione}`);
    }
    if (dati.avviso) parti.push(dati.avviso);
    return parti.join('. ');
}

function adotta(nuovoStato, avviso) {
    Object.assign(libreria, { caricata: true, ...nuovoStato });
    conflitto = null;
    // L'avviso di un caricamento resta fino al caricamento successivo
    impostaStatoLibreriaBanner({ conflitto: false, avviso });
    aggiornaPannelloLibreria();
    aggiornaPulsantiLibreria();
}

// Lettura statica senza API, sempre in sola lettura
async function caricaStatica(percorso, motivo) {
    try {
        const risposta = await fetch(percorso);
        if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
        impostaLibreria(await risposta.json());
    } catch (err) {
        return { ok: false, messaggio: `Impossibile leggere "${percorso}": ${err.message}` };
    }
    adotta({
        percorso: null, nomeFile: nomeFileDi(percorso), versione: null, impronta: null,
        scrivibile: false, formato: 1, motivoSolaLettura: motivo
    }, '');
    return { ok: true };
}

// Carica una libreria; restituisce { ok, messaggio }. Se non riesce restano libreria e stato precedenti
export async function apriLibreria(percorso) {
    if (!percorso || !percorso.trim()) return { ok: false, messaggio: 'Il percorso della libreria è vuoto.' };
    if (eIndirizzoWeb(percorso)) return caricaStatica(percorso, MSG_WEB);

    const p = normalizzaPercorso(percorso);
    const r = await chiamaApi('POST', '/api/libreria/apri', { percorso: p });
    if (!r.ok) {
        if (r.errore === 'percorso_non_valido') return caricaStatica(percorso, `${r.messaggio} Aperta in sola lettura.`);
        // Nessuna risposta dell'API (server fermo o server statico): si prova la lettura semplice
        if (r.stato === 0 || !r.dati) return caricaStatica(percorso, MSG_SERVER_ASSENTE);
        return { ok: false, messaggio: r.messaggio };
    }

    const d = r.dati;
    try {
        impostaLibreria(d.libreria);
    } catch (err) {
        return { ok: false, messaggio: err.message };
    }
    adotta({
        percorso: p,
        nomeFile: nomeFileDi(p),
        versione: d.versione,
        impronta: d.impronta,
        scrivibile: d.scrivibile,
        formato: d.formato,
        motivoSolaLettura: d.scrivibile ? '' : (d.avviso || MSG_FUORI_SHARED)
    }, avvisoDa(d));
    return { ok: true };
}

/* --- SALVATAGGIO DI UN BLOCCO --- */

async function invia(corpo, record) {
    salvataggioInCorso = true;
    aggiornaPulsantiLibreria();
    let r;
    try {
        r = await chiamaApi('POST', '/api/libreria/salva', corpo);
    } finally {
        salvataggioInCorso = false;
    }

    if (r.ok) {
        const d = r.dati;
        impostaLibreria(d.libreria);
        Object.assign(libreria, { versione: d.versione, impronta: d.impronta, formato: d.formato ?? libreria.formato });
        conflitto = null;
        const avviso = avvisoDa(d);
        impostaStatoLibreriaBanner(avviso ? { conflitto: false, avviso } : { conflitto: false });
        aggiornaPannelloLibreria();
        aggiornaPulsantiLibreria();
        record.alSuccesso(d);
        return { ok: true, dati: d };
    }
    if (r.errore === 'conflitto') {
        conflitto = { corpo, ...record };
        impostaStatoLibreriaBanner({ conflitto: true });
        aggiornaPulsantiLibreria();
        return { ok: false, conflitto: true };
    }
    aggiornaPulsantiLibreria();
    return { ok: false, messaggio: r.messaggio };
}

// Scrive il blocco su disco; alSuccesso(dati) aggiorna memoria e progetto solo dopo la risposta positiva
export async function salvaBloccoLibreria(richiesta, alSuccesso, aperto = {}) {
    if (!libreria.scrivibile) return { ok: false, messaggio: libreria.motivoSolaLettura || 'La libreria è in sola lettura.' };
    if (progettoInConflitto()) return { ok: false, messaggio: 'Risolvi prima il conflitto del progetto' };
    if (conflitto) return { ok: false, messaggio: MSG_CONFLITTO };
    if (salvataggioInCorso) return { ok: false, messaggio: 'Un salvataggio della libreria è già in corso.' };

    const corpo = { percorso: libreria.percorso, ...richiesta, improntaAttesa: libreria.impronta };
    if (libreria.formato === 0) corpo.base = appState.library;
    return invia(corpo, { alSuccesso, blockId: aperto.blockId || null, nodeId: aperto.nodeId || null });
}

/* --- CONFLITTO: RICARICA O SOVRASCRIVI --- */

export async function ricaricaLibreria() {
    const record = conflitto;
    const esito = await apriLibreria(libreria.percorso);
    if (!esito.ok) {
        alert(`Impossibile ricaricare la libreria: ${esito.messaggio}`);
        return;
    }
    render();
    // Si perdono solo le modifiche del form: il blocco si riapre dalla libreria su disco
    if (record?.blockId && appState.library[record.blockId]) {
        openLibraryBlock(record.blockId, record.nodeId);
    } else {
        const propsContent = document.getElementById('propsContent');
        if (propsContent) propsContent.innerHTML = `<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>`;
    }
}

export async function sovrascriviLibreria() {
    if (!conflitto) return;
    const { corpo, ...record } = conflitto;
    // Lo stesso corpo rifiutato, forzato: il server applica il blocco sulla libreria attuale su disco
    const esito = await invia({ ...corpo, forza: true }, record);
    if (esito.ok) return;
    conflitto = null;
    impostaStatoLibreriaBanner({ conflitto: false });
    aggiornaPulsantiLibreria();
    alert(`Salvataggio non riuscito: ${esito.messaggio}`);
}

/* --- PANNELLO E PULSANTI --- */

export function aggiornaPannelloLibreria() {
    const versione = document.getElementById('versioneLibreria');
    if (versione) versione.textContent = libreria.caricata ? (libreria.versione ? `v${libreria.versione}` : 'n/d') : '';

    const etichetta = document.getElementById('etichettaSolaLettura');
    if (etichetta) {
        etichetta.hidden = !libreria.caricata || libreria.scrivibile;
        etichetta.title = libreria.motivoSolaLettura;
    }

    const btnChangelog = document.getElementById('btnChangelog');
    if (btnChangelog) {
        btnChangelog.disabled = !libreria.percorso;
        btnChangelog.title = libreria.percorso
            ? 'Mostra il changelog della libreria'
            : "Il changelog è disponibile solo per le librerie aperte tramite l'app";
    }
}

// Salva e Crea copia dell'ispettore: disabilitati in sola lettura, Salva anche in conflitto e durante la richiesta
export function aggiornaPulsantiLibreria() {
    const solaLettura = libreria.scrivibile ? '' : (libreria.motivoSolaLettura || 'La libreria è in sola lettura.');
    const motivo = solaLettura || (conflitto ? MSG_CONFLITTO : '') || (salvataggioInCorso ? 'Salvataggio in corso…' : '');

    const btnSalva = document.getElementById('btnSaveBlockToLib');
    if (btnSalva) {
        btnSalva.disabled = !!motivo;
        btnSalva.title = motivo;
    }
    const btnCopia = document.getElementById('btnCreateCopy');
    if (btnCopia) {
        btnCopia.disabled = !!solaLettura;
        btnCopia.title = solaLettura;
    }
}

/* --- FINESTRA CHANGELOG --- */

function nomeCampo(campo) {
    return ETICHETTE_CAMPO[campo] || campo;
}

function elencoCampi(campi) {
    return Array.isArray(campi) && campi.length > 0 ? `: ${campi.map(c => escapeHtml(nomeCampo(c))).join(', ')}` : '';
}

function htmlRequisito(req) {
    const precedente = req.tipo === 'rinominato' && req.idPrecedente
        ? ` (prima <code>${escapeHtml(req.idPrecedente)}</code>)` : '';
    return `<li><code>${escapeHtml(req.id)}</code> ${escapeHtml(req.tipo)}${precedente}${elencoCampi(req.campi)}</li>`;
}

function htmlModifica(m) {
    const requisiti = Array.isArray(m.requisiti) ? m.requisiti : [];
    return `<li><strong>${escapeHtml(m.titolo || m.blocco)}</strong> <code>${escapeHtml(m.blocco)}</code> ${escapeHtml(m.tipo)}${elencoCampi(m.campiBlocco)}
        ${requisiti.length > 0 ? `<ul>${requisiti.map(htmlRequisito).join('')}</ul>` : ''}</li>`;
}

function htmlVoce(voce) {
    const modifiche = Array.isArray(voce.modifiche) ? voce.modifiche : [];
    const data = new Date(voce.data);
    const livello = voce.livello ? ETICHETTE_LIVELLO[voce.livello] || voce.livello : '';
    const forzato = voce.livello && voce.livelloCalcolato && voce.livello !== voce.livelloCalcolato
        ? ` (calcolato ${escapeHtml(ETICHETTE_LIVELLO[voce.livelloCalcolato] || voce.livelloCalcolato)})` : '';
    return `<div class="voce-changelog">
        <div class="voce-testata">
            <strong>v${escapeHtml(voce.versione)}</strong>
            <span>${escapeHtml(isNaN(data) ? String(voce.data ?? '') : data.toLocaleString('it-IT'))}</span>
            <span>${escapeHtml(voce.autore ?? '')}</span>
            <span class="voce-origine origine-${escapeHtml(voce.origine)}">${escapeHtml(ETICHETTE_ORIGINE[voce.origine] || voce.origine)}</span>
            ${livello ? `<span class="voce-livello livello-${escapeHtml(voce.livello)}">${escapeHtml(livello)}${forzato}</span>` : ''}
        </div>
        ${voce.nota ? `<div class="voce-nota">${escapeHtml(voce.nota)}</div>` : ''}
        ${modifiche.length > 0 ? `<ul class="voce-modifiche">${modifiche.map(htmlModifica).join('')}</ul>` : ''}
    </div>`;
}

// Una voce passa il filtro se una sua modifica tocca il blocco (id o titolo) o l'id di un requisito
function toccaFiltro(voce, testo) {
    const contiene = v => typeof v === 'string' && v.toLowerCase().includes(testo);
    return (Array.isArray(voce.modifiche) ? voce.modifiche : []).some(m =>
        contiene(m.blocco) || contiene(m.titolo) ||
        (Array.isArray(m.requisiti) ? m.requisiti : []).some(r => contiene(r.id) || contiene(r.idPrecedente)));
}

export async function mostraChangelog(filtroIniziale = '') {
    if (!libreria.percorso) {
        alert("Il changelog è disponibile solo per le librerie aperte tramite l'app.");
        return;
    }
    // Il changelog si legge solo all'apertura della finestra
    const r = await chiamaApi('GET', `/api/libreria/changelog?percorso=${encodeURIComponent(libreria.percorso)}`);
    if (!r.ok) {
        alert(`Impossibile leggere il changelog: ${r.messaggio}`);
        return;
    }
    const voci = [...r.dati.voci].reverse();
    const versione = r.dati.versione || libreria.versione;

    document.getElementById('modalTitle').textContent =
        `Changelog · ${libreria.nomeFile}${versione ? ` · v${versione}` : ''}`;
    document.getElementById('btnCloseModal').style.display = '';
    const contenuto = document.getElementById('modalContent');
    contenuto.innerHTML = `
        <input type="text" id="filtroChangelog" placeholder="Filtra per blocco (id o titolo) o id requisito..." class="filtro-changelog">
        <div id="vociChangelog"></div>`;

    const filtro = document.getElementById('filtroChangelog');
    const elenco = document.getElementById('vociChangelog');
    const disegna = () => {
        const testo = filtro.value.trim().toLowerCase();
        const filtrate = testo ? voci.filter(v => toccaFiltro(v, testo)) : voci;
        elenco.innerHTML = filtrate.length > 0
            ? filtrate.map(htmlVoce).join('')
            : `<p class="empty-props">${voci.length > 0 ? 'Nessuna voce corrisponde al filtro.' : 'Il changelog è vuoto.'}</p>`;
    };
    filtro.value = filtroIniziale;
    filtro.addEventListener('input', disegna);
    disegna();
    document.getElementById('reportModal').style.display = 'flex';
    filtro.focus();
}
