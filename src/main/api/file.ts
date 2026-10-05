/* --- FILE: LETTURA E SCRITTURA SICURE, COPIE NUMERATE, JSON E IMPRONTE --- */
// Tutto sincrono: un'operazione dell'API non si intreccia mai con un'altra (spec 0018)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ErroreApi } from './errori.js';

const TENTATIVI_FILE_BLOCCATO = 5;
const ATTESA_FILE_BLOCCATO_MS = 50;
export const MSG_FILE_BLOCCATO = 'Il file è bloccato da un altro programma, ad esempio OneDrive, un antivirus o un editor';

const pausa = new Int32Array(new SharedArrayBuffer(4));
function aspetta(ms: number): void {
    Atomics.wait(pausa, 0, 0, ms);
}

// Errore che su Windows vuol dire "file aperto da un altro programma" (PermissionError di Python)
function bloccato(e: unknown): boolean {
    const codice = (e as NodeJS.ErrnoException | null)?.code;
    return codice === 'EPERM' || codice === 'EACCES' || codice === 'EBUSY';
}

export function conRitentativi<T>(operazione: () => T): T {
    for (let tentativo = 0; ; tentativo++) {
        try {
            return operazione();
        } catch (e) {
            if (!bloccato(e)) throw e;
            if (tentativo === TENTATIVI_FILE_BLOCCATO) throw new ErroreApi(503, 'file_bloccato', MSG_FILE_BLOCCATO);
            aspetta(ATTESA_FILE_BLOCCATO_MS);
        }
    }
}

export function esiste(percorso: string): boolean {
    return fs.existsSync(percorso);
}

export function eFile(percorso: string): boolean {
    try {
        return fs.statSync(percorso).isFile();
    } catch {
        return false;
    }
}

export function eCartella(percorso: string): boolean {
    try {
        return fs.statSync(percorso).isDirectory();
    } catch {
        return false;
    }
}

export function rimuoviSeEsiste(percorso: string): void {
    try {
        fs.unlinkSync(percorso);
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
}

export function leggiBytes(percorso: string): Buffer {
    return conRitentativi(() => fs.readFileSync(percorso));
}

// Scrive accanto in .tmp e poi sostituisce: il file principale è sempre JSON completo
export function scriviAtomico(percorso: string, dati: Buffer): void {
    const tmp = percorso + '.tmp';
    try {
        conRitentativi(() => {
            fs.writeFileSync(tmp, dati);
            fs.renameSync(tmp, percorso);
        });
    } catch (e) {
        try { rimuoviSeEsiste(tmp); } catch { /* resta il .tmp, lo toglie il prossimo avvio */ }
        if (e instanceof ErroreApi) throw e;
        const messaggio = e instanceof Error ? e.message : String(e);
        throw new ErroreApi(500, 'errore_scrittura', `Impossibile scrivere il file: ${messaggio}`);
    }
}

export function sposta(da: string, a: string): void {
    conRitentativi(() => fs.renameSync(da, a));
}

/* --- JSON come Python --- */

// json.dumps(valore, ensure_ascii=False, indent=2) in UTF-8: stessi byte del file scritto da start.py
export function serializza(valore: unknown): Buffer {
    return Buffer.from(JSON.stringify(valore, null, 2), 'utf-8');
}

// json.dumps(valore, sort_keys=True, ensure_ascii=False, separators=(',', ':')): stessa forma per lo stesso contenuto
export function formaCanonica(valore: unknown): Buffer {
    return Buffer.from(canonico(valore), 'utf-8');
}

function confrontaChiavi(a: string, b: string): number {
    // Python ordina per punto di codice, JavaScript per unità UTF-16: si confronta per punto di codice
    const pa = Array.from(a);
    const pb = Array.from(b);
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
        const d = (pa[i]?.codePointAt(0) ?? 0) - (pb[i]?.codePointAt(0) ?? 0);
        if (d !== 0) return d;
    }
    return pa.length - pb.length;
}

function canonico(valore: unknown): string {
    if (Array.isArray(valore)) return '[' + valore.map(canonico).join(',') + ']';
    if (valore !== null && typeof valore === 'object') {
        const oggetto = valore as Record<string, unknown>;
        return '{' + Object.keys(oggetto).sort(confrontaChiavi).map((k) => JSON.stringify(k) + ':' + canonico(oggetto[k])).join(',') + '}';
    }
    return JSON.stringify(valore) ?? 'null';
}

export function improntaDi(dati: Buffer): string {
    return crypto.createHash('sha1').update(dati).digest('hex');
}

export function valoriUguali(a: unknown, b: unknown): boolean {
    return canonico(a) === canonico(b);
}

// Oggetto JSON da byte; 422 json_non_valido se non è JSON o non è un oggetto
export function interpretaJson(dati: Buffer, messaggio: string): Record<string, unknown> {
    let valore: unknown;
    try {
        valore = JSON.parse(decodificaUtf8(dati));
    } catch {
        throw new ErroreApi(422, 'json_non_valido', messaggio);
    }
    if (!eOggetto(valore)) throw new ErroreApi(422, 'json_non_valido', messaggio);
    return valore;
}

// ignoreBOM: come bytes.decode('utf-8') di Python il BOM resta, e JSON.parse lo rifiuta
const decoderUtf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
export function decodificaUtf8(dati: Buffer): string {
    return decoderUtf8.decode(dati);
}

export function eOggetto(valore: unknown): valore is Record<string, unknown> {
    return valore !== null && typeof valore === 'object' && !Array.isArray(valore);
}

/* --- Copie numerate: <nome>.1.json, <nome>.2.json, ... --- */

export function percorsoCopia(cartella: string, nome: string, n: number): string {
    return path.join(cartella, `${nome}.${n}.json`);
}

function escapeRegex(testo: string): string {
    return testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function numeriCopie(cartella: string, nome: string): number[] {
    if (!eCartella(cartella)) return [];
    const formato = new RegExp(`^${escapeRegex(nome)}\\.(\\d+)\\.json$`);
    const numeri: number[] = [];
    for (const voce of fs.readdirSync(cartella)) {
        const trovato = formato.exec(voce);
        if (trovato?.[1]) numeri.push(Number.parseInt(trovato[1], 10));
    }
    return numeri;
}

export function ruotaCopie(cartella: string, nome: string, attuali: Buffer, massimo: number): void {
    // .1 uguale al file attuale: la rotazione l'ha già fatta un tentativo fallito (file bloccato).
    // Ripeterla riempirebbe le copie di doppioni e cancellerebbe la storia
    const prima = percorsoCopia(cartella, nome, 1);
    if (esiste(prima) && leggiBytes(prima).equals(attuali)) return;
    // Le copie oltre il limite (anche se il limite è sceso) spariscono, poi .1→.2→.3
    for (const n of numeriCopie(cartella, nome)) {
        if (n >= massimo) conRitentativi(() => rimuoviSeEsiste(percorsoCopia(cartella, nome, n)));
    }
    for (let n = massimo - 1; n >= 1; n--) {
        if (esiste(percorsoCopia(cartella, nome, n))) sposta(percorsoCopia(cartella, nome, n), percorsoCopia(cartella, nome, n + 1));
    }
    scriviAtomico(prima, attuali);
}

// Toglie i .tmp lasciati da scritture interrotte
export function pulisciTemporanei(cartella: string, ricorsivo = false): void {
    if (!eCartella(cartella)) return;
    for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
        const completo = path.join(cartella, voce.name);
        if (voce.isDirectory()) {
            if (ricorsivo) pulisciTemporanei(completo, true);
        } else if (voce.name.endsWith('.tmp')) {
            try { fs.unlinkSync(completo); } catch { /* ci riprova al prossimo avvio */ }
        }
    }
}
