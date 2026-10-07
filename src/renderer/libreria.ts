/* --- LIBRERIA SU DISCO: APERTURA, SALVATAGGIO PER BLOCCO, CONFLITTI, SOLA LETTURA E CHANGELOG --- */

import { appState } from './state.js';
import { render } from './renderer.js';
import { impostaLibreria } from './builder.js';
import { openLibraryBlock } from './inspector.js';
import { progettoInConflitto, impostaStatoLibreriaBanner } from './progetto.js';
import { chiamaApi } from './api.js';
import { escapeHtml, messaggioDi } from './utils.js';
import { mostraPannello, pannelloVisibile, allaVista } from './pannelli.js';

/* --- Forme delle risposte dell'API delle librerie (spec 0002, 0010, 0018) --- */

export interface ModificaRequisitoChangelog {
    id: string;
    tipo: string;
    idPrecedente?: string;
    campi?: string[];
}

export interface ModificaChangelog {
    blocco: string;
    titolo?: string;
    tipo: string;
    idPrecedente?: string;
    campiBlocco?: string[];
    requisiti?: ModificaRequisitoChangelog[];
}

export interface VoceChangelog {
    versione: string;
    data: string;
    autore?: string;
    origine: string;
    livello: string | null;
    livelloCalcolato: string | null;
    nota: string;
    modifiche?: ModificaChangelog[];
}

export interface RispostaLibreria {
    libreria: unknown;
    impronta: string;
    versione: string | null;
    scrivibile?: boolean;
    formato?: number;
    vociAggiunte?: VoceChangelog[];
    avviso?: string;
    // Solo dopo un salvataggio: la voce aggiunta al changelog (null se il changelog non si è aggiornato)
    voce?: VoceChangelog | null;
    invariata?: boolean;
}

export type EsitoLibreria = { ok: true; dati?: RispostaLibreria } | { ok: false; conflitto?: boolean; messaggio?: string };

type AlSuccesso = (dati: RispostaLibreria) => void;

interface RecordSalvataggio {
    alSuccesso: AlSuccesso;
    blockId: string | null;
    nodeId: string | null;
}

const MSG_FUORI_SHARED = "La libreria è fuori dalla cartella shared/: l'app può solo leggerla.";
const MSG_WEB = "Libreria caricata da un indirizzo web: l'app può solo leggerla.";
const MSG_SERVER_ASSENTE = 'Server delle librerie non raggiungibile: la libreria è aperta in sola lettura.';
const MSG_CONFLITTO = 'La libreria è cambiata su disco: scegli "Ricarica la libreria" o "Sovrascrivi" nel banner.';

const ETICHETTE_ORIGINE: Record<string, string> = { app: 'App', esterna: 'Modifica esterna', iniziale: 'Voce iniziale' };
const ETICHETTE_LIVELLO: Record<string, string> = { major: 'Major', minor: 'Minor', patch: 'Patch' };
const ETICHETTE_CAMPO: Record<string, string> = {
    metodoVerifica: 'metodo di verifica',
    testiExport: 'testi da esportare',
    ordineRequisiti: 'ordine dei requisiti',
    interno: 'interno standard'
};

// Stato della libreria in memoria: cambia solo quando un caricamento o un salvataggio riesce.
// percorso è null per le librerie lette senza API (indirizzo web o percorso rifiutato)
const libreria = {
    caricata: false,
    percorso: null as string | null,
    nomeFile: '',
    versione: null as string | null,
    impronta: null as string | null,
    scrivibile: false,
    formato: 1,
    motivoSolaLettura: ''
};

// Il salvataggio rifiutato con 409: stessa rotta e stesso corpo per Sovrascrivi
let conflitto: (RecordSalvataggio & { rotta: string; corpo: Record<string, unknown> }) | null = null;
let salvataggioInCorso = false;

// Nome del file e versione della libreria caricata, per l'intestazione della matrice esportata (spec 0006)
export function infoLibreria(): { nomeFile: string; versione: string | null } {
    if (!libreria.caricata) return { nomeFile: '', versione: null };
    return { nomeFile: libreria.nomeFile, versione: libreria.versione };
}

/* --- PERCORSI --- */

function eIndirizzoWeb(percorso: string): boolean {
    return /^(https?:|\/\/)/i.test(percorso.trim());
}

// Forma usata dall'API: \ diventa /, senza ./ e / iniziali, senza ?… e #…
export function normalizzaPercorso(percorso: string): string {
    let p = percorso.trim().replace(/\\/g, '/').replace(/[?#].*$/, '');
    while (p.startsWith('./') || p.startsWith('/')) p = p.startsWith('./') ? p.slice(2) : p.slice(1);
    return p;
}

function nomeFileDi(percorso: string): string {
    return percorso.replace(/[?#].*$/, '').split(/[\\/]/).pop() || percorso;
}

/* --- CARICAMENTO --- */

function avvisoDa(dati: RispostaLibreria): string {
    const parti: string[] = [];
    const esterne = (dati.vociAggiunte || []).filter((v) => v.origine === 'esterna');
    const ultima = esterne.at(-1);
    if (ultima) parti.push(`La libreria è stata modificata fuori dall'app: registrata come versione ${ultima.versione}`);
    if (dati.avviso) parti.push(dati.avviso);
    return parti.join('. ');
}

function adotta(nuovoStato: Partial<typeof libreria>, avviso: string): void {
    Object.assign(libreria, { caricata: true, ...nuovoStato });
    conflitto = null;
    // L'avviso di un caricamento resta fino al caricamento successivo
    impostaStatoLibreriaBanner({ conflitto: false, avviso });
    aggiornaPannelloLibreria();
    aggiornaPulsantiLibreria();
    segnaChangelogDaAggiornare();
}

// Lettura statica senza API, sempre in sola lettura
async function caricaStatica(percorso: string, motivo: string): Promise<EsitoLibreria> {
    try {
        const risposta = await fetch(percorso);
        if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
        impostaLibreria(await risposta.json());
    } catch (err) {
        return { ok: false, messaggio: `Impossibile leggere "${percorso}": ${messaggioDi(err)}` };
    }
    adotta({
        percorso: null, nomeFile: nomeFileDi(percorso), versione: null, impronta: null,
        scrivibile: false, formato: 1, motivoSolaLettura: motivo
    }, '');
    return { ok: true };
}

// Carica una libreria; restituisce { ok, messaggio }. Se non riesce restano libreria e stato precedenti
export async function apriLibreria(percorso: string | null | undefined): Promise<EsitoLibreria> {
    if (!percorso || !percorso.trim()) return { ok: false, messaggio: 'Il percorso della libreria è vuoto.' };
    if (eIndirizzoWeb(percorso)) return caricaStatica(percorso, MSG_WEB);

    const p = normalizzaPercorso(percorso);
    const r = await chiamaApi<RispostaLibreria>('POST', '/api/libreria/apri', { percorso: p });
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
        return { ok: false, messaggio: messaggioDi(err) };
    }
    adotta({
        percorso: p,
        nomeFile: nomeFileDi(p),
        versione: d.versione,
        impronta: d.impronta,
        scrivibile: d.scrivibile === true,
        formato: d.formato ?? 1,
        motivoSolaLettura: d.scrivibile ? '' : (d.avviso || MSG_FUORI_SHARED)
    }, avvisoDa(d));
    return { ok: true };
}

/* --- SALVATAGGIO DI UN BLOCCO --- */

// rotta: '/api/libreria/salva', '/api/libreria/elimina' o '/api/libreria/rinomina' (spec 0010)
async function invia(rotta: string, corpo: Record<string, unknown>, record: RecordSalvataggio): Promise<EsitoLibreria> {
    salvataggioInCorso = true;
    aggiornaPulsantiLibreria();
    let r;
    try {
        r = await chiamaApi<RispostaLibreria>('POST', rotta, corpo);
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
        segnaChangelogDaAggiornare();
        record.alSuccesso(d);
        return { ok: true, dati: d };
    }
    if (r.errore === 'conflitto') {
        conflitto = { rotta, corpo, ...record };
        impostaStatoLibreriaBanner({ conflitto: true });
        aggiornaPulsantiLibreria();
        return { ok: false, conflitto: true };
    }
    aggiornaPulsantiLibreria();
    return { ok: false, messaggio: r.messaggio };
}

// Motivo per cui ora non si può scrivere la libreria, o null
function motivoBlocco(): string | null {
    if (!libreria.scrivibile) return libreria.motivoSolaLettura || 'La libreria è in sola lettura.';
    if (progettoInConflitto()) return 'Risolvi prima il conflitto del progetto';
    if (conflitto) return MSG_CONFLITTO;
    if (salvataggioInCorso) return 'Un salvataggio della libreria è già in corso.';
    return null;
}

interface Aperto {
    blockId?: string | null;
    nodeId?: string | null;
}

// Scrive il blocco su disco; alSuccesso(dati) aggiorna memoria e progetto solo dopo la risposta positiva
export async function salvaBloccoLibreria(richiesta: Record<string, unknown>, alSuccesso: AlSuccesso, aperto: Aperto = {}): Promise<EsitoLibreria> {
    const motivo = motivoBlocco();
    if (motivo) return { ok: false, messaggio: motivo };

    const corpo: Record<string, unknown> = { percorso: libreria.percorso, ...richiesta, improntaAttesa: libreria.impronta };
    if (libreria.formato === 0) corpo.base = appState.library;
    return invia('/api/libreria/salva', corpo, { alSuccesso, blockId: aperto.blockId || null, nodeId: aperto.nodeId || null });
}

// Elimina un blocco dalla libreria su disco (spec 0010); opzioni = { livello, nota }
export async function eliminaBloccoLibreria(idBlocco: string, opzioni: Record<string, unknown>, alSuccesso: AlSuccesso): Promise<EsitoLibreria> {
    const motivo = motivoBlocco();
    if (motivo) return { ok: false, messaggio: motivo };
    const corpo = { percorso: libreria.percorso, idBlocco, ...opzioni, improntaAttesa: libreria.impronta };
    return invia('/api/libreria/elimina', corpo, { alSuccesso, blockId: null, nodeId: null });
}

// Rinomina l'id di un blocco sul disco (spec 0010); alSuccesso aggiorna le istanze del progetto
export async function rinominaBloccoLibreria(idBlocco: string, nuovoId: string, opzioni: Record<string, unknown>, alSuccesso: AlSuccesso, aperto: Aperto = {}): Promise<EsitoLibreria> {
    const motivo = motivoBlocco();
    if (motivo) return { ok: false, messaggio: motivo };
    const corpo = { percorso: libreria.percorso, idBlocco, nuovoId, ...opzioni, improntaAttesa: libreria.impronta };
    return invia('/api/libreria/rinomina', corpo, { alSuccesso, blockId: nuovoId, nodeId: aperto.nodeId || null });
}

/* --- CONFLITTO: RICARICA O SOVRASCRIVI --- */

export async function ricaricaLibreria(): Promise<void> {
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
        if (propsContent) propsContent.innerHTML = '<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>';
    }
}

export async function sovrascriviLibreria(): Promise<void> {
    if (!conflitto) return;
    const { rotta, corpo, ...record } = conflitto;
    // Lo stesso corpo rifiutato, forzato, alla stessa rotta: il server lo applica sulla libreria attuale su disco
    const esito = await invia(rotta, { ...corpo, forza: true }, record);
    if (esito.ok) return;
    conflitto = null;
    impostaStatoLibreriaBanner({ conflitto: false });
    aggiornaPulsantiLibreria();
    alert(`Salvataggio non riuscito: ${esito.messaggio}`);
}

/* --- PANNELLO E PULSANTI --- */

export function aggiornaPannelloLibreria(): void {
    const versione = document.getElementById('versioneLibreria');
    if (versione) versione.textContent = libreria.caricata ? (libreria.versione ? `v${libreria.versione}` : 'n/d') : '';

    const etichetta = document.getElementById('etichettaSolaLettura');
    if (etichetta) {
        etichetta.hidden = !libreria.caricata || libreria.scrivibile;
        etichetta.dataset.titoloNativo = libreria.motivoSolaLettura || '';
    }

    const btnChangelog = document.getElementById('btnChangelog') as HTMLButtonElement | null;
    if (btnChangelog) {
        btnChangelog.disabled = !libreria.percorso;
        btnChangelog.dataset.titoloNativo = libreria.percorso
            ? ''
            : "Il changelog è disponibile solo per le librerie aperte tramite l'app";
    }
}

// Salva e Crea copia dell'ispettore: disabilitati in sola lettura, Salva anche in conflitto e durante la richiesta.
// Il motivo va in data-titolo-nativo: il suggerimento dell'aiuto lo mostra come riga in più (spec 0012)
export function aggiornaPulsantiLibreria(): void {
    const solaLettura = libreria.scrivibile ? '' : (libreria.motivoSolaLettura || 'La libreria è in sola lettura.');
    const motivo = solaLettura || (conflitto ? MSG_CONFLITTO : '') || (salvataggioInCorso ? 'Salvataggio in corso…' : '');

    const btnSalva = document.getElementById('btnSaveBlockToLib') as HTMLButtonElement | null;
    if (btnSalva) {
        btnSalva.disabled = !!motivo;
        btnSalva.dataset.titoloNativo = motivo;
    }
    const btnCopia = document.getElementById('btnCreateCopy') as HTMLButtonElement | null;
    if (btnCopia) {
        btnCopia.disabled = !!solaLettura;
        btnCopia.dataset.titoloNativo = solaLettura;
    }
    // Elimina e Rinomina ID seguono Salva (spec 0010, AC-1)
    const btnElimina = document.getElementById('btnEliminaBloccoLib') as HTMLButtonElement | null;
    if (btnElimina) {
        btnElimina.disabled = !!motivo;
        btnElimina.dataset.titoloNativo = motivo;
    }
    const lnkRinomina = document.getElementById('lnkRinominaBlocco');
    if (lnkRinomina) {
        lnkRinomina.classList.toggle('disattivato', !!motivo);
        lnkRinomina.setAttribute('aria-disabled', motivo ? 'true' : 'false');
        lnkRinomina.dataset.titoloNativo = motivo;
    }
    // Interno standard (spec 0034): come Salva, più un motivo proprio del pulsante (es. interno vuoto)
    ['btnSalvaInterno', 'btnTogliInterno'].forEach((id) => {
        const pulsante = document.getElementById(id) as HTMLButtonElement | null;
        if (!pulsante) return;
        const ragione = motivo || pulsante.dataset.motivoProprio || '';
        pulsante.disabled = !!ragione;
        pulsante.dataset.titoloNativo = ragione;
    });
}

/* --- FINESTRA CHANGELOG --- */

function nomeCampo(campo: string): string {
    return ETICHETTE_CAMPO[campo] || campo;
}

function elencoCampi(campi: string[] | undefined): string {
    return Array.isArray(campi) && campi.length > 0 ? `: ${campi.map((c) => escapeHtml(nomeCampo(c))).join(', ')}` : '';
}

function htmlRequisito(req: ModificaRequisitoChangelog): string {
    const precedente = req.tipo === 'rinominato' && req.idPrecedente
        ? ` (prima <code>${escapeHtml(req.idPrecedente)}</code>)` : '';
    return `<li><code>${escapeHtml(req.id)}</code> ${escapeHtml(req.tipo)}${precedente}${elencoCampi(req.campi)}</li>`;
}

function htmlModifica(m: ModificaChangelog): string {
    const requisiti = Array.isArray(m.requisiti) ? m.requisiti : [];
    const precedente = m.idPrecedente ? ` (prima <code>${escapeHtml(m.idPrecedente)}</code>)` : '';
    return `<li><strong>${escapeHtml(m.titolo || m.blocco)}</strong> <code>${escapeHtml(m.blocco)}</code> ${escapeHtml(m.tipo)}${precedente}${elencoCampi(m.campiBlocco)}
        ${requisiti.length > 0 ? `<ul>${requisiti.map(htmlRequisito).join('')}</ul>` : ''}</li>`;
}

function htmlVoce(voce: VoceChangelog): string {
    const modifiche = Array.isArray(voce.modifiche) ? voce.modifiche : [];
    const data = new Date(voce.data);
    const livello = voce.livello ? ETICHETTE_LIVELLO[voce.livello] || voce.livello : '';
    const forzato = voce.livello && voce.livelloCalcolato && voce.livello !== voce.livelloCalcolato
        ? ` (calcolato ${escapeHtml(ETICHETTE_LIVELLO[voce.livelloCalcolato] || voce.livelloCalcolato)})` : '';
    return `<div class="voce-changelog">
        <div class="voce-testata">
            <strong>v${escapeHtml(voce.versione)}</strong>
            <span>${escapeHtml(Number.isNaN(data.getTime()) ? String(voce.data ?? '') : data.toLocaleString('it-IT'))}</span>
            <span>${escapeHtml(voce.autore ?? '')}</span>
            <span class="voce-origine origine-${escapeHtml(voce.origine)}">${escapeHtml(ETICHETTE_ORIGINE[voce.origine] || voce.origine)}</span>
            ${livello ? `<span class="voce-livello livello-${escapeHtml(voce.livello)}">${escapeHtml(livello)}${forzato}</span>` : ''}
        </div>
        ${voce.nota ? `<div class="voce-nota">${escapeHtml(voce.nota)}</div>` : ''}
        ${modifiche.length > 0 ? `<ul class="voce-modifiche">${modifiche.map(htmlModifica).join('')}</ul>` : ''}
    </div>`;
}

// Una voce passa il filtro se una sua modifica tocca il blocco (id o titolo) o l'id di un requisito
function toccaFiltro(voce: VoceChangelog, testo: string): boolean {
    const contiene = (v: unknown) => typeof v === 'string' && v.toLowerCase().includes(testo);
    return (Array.isArray(voce.modifiche) ? voce.modifiche : []).some((m) =>
        contiene(m.blocco) || contiene(m.titolo) || contiene(m.idPrecedente) ||
        (Array.isArray(m.requisiti) ? m.requisiti : []).some((r) => contiene(r.id) || contiene(r.idPrecedente)));
}

/* --- PANNELLO CHANGELOG (spec 0022) --- */

let vociChangelog: VoceChangelog[] = [];
let changelogDaAggiornare = false;
let letturaChangelog = 0;

function disegnaChangelog(): void {
    const filtro = document.getElementById('filtroChangelog') as HTMLInputElement | null;
    const elenco = document.getElementById('vociChangelog');
    if (!filtro || !elenco) return;
    const testo = filtro.value.trim().toLowerCase();
    const filtrate = testo ? vociChangelog.filter((v) => toccaFiltro(v, testo)) : vociChangelog;
    elenco.innerHTML = filtrate.length > 0
        ? filtrate.map(htmlVoce).join('')
        : `<p class="empty-props">${vociChangelog.length > 0 ? 'Nessuna voce corrisponde al filtro.' : 'Il changelog è vuoto.'}</p>`;
}

// Rilegge dal disco; una risposta arrivata dopo una lettura più recente si scarta
async function caricaChangelog(): Promise<void> {
    changelogDaAggiornare = false;
    const titolo = document.getElementById('changelogTitolo');
    const elenco = document.getElementById('vociChangelog');
    if (!titolo || !elenco) return;
    const numero = ++letturaChangelog;
    if (!libreria.percorso) {
        vociChangelog = [];
        titolo.textContent = 'Changelog';
        elenco.innerHTML = `<p class="empty-props">Il changelog è disponibile solo per le librerie aperte tramite l'app.</p>`;
        return;
    }
    const r = await chiamaApi<{ versione: string | null; voci: VoceChangelog[] }>('GET', `/api/libreria/changelog?percorso=${encodeURIComponent(libreria.percorso)}`);
    if (numero !== letturaChangelog) return;
    if (!r.ok) {
        vociChangelog = [];
        elenco.innerHTML = `<p class="empty-props">${escapeHtml(`Impossibile leggere il changelog: ${r.messaggio}`)}</p>`;
        return;
    }
    vociChangelog = [...r.dati.voci].reverse();
    const versione = r.dati.versione || libreria.versione;
    titolo.textContent = `${libreria.nomeFile}${versione ? ` · v${versione}` : ''}`;
    disegnaChangelog();
}

// Apre il pannello (o lo porta in primo piano) con il filtro dato: vuoto dal pulsante, l'id del blocco dall'Ispettore
export async function mostraChangelog(filtroIniziale = ''): Promise<void> {
    const filtro = document.getElementById('filtroChangelog') as HTMLInputElement | null;
    if (filtro) filtro.value = filtroIniziale;
    changelogDaAggiornare = true;
    mostraPannello('changelog');
    // Se era già visibile allaVista non è partita: la lettura la facciamo qui
    if (changelogDaAggiornare) await caricaChangelog();
    filtro?.focus();
}

// Ogni cambio di stato della libreria (salvataggio, ricarica, un'altra libreria): rilegge se il pannello si vede
function segnaChangelogDaAggiornare(): void {
    changelogDaAggiornare = true;
    if (pannelloVisibile('changelog')) void caricaChangelog();
}

export function initChangelog(): void {
    document.getElementById('filtroChangelog')?.addEventListener('input', disegnaChangelog);
    allaVista('changelog', () => { if (changelogDaAggiornare || !letturaChangelog) void caricaChangelog(); });
}
