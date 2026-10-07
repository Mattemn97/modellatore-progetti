/* --- REQUISITI CLIENTE: IMPORT DA EXCEL O CSV, CONFRONTO COL PRECEDENTE, SCHEDA CLIENTE E CONTROLLI ALL'APERTURA --- */

// Formato in appState.cliente e nel file del progetto (spec 0003): vedi Cliente in tipi.ts.
// Alla radice i requisiti cliente sono i blocchi tondi del padre virtuale ID_CLIENTE.

import { appState, appSettings, pathStack } from './state.js';
import { render, posizioneInColonna } from './renderer.js';
import { svuota, progettoAperto, progettoInConflitto } from './progetto.js';
import { chiamaApi } from './api.js';
import { mostraDettaglioCliente } from './inspector.js';
import { verificaCompatibilita, getTipologie, getColoreRequisito, titoloRequisito, type Estremo } from './model.js';
import { escapeHtml, messaggioDi } from './utils.js';
import { iconaAiuto } from './aiuto.js';
import { allaVista, pannelloVisibile } from './pannelli.js';
import type { Cliente, Grafo, Libreria, Punto, Requisito, RequisitoCliente, TipoEstremo, UltimoImport } from './tipi.js';

type ChiaveCampo = 'id' | 'testo' | 'titolo' | 'note' | 'sezione' | 'tipologia';

const CAMPI: Array<{ chiave: ChiaveCampo; etichetta: string; obbligatorio?: boolean }> = [
    { chiave: 'id', etichetta: 'ID', obbligatorio: true },
    { chiave: 'testo', etichetta: 'Testo', obbligatorio: true },
    { chiave: 'titolo', etichetta: 'Titolo' },
    { chiave: 'note', etichetta: 'Note' },
    { chiave: 'sezione', etichetta: 'Sezione' },
    { chiave: 'tipologia', etichetta: 'Tipologia' }
];
// I campi il cui cambiamento accende "modificato"; note e sezione si aggiornano in silenzio
const CAMPI_CONFRONTO = ['testo', 'titolo', 'tipologia'] as const;
const ATTESA_RICERCA = 200;

/* --- Forme dei dati dell'import --- */

export interface Foglio {
    nome: string;
    nascosto: boolean;
    righe: string[][];
}

export interface FileLetto {
    formato: 'csv' | 'xlsx';
    fogli: Foglio[];
}

interface Colonna {
    indice: number;
    lettera: string;
    nome: string;
}

interface Riferimento {
    nome: string;
    lettera: string;
}

type Colonne = Partial<Record<ChiaveCampo, number | null>>;

export interface RigaImport {
    riga: number;
    idCliente: string | null;
    testo: string | null;
    titolo: string | null;
    note: string | null;
    sezione: string | null;
    tipologia: string | null;
}

type RigaValida = RigaImport & { idCliente: string; testo: string };

interface Scartata {
    riga: number;
    idCliente: string;
    motivo: string;
}

export interface Conteggi {
    esclusi?: number;
    nuovi: number;
    modificati: number;
    riattivati: number;
    ritirati: number;
    invariati: number;
    scartati: number;
    filiPersi: number;
}

export interface RisultatoImport {
    requisiti: RequisitoCliente[];
    conteggi: Conteggi;
    liste: { modificati: Array<{ prima: RequisitoCliente; dopo: RequisitoCliente }>; ritirati: RequisitoCliente[]; nuovi: RequisitoCliente[] };
    filiPersi: string[];
}

/* --- FORMA DEI DATI SALVATI --- */

// Primo problema della chiave cliente di un file progetto, oppure null. Assente o null = nessun requisito cliente
export function problemaCliente(cliente: unknown): string | null {
    if (cliente === undefined || cliente === null) return null;
    if (typeof cliente !== 'object' || Array.isArray(cliente)) return 'la chiave "cliente" non è un oggetto';
    const c = cliente as Record<string, unknown>;
    if (typeof c.prefisso !== 'string' || !c.prefisso) return 'manca il prefisso dei requisiti cliente';
    if (!Array.isArray(c.requisiti)) return 'i requisiti cliente non sono un elenco';
    const ids = new Set<unknown>();
    const idsCliente = new Set<unknown>();
    for (const grezzo of c.requisiti as unknown[]) {
        if (!grezzo || typeof grezzo !== 'object') return 'un requisito cliente non è un oggetto';
        const r = grezzo as Record<string, unknown>;
        if (typeof r.idCliente !== 'string' || !r.idCliente) return 'un requisito cliente non ha l\'ID del cliente';
        if (r.id !== c.prefisso + r.idCliente) return `l'id "${String(r.id)}" non è il prefisso più l'ID del cliente "${r.idCliente}"`;
        if (typeof r.testo !== 'string' || !r.testo) return `il requisito cliente "${r.idCliente}" non ha testo`;
        for (const campo of ['titolo', 'note', 'sezione', 'tipologia']) {
            if (r[campo] !== undefined && r[campo] !== null && typeof r[campo] !== 'string') {
                return `il campo ${campo} del requisito cliente "${r.idCliente}" non è un testo`;
            }
        }
        if (r.stato !== 'attivo' && r.stato !== 'ritirato') return `il requisito cliente "${r.idCliente}" ha uno stato sconosciuto`;
        if (ids.has(r.id) || idsCliente.has(r.idCliente)) return `l'ID del cliente "${r.idCliente}" compare due volte`;
        ids.add(r.id);
        idsCliente.add(r.idCliente);
    }
    return null;
}

// Completa i campi facoltativi (già validati con problemaCliente), così la sola apertura non genera salvataggi
export function completaCliente(cliente: Cliente | null): Cliente | null {
    if (!cliente) return null;
    cliente.requisiti.forEach((r) => {
        const campi = r as unknown as Record<string, unknown>;
        (['titolo', 'note', 'sezione', 'tipologia'] as const).forEach((campo) => { if (campi[campo] === undefined || campi[campo] === '') campi[campo] = null; });
        r.modificato = r.modificato === true;
        if (!r.modificato || !r.precedente || typeof r.precedente !== 'object') {
            r.precedente = r.modificato ? { testo: r.testo, titolo: r.titolo, tipologia: r.tipologia } : null;
        }
    });
    if (cliente.ultimoImport === undefined) cliente.ultimoImport = null;
    return cliente;
}

/* --- CONTEGGI SUL MODELLO --- */

// id cliente → numero di fili della radice che lo usano
export function contaFiliCliente(): Map<string, number> {
    const conteggi = new Map<string, number>();
    pathStack[0]!.graph.edges.forEach((edge) => {
        if (edge.sourceType === 'parent') conteggi.set(edge.sourceHandle, (conteggi.get(edge.sourceHandle) || 0) + 1);
        if (edge.targetType === 'parent') conteggi.set(edge.targetHandle, (conteggi.get(edge.targetHandle) || 0) + 1);
    });
    return conteggi;
}

export function trovaRequisitoCliente(id: string): RequisitoCliente | null {
    return appState.cliente?.requisiti.find((r) => r.id === id) || null;
}

function idLibreria(library: Libreria): Set<string> {
    const ids = new Set<string>();
    Object.values(library).forEach((b) => b.requisiti.forEach((r) => ids.add(r.id)));
    return ids;
}

/* --- CONTROLLI ALL'APERTURA --- */

// Fili verso id cliente che non esistono più: rimossi. Fili senza posizione del blocco tondo: posizione in colonna.
// Id cliente uguali a id della libreria: avviso. Restituisce { cambiato, avviso }
export function controllaClienteAllApertura(): { cambiato: boolean; avviso: string } {
    const radice = pathStack[0]!.graph;
    const esistenti = new Set((appState.cliente?.requisiti || []).map((r) => r.id));
    const orfano = (tipo: TipoEstremo, handle: string) => tipo === 'parent' && !esistenti.has(handle);
    const prima = radice.edges.length;
    radice.edges = radice.edges.filter((e) => !orfano(e.sourceType, e.sourceHandle) && !orfano(e.targetType, e.targetHandle));
    let cambiato = radice.edges.length !== prima;

    if (!radice.parentReqPositions) radice.parentReqPositions = {};
    const posizioni = radice.parentReqPositions;
    const senzaPosizione = new Set<string>();
    radice.edges.forEach((e) => {
        if (e.sourceType === 'parent' && !posizioni[e.sourceHandle]) senzaPosizione.add(e.sourceHandle);
        if (e.targetType === 'parent' && !posizioni[e.targetHandle]) senzaPosizione.add(e.targetHandle);
    });
    if (senzaPosizione.size > 0) {
        const occupati = new Set(Object.values(posizioni).map((p) => `${p.x},${p.y}`));
        let idx = 0;
        senzaPosizione.forEach((id) => {
            let pos = posizioneInColonna(idx);
            while (occupati.has(`${pos.x},${pos.y}`)) pos = posizioneInColonna(++idx);
            posizioni[id] = pos;
            occupati.add(`${pos.x},${pos.y}`);
        });
        cambiato = true;
    }

    const libreria = idLibreria(appState.library);
    const collisioni = (appState.cliente?.requisiti || []).filter((r) => libreria.has(r.id)).map((r) => r.id);
    const avviso = collisioni.length > 0
        ? `Questi id dei requisiti cliente coincidono con id della libreria aperta: ${collisioni.join(', ')}`
        : '';
    return { cambiato, avviso };
}

/* --- LETTURA DEL FILE --- */

function comeBase64(file: File): Promise<string> {
    return new Promise((risolvi, rifiuta) => {
        const lettore = new FileReader();
        lettore.onload = () => risolvi(String(lettore.result).split(',')[1] || '');
        lettore.onerror = () => rifiuta(lettore.error);
        lettore.readAsDataURL(file);
    });
}

// Restituisce { ok, dati: { formato, fogli } } oppure { ok: false, messaggio }
export async function leggiFileCliente(file: File): Promise<{ ok: true; dati: FileLetto } | { ok: false; messaggio: string }> {
    const max = appSettings.cliente.maxFileMB;
    if (file.size > max * 1048576) {
        return { ok: false, messaggio: `Il file supera il limite di ${max} MB (cliente.maxFileMB in settings.json).` };
    }
    if (file.size === 0) return { ok: false, messaggio: 'Il file è vuoto.' };
    let contenuto: string;
    try {
        contenuto = await comeBase64(file);
    } catch (err) {
        return { ok: false, messaggio: `Impossibile leggere il file: ${messaggioDi(err)}` };
    }
    const r = await chiamaApi<FileLetto>('POST', '/api/cliente/leggi', { nomeFile: file.name, contenuto });
    if (!r.ok) {
        return { ok: false, messaggio: r.stato === 0 ? "Server non raggiungibile: avvia l'app con start.py." : r.messaggio };
    }
    return { ok: true, dati: r.dati };
}

/* --- COLONNE, RIGHE E VALIDAZIONE --- */

export function letteraColonna(indice: number): string {
    let lettere = '';
    for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
        lettere = String.fromCharCode(65 + ((n - 1) % 26)) + lettere;
    }
    return lettere;
}

// Colonne del foglio viste dalla riga di intestazione (da 1)
function colonneDelFoglio(foglio: Foglio, rigaIntestazione: number): Colonna[] {
    const larghezza = foglio.righe.reduce((max, riga) => Math.max(max, riga.length), 0);
    const intestazione = foglio.righe[rigaIntestazione - 1] || [];
    return Array.from({ length: larghezza }, (_, indice) => ({
        indice,
        lettera: letteraColonna(indice),
        nome: String(intestazione[indice] ?? '').trim()
    }));
}

// Colonna proposta per un riferimento { nome, lettera }: per nome se unico nella riga, altrimenti per lettera
function trovaColonna(colonne: Colonna[], riferimento: Riferimento | null | undefined): number | null {
    if (!riferimento) return null;
    const perNome = riferimento.nome ? colonne.filter((c) => c.nome === riferimento.nome) : [];
    if (perNome.length === 1) return perNome[0]?.indice ?? null;
    return colonne.find((c) => c.lettera === riferimento.lettera)?.indice ?? null;
}

// Filtro delle righe (spec 0030): la cella della colonna deve contenere il testo, o uno dei valori separati da ";"
export interface FiltroRighe {
    colonna: number | null;
    testo: string;
}

export interface Esclusa {
    riga: number;
    idCliente: string | null;
    valore: string;
}

function valoriFiltro(testo: string): string[] {
    return testo.split(';').map((v) => v.trim().toLowerCase()).filter((v) => v !== '');
}

export function filtroAttivo(filtro: FiltroRighe | null | undefined): filtro is FiltroRighe & { colonna: number } {
    return !!filtro && filtro.colonna !== null && valoriFiltro(filtro.testo).length > 0;
}

// Senza maiuscole e minuscole e senza spazi ai lati; un testo vuoto lascia passare tutto
export function passaFiltro(cella: string, testo: string): boolean {
    const valori = valoriFiltro(testo);
    if (valori.length === 0) return true;
    const contenuto = cella.trim().toLowerCase();
    return valori.some((v) => contenuto.includes(v));
}

// Righe dati sotto l'intestazione, mappate sui campi; le righe del tutto vuote sono ignorate,
// quelle che non passano il filtro finiscono fra le escluse
export function estraiRighe(foglio: Foglio, rigaIntestazione: number, colonne: Colonne,
    filtro: FiltroRighe | null = null): { righe: RigaImport[]; escluse: Esclusa[] } {
    const righe: RigaImport[] = [];
    const escluse: Esclusa[] = [];
    const attivo = filtroAttivo(filtro);
    for (let i = rigaIntestazione; i < foglio.righe.length; i++) {
        const celle = foglio.righe[i] ?? [];
        if (!celle.some((c) => String(c ?? '').trim() !== '')) continue;
        if (attivo) {
            const valore = String(celle[filtro.colonna] ?? '');
            if (!passaFiltro(valore, filtro.testo)) {
                const indiceId = colonne.id;
                const id = indiceId === null || indiceId === undefined ? '' : String(celle[indiceId] ?? '').trim();
                escluse.push({ riga: i + 1, idCliente: id || null, valore: valore.trim() });
                continue;
            }
        }
        const valore = (chiave: ChiaveCampo): string | null => {
            const indice = colonne[chiave];
            if (indice === null || indice === undefined) return null;
            return String(celle[indice] ?? '').trim() || null;
        };
        righe.push({
            riga: i + 1,
            idCliente: valore('id'),
            testo: valore('testo'),
            titolo: valore('titolo'),
            note: valore('note'),
            sezione: valore('sezione'),
            tipologia: valore('tipologia')
        });
    }
    return { righe, escluse };
}

// Scarta una riga per il primo motivo che vale: ID vuoto, testo vuoto, tipologia sconosciuta, ID ripetuto, id della libreria
export function validaRighe(righe: RigaImport[], prefisso: string, library: Libreria): { valide: RigaValida[]; scartate: Scartata[] } {
    const tipologie = new Map(getTipologie().map((t) => [t.toLowerCase(), t]));
    const libreria = idLibreria(library);
    const ripetizioni = new Map<string, number>();
    righe.forEach((r) => { if (r.idCliente) ripetizioni.set(r.idCliente, (ripetizioni.get(r.idCliente) || 0) + 1); });

    const valide: RigaValida[] = [];
    const scartate: Scartata[] = [];
    righe.forEach((r) => {
        let motivo: string | null = null;
        const volte = r.idCliente ? ripetizioni.get(r.idCliente) ?? 0 : 0;
        if (!r.idCliente) motivo = 'ID vuoto';
        else if (!r.testo) motivo = 'Testo vuoto';
        else if (r.tipologia && !tipologie.has(r.tipologia.toLowerCase())) {
            motivo = `Tipologia "${r.tipologia}" sconosciuta (ammesse: ${getTipologie().join(', ')}; vuota = capacità)`;
        } else if (volte > 1) motivo = `ID ripetuto ${volte} volte nel file`;
        else if (libreria.has(prefisso + r.idCliente)) motivo = `L'id "${prefisso + r.idCliente}" è già un requisito della libreria`;

        if (motivo || !r.idCliente || !r.testo) scartate.push({ riga: r.riga, idCliente: r.idCliente || '', motivo: motivo ?? '' });
        else valide.push({ ...r, idCliente: r.idCliente, testo: r.testo, tipologia: r.tipologia ? tipologie.get(r.tipologia.toLowerCase()) ?? null : null });
    });
    return { valide, scartate };
}

/* --- CONFRONTO CON L'IMPORT PRECEDENTE (FUNZIONE PURA) --- */

// Nuovo elenco dei requisiti cliente, conteggi, liste per le schede dell'anteprima e id dei fili che si perdono.
// L'anteprima la chiama a ogni cambio; la conferma applica esattamente il suo risultato
export function calcolaImport(cliente: Cliente | null, valide: RigaValida[], modalita: 'sostituisci' | 'aggiungi', prefisso: string,
    workspace: Grafo, library: Libreria = appState.library): RisultatoImport {
    const esistenti = cliente?.requisiti || [];
    const perIdCliente = new Map(esistenti.map((r) => [r.idCliente, r]));
    const nelFile = new Set<string>();
    const requisiti: RequisitoCliente[] = [];
    const liste: RisultatoImport['liste'] = { modificati: [], ritirati: [], nuovi: [] };
    const conteggi: Conteggi = { nuovi: 0, modificati: 0, riattivati: 0, ritirati: 0, invariati: 0, scartati: 0, filiPersi: 0 };
    const tipologiaCambiata = new Set<string>();

    valide.forEach((v) => {
        nelFile.add(v.idCliente);
        const vecchio = perIdCliente.get(v.idCliente);
        const valori = { testo: v.testo, titolo: v.titolo, tipologia: v.tipologia };
        if (!vecchio) {
            const nuovo: RequisitoCliente = {
                id: prefisso + v.idCliente, idCliente: v.idCliente, ...valori, note: v.note, sezione: v.sezione,
                stato: 'attivo', modificato: false, precedente: null
            };
            requisiti.push(nuovo);
            liste.nuovi.push(nuovo);
            conteggi.nuovi++;
            return;
        }
        const cambiato = CAMPI_CONFRONTO.some((c) => (vecchio[c] ?? null) !== (valori[c] ?? null));
        const riattivato = vecchio.stato === 'ritirato';
        const aggiornato: RequisitoCliente = { ...vecchio, ...valori, note: v.note, sezione: v.sezione, stato: 'attivo' };
        if (riattivato || cambiato) {
            aggiornato.modificato = true;
            // precedente conserva i valori più vecchi non ancora visti
            aggiornato.precedente = vecchio.precedente ?? { testo: vecchio.testo, titolo: vecchio.titolo, tipologia: vecchio.tipologia };
        }
        if (riattivato) conteggi.riattivati++;
        else if (cambiato) {
            conteggi.modificati++;
            liste.modificati.push({ prima: vecchio, dopo: aggiornato });
        } else conteggi.invariati++;
        if ((vecchio.tipologia ?? null) !== (aggiornato.tipologia ?? null)) tipologiaCambiata.add(aggiornato.id);
        requisiti.push(aggiornato);
    });

    // Chi manca nel file va in coda, nel suo ordine: con Sostituisci gli attivi diventano ritirati
    esistenti.forEach((r) => {
        if (nelFile.has(r.idCliente)) return;
        if (modalita === 'sostituisci' && r.stato === 'attivo') {
            const ritirato: RequisitoCliente = { ...r, stato: 'ritirato' };
            requisiti.push(ritirato);
            liste.ritirati.push(ritirato);
            conteggi.ritirati++;
        } else {
            requisiti.push(r);
        }
    });

    // Fili della radice con un estremo cliente la cui tipologia cambia, rivalutati con le regole di oggi
    const filiPersi: string[] = [];
    if (tipologiaCambiata.size > 0) {
        const perId = new Map(requisiti.map((r) => [r.id, r]));
        const nodi = new Map(workspace.nodes.map((n) => [n.id, n]));
        const estremo = (ownerId: string, reqId: string, ownerType: TipoEstremo): Estremo => {
            let req: Requisito | null;
            if (ownerType === 'parent') req = perId.get(reqId) || null;
            else {
                const tipo = nodi.get(ownerId)?.type;
                req = (tipo ? library[tipo]?.requisiti.find((r) => r.id === reqId) : null) || null;
            }
            return { ownerId, reqId, ownerType, req };
        };
        workspace.edges.forEach((edge) => {
            const tocca = (edge.sourceType === 'parent' && tipologiaCambiata.has(edge.sourceHandle)) ||
                          (edge.targetType === 'parent' && tipologiaCambiata.has(edge.targetHandle));
            if (!tocca) return;
            const a = estremo(edge.source, edge.sourceHandle, edge.sourceType);
            const b = estremo(edge.target, edge.targetHandle, edge.targetType);
            // Un blocco che la libreria non conosce non si può valutare: il filo resta
            if (!a.req || !b.req) return;
            if (verificaCompatibilita(a, b)) filiPersi.push(edge.id);
        });
    }
    conteggi.filiPersi = filiPersi.length;
    return { requisiti, conteggi, liste, filiPersi };
}

// Un import è un solo passo di Annulla: prima si salva quanto in attesa, poi si cambia il modello e si salva subito
async function applicaImport(risultato: RisultatoImport, prefisso: string, ultimoImport: UltimoImport): Promise<boolean> {
    if (!await svuota()) return false;
    const radice = pathStack[0]!.graph;
    const persi = new Set(risultato.filiPersi);
    if (persi.size > 0) radice.edges = radice.edges.filter((e) => !persi.has(e.id));
    appState.cliente = { prefisso, requisiti: risultato.requisiti, ultimoImport };
    render();
    await svuota();
    return true;
}

/* --- FINESTRA DI IMPORT --- */

const modale = document.getElementById('importClienteModal');
const contenutoModale = document.getElementById('importClienteContenuto');

type SchedaImport = 'scartati' | 'esclusi' | 'modificati' | 'ritirati' | 'nuovi';

// Stato della finestra: file letto, foglio, riga di intestazione, colonne, modalità e ultimo risultato
interface StatoImport {
    nomeFile: string;
    formato: FileLetto['formato'];
    fogli: Foglio[];
    foglio: number;
    riga: number;
    // Riferimenti { nome, lettera } da cui ricostruire le colonne quando cambiano foglio o riga
    riferimenti: Partial<Record<ChiaveCampo, Riferimento | null>>;
    colonne: Colonne;
    // Filtro delle righe (spec 0030): riferimento della colonna, indice nel foglio di adesso e testo
    riferimentoFiltro: Riferimento | null;
    filtro: FiltroRighe;
    modalita: 'sostituisci' | 'aggiungi';
    scheda: SchedaImport;
    risultato: RisultatoImport | null;
    validazione: { valide: RigaValida[]; scartate: Scartata[] } | null;
    escluse: Esclusa[];
}

let imp: StatoImport | null = null;

function chiudiImport(): void {
    imp = null;
    if (modale) modale.style.display = 'none';
}

export function importClienteAperto(): boolean {
    return !!modale && modale.style.display !== 'none';
}

function prefissoInUso(): string {
    return appState.cliente?.prefisso || appSettings.cliente.prefisso;
}

function scegliFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xlsm,.csv';
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const esito = await leggiFileCliente(file);
        if (!esito.ok) {
            alert(`Import non riuscito: ${esito.messaggio}`);
            return;
        }
        apriFinestraImport(file.name, esito.dati);
    });
    input.click();
}

function apriFinestraImport(nomeFile: string, dati: FileLetto): void {
    const ultimo = appState.cliente?.ultimoImport || null;
    const indiceSalvato = ultimo ? dati.fogli.findIndex((f) => f.nome === ultimo.foglio) : -1;
    imp = {
        nomeFile,
        formato: dati.formato,
        fogli: dati.fogli,
        foglio: Math.max(0, indiceSalvato),
        riga: ultimo && Number.isInteger(ultimo.rigaIntestazione) && ultimo.rigaIntestazione >= 1 ? ultimo.rigaIntestazione : 1,
        riferimenti: (ultimo?.colonne as StatoImport['riferimenti'] | undefined) || {},
        colonne: {},
        riferimentoFiltro: ultimo?.filtro?.colonna ?? null,
        filtro: { colonna: null, testo: typeof ultimo?.filtro?.testo === 'string' ? ultimo.filtro.testo : '' },
        modalita: 'sostituisci',
        scheda: 'scartati',
        risultato: null,
        validazione: null,
        escluse: []
    };
    ricostruisciColonne(imp);
    if (modale) modale.style.display = 'flex';
    disegnaFinestra(imp);
}

function foglioCorrente(s: StatoImport): Foglio {
    return s.fogli[s.foglio] ?? { nome: '', nascosto: false, righe: [] };
}

function colonneCorrenti(s: StatoImport): Colonna[] {
    const foglio = foglioCorrente(s);
    if (s.riga > foglio.righe.length) return [];
    return colonneDelFoglio(foglio, s.riga);
}

function ricostruisciColonne(s: StatoImport): void {
    const colonne = colonneCorrenti(s);
    s.colonne = {};
    CAMPI.forEach(({ chiave }) => { s.colonne[chiave] = trovaColonna(colonne, s.riferimenti[chiave]); });
    s.filtro.colonna = trovaColonna(colonne, s.riferimentoFiltro);
}

function riferimentoDi(s: StatoImport, indice: number | null | undefined): Riferimento | null {
    const c = colonneCorrenti(s).find((col) => col.indice === indice);
    return c ? { nome: c.nome, lettera: c.lettera } : null;
}

// Riferimenti { nome, lettera } delle colonne scelte, per ultimoImport e per ricostruire i menu
function riferimentiScelti(s: StatoImport): Record<ChiaveCampo, Riferimento | null> {
    const riferimenti = {} as Record<ChiaveCampo, Riferimento | null>;
    CAMPI.forEach(({ chiave }) => { riferimenti[chiave] = riferimentoDi(s, s.colonne[chiave]); });
    return riferimenti;
}

function mappaturaCompleta(s: StatoImport): boolean {
    return s.colonne.id !== null && s.colonne.id !== undefined &&
           s.colonne.testo !== null && s.colonne.testo !== undefined;
}

function calcolaAnteprima(s: StatoImport): void {
    s.risultato = null;
    s.validazione = null;
    s.escluse = [];
    if (!mappaturaCompleta(s) || s.riga > foglioCorrente(s).righe.length) return;
    const prefisso = prefissoInUso();
    const { righe, escluse } = estraiRighe(foglioCorrente(s), s.riga, s.colonne, s.filtro);
    const validazione = validaRighe(righe, prefisso, appState.library);
    const risultato = calcolaImport(appState.cliente, validazione.valide, s.modalita, prefisso, pathStack[0]!.graph);
    risultato.conteggi.scartati = validazione.scartate.length;
    if (filtroAttivo(s.filtro)) risultato.conteggi.esclusi = escluse.length;
    s.escluse = escluse;
    s.validazione = validazione;
    s.risultato = risultato;
}

function disegnaFinestra(s: StatoImport): void {
    if (!contenutoModale) return;
    const foglio = foglioCorrente(s);
    const colonne = colonneCorrenti(s);
    const oltreLaFine = s.riga > foglio.righe.length;
    const opzioniFogli = s.fogli.map((f, i) =>
        `<option value="${i}" ${i === s.foglio ? 'selected' : ''}>${escapeHtml(f.nome)}${f.nascosto ? ' (nascosto)' : ''}</option>`).join('');

    const menuCampo = ({ chiave, etichetta, obbligatorio }: (typeof CAMPI)[number]) => {
        const scelta = s.colonne[chiave];
        const vuota = obbligatorio
            ? `<option value="" ${scelta === null ? 'selected' : ''}>— scegli —</option>`
            : `<option value="" ${scelta === null ? 'selected' : ''}>(nessuna)</option>`;
        const voci = colonne.map((c) =>
            `<option value="${c.indice}" ${c.indice === scelta ? 'selected' : ''}>${escapeHtml(`${c.lettera}: ${c.nome || '(senza nome)'}`)}</option>`).join('');
        return `<label class="campo-import"><span>${etichetta}${obbligatorio ? ' *' : ''}${iconaAiuto(`import.colonna.${chiave}`)}</span>
            <select data-campo="${chiave}" ${oltreLaFine ? 'disabled' : ''}>${vuota}${voci}</select></label>`;
    };

    contenutoModale.innerHTML = `
        <div class="import-file">File: <strong>${escapeHtml(s.nomeFile)}</strong> (${s.formato === 'csv' ? 'CSV' : 'Excel'})</div>
        <div class="import-riga">
            <label class="campo-import"><span>Foglio${iconaAiuto('import.foglio')}</span>
                <select id="impFoglio" ${s.fogli.length < 2 ? 'disabled' : ''}>${opzioniFogli}</select></label>
            <label class="campo-import"><span>Riga di intestazione${iconaAiuto('import.riga')}</span>
                <input type="number" id="impRiga" min="1" step="1" value="${s.riga}" style="width:80px;"></label>
        </div>
        ${oltreLaFine ? `<p class="elenco-avviso">Il foglio ha solo ${foglio.righe.length} righe</p>` : ''}
        <div class="import-campi">${CAMPI.map(menuCampo).join('')}</div>
        <div class="import-filtro">
            <span class="campo-import"><span>Filtro righe</span></span>
            <label class="campo-import"><span>Colonna${iconaAiuto('import.filtro.colonna')}</span>
                <select id="impFiltroColonna" ${oltreLaFine ? 'disabled' : ''}>
                    <option value="" ${s.filtro.colonna === null ? 'selected' : ''}>(nessun filtro)</option>
                    ${colonne.map((c) => `<option value="${c.indice}" ${c.indice === s.filtro.colonna ? 'selected' : ''}>${escapeHtml(`${c.lettera}: ${c.nome || '(senza nome)'}`)}</option>`).join('')}
                </select></label>
            <label class="campo-import"><span>contiene${iconaAiuto('import.filtro.testo')}</span>
                <input type="text" id="impFiltroTesto" value="${escapeHtml(s.filtro.testo)}" placeholder="es. Requirement; Req" ${oltreLaFine ? 'disabled' : ''}></label>
        </div>
        <div class="import-modalita">
            <span class="campo-import"><span>Modalità${iconaAiuto('import.modalita')}</span></span>
            <label><input type="radio" name="impModalita" value="sostituisci" ${s.modalita === 'sostituisci' ? 'checked' : ''}> Sostituisci l'insieme <small>(chi manca nel file diventa ritirato)</small></label>
            <label><input type="radio" name="impModalita" value="aggiungi" ${s.modalita === 'aggiungi' ? 'checked' : ''}> Aggiungi e aggiorna <small>(nessuno viene ritirato)</small></label>
        </div>
        <div id="impAnteprima" class="import-anteprima"></div>
        <div class="import-pulsanti">
            <button id="impAnnulla" class="pulsante-progetto">Annulla</button>
            <button id="impConferma" class="pulsante-progetto pulsante-menu">Conferma import</button>
        </div>`;
    disegnaAnteprima(s);
}

function tabella(intestazioni: string[], righe: string[]): string {
    return `<table class="report-table"><thead><tr>${intestazioni.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${righe.join('')}</tbody></table>`;
}

function cella(valore: unknown): string {
    return `<td>${escapeHtml(valore ?? '')}</td>`;
}

function primaDopo(prima: string | null | undefined, dopo: string | null | undefined): string {
    if ((prima ?? null) === (dopo ?? null)) return `<td class="invariato">${escapeHtml(dopo ?? '')}</td>`;
    return `<td><del>${escapeHtml(prima ?? '(vuoto)')}</del><br><ins>${escapeHtml(dopo ?? '(vuoto)')}</ins></td>`;
}

function contenutoScheda(s: StatoImport, risultato: RisultatoImport): string {
    const { liste } = risultato;
    switch (s.scheda) {
        case 'scartati': {
            const righe = (s.validazione?.scartate ?? []).map((sc) => `<tr>${cella(sc.riga)}${cella(sc.idCliente)}${cella(sc.motivo)}</tr>`);
            return righe.length ? tabella(['Riga', 'ID', 'Motivo'], righe) : '<p class="empty-props">Nessuna riga scartata.</p>';
        }
        case 'esclusi': {
            const limite = appSettings.cliente.righeAnteprima;
            const righe = s.escluse.slice(0, limite).map((e) => `<tr>${cella(e.riga)}${cella(e.idCliente)}${cella(e.valore)}</tr>`);
            const altri = s.escluse.length - limite;
            if (!righe.length) return '<p class="empty-props">Nessuna riga esclusa dal filtro.</p>';
            return tabella(['Riga', 'ID', 'Valore della colonna filtro'], righe) + (altri > 0 ? `<p class="empty-props">e altre ${altri}</p>` : '');
        }
        case 'modificati': {
            const righe = liste.modificati.map(({ prima, dopo }) =>
                `<tr>${cella(dopo.idCliente)}${primaDopo(prima.testo, dopo.testo)}${primaDopo(prima.titolo, dopo.titolo)}${primaDopo(prima.tipologia ?? 'Capacità', dopo.tipologia ?? 'Capacità')}</tr>`);
            return righe.length ? tabella(['ID', 'Testo', 'Titolo', 'Tipologia'], righe) : '<p class="empty-props">Nessun requisito modificato.</p>';
        }
        case 'ritirati': {
            const righe = liste.ritirati.map((r) => `<tr>${cella(r.idCliente)}${cella(titoloRequisito(r))}</tr>`);
            return righe.length ? tabella(['ID', 'Titolo'], righe) : '<p class="empty-props">Nessun requisito ritirato.</p>';
        }
        default: {
            const limite = appSettings.cliente.righeAnteprima;
            const righe = liste.nuovi.slice(0, limite).map((r) =>
                `<tr>${cella(r.idCliente)}${cella(r.titolo)}${cella(r.testo.length > 120 ? `${r.testo.slice(0, 120)}…` : r.testo)}${cella(r.tipologia ?? 'Capacità')}</tr>`);
            const altri = liste.nuovi.length - limite;
            if (!righe.length) return '<p class="empty-props">Nessun requisito nuovo.</p>';
            return tabella(['ID', 'Titolo', 'Testo', 'Tipologia'], righe) + (altri > 0 ? `<p class="empty-props">e altri ${altri}</p>` : '');
        }
    }
}

function disegnaAnteprima(s: StatoImport): void {
    calcolaAnteprima(s);
    const anteprima = document.getElementById('impAnteprima');
    const conferma = document.getElementById('impConferma') as HTMLButtonElement | null;
    if (!anteprima || !conferma) return;
    const risultato = s.risultato;
    if (!risultato) {
        anteprima.innerHTML = "<p class=\"empty-props\">Scegli le colonne di ID e Testo per vedere l'anteprima.</p>";
        conferma.disabled = true;
        conferma.title = 'Scegli prima le colonne di ID e Testo';
        return;
    }
    const c = risultato.conteggi;
    const voci: Array<[string, number]> = [
        ['Nuovi', c.nuovi], ['Modificati', c.modificati], ['Riattivati', c.riattivati], ['Ritirati', c.ritirati],
        ['Invariati', c.invariati], ['Scartati', c.scartati], ['Fili che si perdono', c.filiPersi]
    ];
    const schede: Array<[SchedaImport, string, number]> = [['scartati', 'Scartati', c.scartati], ['modificati', 'Modificati', c.modificati],
        ['ritirati', 'Ritirati', c.ritirati], ['nuovi', 'Nuovi', c.nuovi]];
    const esclusi = c.esclusi;
    if (esclusi !== undefined) {
        voci.push(['Esclusi', esclusi]);
        schede.splice(1, 0, ['esclusi', 'Esclusi', esclusi]);
    } else if (s.scheda === 'esclusi') s.scheda = 'scartati';
    const passano = (s.validazione?.valide.length ?? 0) + (s.validazione?.scartate.length ?? 0);
    const esitoFiltro = esclusi === undefined ? ''
        : `<p class="import-esito-filtro" id="impEsitoFiltro">${passano} ${passano === 1 ? 'riga passa' : 'righe passano'} il filtro, ${esclusi} ${esclusi === 1 ? 'esclusa' : 'escluse'}</p>`;
    anteprima.innerHTML = `
        ${esitoFiltro}
        <div class="import-conteggi">${voci.map(([nome, n]) =>
            `<span class="conteggio-import${n > 0 && (nome === 'Scartati' || nome === 'Fili che si perdono') ? ' conteggio-attenzione' : ''}"><strong>${n}</strong> ${nome.toLowerCase()}</span>`).join('')}</div>
        <div class="schede-import">${schede.map(([chiave, nome, n]) =>
            `<button data-scheda="${chiave}" class="scheda-import${s.scheda === chiave ? ' attiva' : ''}">${nome} (${n})</button>`).join('')}</div>
        <div class="contenuto-scheda-import">${contenutoScheda(s, risultato)}</div>`;
    const valide = s.validazione?.valide.length ?? 0;
    conferma.disabled = valide === 0;
    conferma.title = valide === 0 ? 'Il file non ha nessuna riga valida' : '';
}

async function confermaImport(s: StatoImport): Promise<void> {
    const risultato = s.risultato;
    if (!risultato || !s.validazione || s.validazione.valide.length === 0) return;
    const prefisso = prefissoInUso();
    const ultimoImport: UltimoImport = {
        data: new Date().toISOString(),
        nomeFile: s.nomeFile,
        foglio: foglioCorrente(s).nome,
        rigaIntestazione: s.riga,
        modalita: s.modalita,
        colonne: riferimentiScelti(s) as unknown as UltimoImport['colonne'],
        filtro: filtroAttivo(s.filtro) ? { colonna: riferimentoDi(s, s.filtro.colonna), testo: s.filtro.testo.trim() } : null,
        conteggi: { ...risultato.conteggi }
    };
    chiudiImport();
    await applicaImport(risultato, prefisso, ultimoImport);
}

const SCHEDE_IMPORT = new Set<string>(['scartati', 'esclusi', 'modificati', 'ritirati', 'nuovi']);

function installaEventiImport(): void {
    if (!contenutoModale) return;
    contenutoModale.addEventListener('change', (e) => {
        const s = imp;
        if (!s) return;
        const t = e.target as HTMLInputElement | HTMLSelectElement;
        if (t.id === 'impFoglio' || t.id === 'impRiga') {
            // I menu si ricostruiscono tenendo le colonne scelte (per nome, se no per lettera)
            s.riferimenti = riferimentiScelti(s);
            s.riferimentoFiltro = riferimentoDi(s, s.filtro.colonna);
            if (t.id === 'impFoglio') s.foglio = Number(t.value);
            else s.riga = Math.max(1, Math.floor(Number(t.value)) || 1);
            ricostruisciColonne(s);
            disegnaFinestra(s);
        } else if (t.dataset.campo) {
            s.colonne[t.dataset.campo as ChiaveCampo] = t.value === '' ? null : Number(t.value);
            disegnaAnteprima(s);
        } else if (t.id === 'impFiltroColonna') {
            s.filtro.colonna = t.value === '' ? null : Number(t.value);
            disegnaAnteprima(s);
        } else if ((t as HTMLInputElement).name === 'impModalita') {
            s.modalita = t.value === 'aggiungi' ? 'aggiungi' : 'sostituisci';
            disegnaAnteprima(s);
        }
    });
    // Il testo del filtro aggiorna l'anteprima mentre scrivi, senza ridisegnare il campo
    contenutoModale.addEventListener('input', (e) => {
        const s = imp;
        const t = e.target as HTMLInputElement;
        if (!s || t.id !== 'impFiltroTesto') return;
        s.filtro.testo = t.value;
        disegnaAnteprima(s);
    });
    contenutoModale.addEventListener('click', (e) => {
        const s = imp;
        if (!s) return;
        const bersaglio = e.target as HTMLElement;
        const scheda = bersaglio.closest<HTMLElement>('[data-scheda]');
        if (scheda) {
            const nome = scheda.dataset.scheda ?? '';
            if (SCHEDE_IMPORT.has(nome)) s.scheda = nome as SchedaImport;
            disegnaAnteprima(s);
        } else if (bersaglio.id === 'impAnnulla') {
            chiudiImport();
        } else if (bersaglio.id === 'impConferma') {
            void confermaImport(s);
        }
    });
    document.getElementById('btnChiudiImport')?.addEventListener('click', chiudiImport);
}

/* --- SCHEDA CLIENTE DEL PANNELLO SINISTRO --- */

const filtri = { ricerca: '', stato: 'tutti', sezione: '' };
let idSelezionato: string | null = null;
let schedaDaAggiornare = false;
let fotogrammaRichiesto = false;
let timerRicerca: ReturnType<typeof setTimeout> | undefined;

function schedaVisibile(): boolean {
    return pannelloVisibile('cliente');
}

// Chiamata da render(): l'aggiornamento vero avviene una volta per fotogramma e solo se la scheda si vede
export function segnaSchedaClienteDaAggiornare(): void {
    schedaDaAggiornare = true;
    if (fotogrammaRichiesto) return;
    fotogrammaRichiesto = true;
    requestAnimationFrame(() => {
        fotogrammaRichiesto = false;
        if (schedaDaAggiornare && schedaVisibile()) aggiornaSchedaCliente();
    });
}

// id del requisito cliente mostrato nell'ispettore, null se l'ispettore mostra altro
export function impostaSelezioneCliente(id: string | null): void {
    idSelezionato = id;
}

export function dettaglioClienteAperto(): boolean {
    return idSelezionato !== null;
}

// Importa… spento senza progetto o durante un conflitto del progetto, con il motivo nel suggerimento
export function aggiornaPulsantiCliente(): void {
    const pulsante = document.getElementById('btnImportaCliente') as HTMLButtonElement | null;
    if (!pulsante) return;
    let motivo = '';
    if (!progettoAperto()) motivo = 'Apri un progetto per importare i requisiti cliente';
    else if (progettoInConflitto()) motivo = 'Risolvi prima il conflitto del progetto (banner in alto)';
    pulsante.disabled = !!motivo;
    pulsante.dataset.titoloNativo = motivo;
}

function passaFiltriScheda(req: RequisitoCliente, fili: Map<string, number>, query: string): boolean {
    if (filtri.stato === 'nonCollegati' && !(req.stato === 'attivo' && !fili.get(req.id))) return false;
    if (filtri.stato === 'modificati' && !req.modificato) return false;
    if (filtri.stato === 'ritirati' && req.stato !== 'ritirato') return false;
    if (filtri.sezione && req.sezione !== filtri.sezione) return false;
    if (!query) return true;
    return [req.idCliente, req.titolo, req.testo].some((v) => (v || '').toLowerCase().includes(query));
}

export function aggiornaSchedaCliente(): void {
    schedaDaAggiornare = false;
    aggiornaPulsantiCliente();
    const nessunProgetto = document.getElementById('clienteNessunProgetto');
    const strumenti = document.getElementById('clienteStrumenti');
    const vuoto = document.getElementById('clienteVuoto');
    const elenco = document.getElementById('clienteElenco');
    const filtriBox = document.getElementById('clienteFiltri');
    const visti = document.getElementById('btnVistiCliente');
    if (!nessunProgetto || !strumenti || !vuoto || !elenco || !filtriBox || !visti) return;

    const aperto = progettoAperto();
    const requisiti = appState.cliente?.requisiti || [];
    nessunProgetto.hidden = aperto;
    strumenti.hidden = !aperto;
    vuoto.hidden = !aperto || requisiti.length > 0;
    filtriBox.hidden = !aperto || requisiti.length === 0;
    elenco.hidden = !aperto || requisiti.length === 0;
    visti.hidden = requisiti.length === 0;
    if (!aperto || requisiti.length === 0) return;

    // Sezioni presenti, tenendo la scelta se esiste ancora
    const selectSezione = document.getElementById('clienteSezione') as HTMLSelectElement;
    const sezioni = [...new Set(requisiti.map((r) => r.sezione).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, 'it'));
    if (filtri.sezione && !sezioni.includes(filtri.sezione)) filtri.sezione = '';
    selectSezione.innerHTML = '<option value="">Tutte le sezioni</option>' +
        sezioni.map((s) => `<option value="${escapeHtml(s)}" ${s === filtri.sezione ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
    selectSezione.disabled = sezioni.length === 0;

    const fili = contaFiliCliente();
    const posizioni: Record<string, Punto> = pathStack[0]!.graph.parentReqPositions || {};
    const query = filtri.ricerca.trim().toLowerCase();
    const trovati = requisiti.filter((r) => passaFiltriScheda(r, fili, query));
    const limite = appSettings.cliente.righePannello;
    const mostrati = trovati.slice(0, limite);

    const conteggio = document.getElementById('clienteConteggio');
    if (conteggio) {
        conteggio.textContent = trovati.length > limite
            ? `${trovati.length} risultati, mostrati i primi ${limite}`
            : `${trovati.length} risultati`;
    }

    const righe = document.getElementById('clienteRighe');
    if (!righe) return;
    righe.innerHTML = mostrati.map((r) => {
        const n = fili.get(r.id) || 0;
        const segni = [
            posizioni[r.id] ? '<span class="segno-cliente" title="Sul canvas">📍</span>' : '',
            n > 0 ? `<span class="segno-cliente" title="Fili">🔗${n}</span>` : '',
            r.modificato ? '<span class="segno-cliente segno-mod" title="Modificato dall\'ultimo import">Mod</span>' : '',
            r.stato === 'ritirato' ? '<span class="segno-cliente segno-rit" title="Ritirato">Rit</span>' : ''
        ].join('');
        const classi = ['riga-cliente', r.stato === 'ritirato' ? 'riga-ritirata' : '', r.id === idSelezionato ? 'riga-selezionata' : ''].join(' ');
        return `<div class="${classi}" draggable="true" data-id="${escapeHtml(r.id)}" title="${escapeHtml(r.testo)}">
            <span class="pallino-classe" style="background:${escapeHtml(getColoreRequisito(r))}"></span>
            <span class="riga-cliente-id">${escapeHtml(r.idCliente)}</span>
            <span class="riga-cliente-titolo">${escapeHtml(titoloRequisito(r))}</span>
            <span class="riga-cliente-segni">${segni}</span>
        </div>`;
    }).join('');
}

function segnaTuttiVisti(): void {
    const modificati = (appState.cliente?.requisiti || []).filter((r) => r.modificato);
    if (modificati.length === 0) {
        alert('Nessun requisito cliente è segnato come modificato.');
        return;
    }
    if (!confirm(`Segnare come visti tutti i ${modificati.length} requisiti cliente modificati? Il prima e dopo di ognuno viene cancellato.`)) return;
    modificati.forEach((r) => { r.modificato = false; r.precedente = null; });
    render();
    if (idSelezionato) mostraDettaglioCliente(idSelezionato);
}

// Rilascio di una riga della scheda sul canvas: il requisito diventa un blocco tondo della radice
export function posizionaRequisitoCliente(id: string, coords: Punto): void {
    if (pathStack.length > 1) {
        alert('I requisiti cliente si collegano solo alla radice');
        return;
    }
    if (!trovaRequisitoCliente(id)) return;
    const radice = pathStack[0]!.graph;
    if (!radice.parentReqPositions) radice.parentReqPositions = {};
    radice.parentReqPositions[id] = { x: coords.x, y: coords.y };
    render();
}

export function initSchedaCliente(): void {
    // Il pannello Cliente si ridisegna quando torna visibile (spec 0021)
    allaVista('cliente', aggiornaSchedaCliente);
    document.getElementById('btnImportaCliente')?.addEventListener('click', () => {
        aggiornaPulsantiCliente();
        if (!(document.getElementById('btnImportaCliente') as HTMLButtonElement | null)?.disabled) scegliFile();
    });
    document.getElementById('btnVistiCliente')?.addEventListener('click', segnaTuttiVisti);

    document.getElementById('clienteRicerca')?.addEventListener('input', (e) => {
        clearTimeout(timerRicerca);
        const valore = (e.target as HTMLInputElement).value;
        timerRicerca = setTimeout(() => {
            filtri.ricerca = valore;
            aggiornaSchedaCliente();
        }, ATTESA_RICERCA);
    });
    document.getElementById('clienteStato')?.addEventListener('change', (e) => {
        filtri.stato = (e.target as HTMLSelectElement).value;
        aggiornaSchedaCliente();
    });
    document.getElementById('clienteSezione')?.addEventListener('change', (e) => {
        filtri.sezione = (e.target as HTMLSelectElement).value;
        aggiornaSchedaCliente();
    });

    const righe = document.getElementById('clienteRighe');
    righe?.addEventListener('dragstart', (e) => {
        const riga = (e.target as Element).closest?.<HTMLElement>('[data-id]');
        if (riga) e.dataTransfer?.setData('requisitoCliente', riga.dataset.id ?? '');
    });
    righe?.addEventListener('click', (e) => {
        const riga = (e.target as Element).closest<HTMLElement>('[data-id]');
        if (riga) mostraDettaglioCliente(riga.dataset.id);
    });

    installaEventiImport();
    aggiornaSchedaCliente();
}
