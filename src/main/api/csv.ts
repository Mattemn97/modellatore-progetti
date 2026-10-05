/* --- CSV DEL CLIENTE: DECODIFICA, SCELTA DEL SEPARATORE E LETTURA COME IL MODULO csv DI PYTHON --- */
import { ErroreApi } from './errori.js';

const CAMPIONE_SEPARATORE = 64 * 1024;
const SEPARATORI = [';', ',', '\t'];
// Ordine di preferenza di csv.Sniffer a parità di consistenza
const PREFERITI = [',', '\t', ';'];

// Byte che cp1252 di Python non sa decodificare
const NON_DEFINITI_CP1252 = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

// utf-8-sig, altrimenti Windows-1252; altrimenti 422
export function decodificaCsv(dati: Buffer): string {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(dati);
    } catch {
        if (dati.some((b) => NON_DEFINITI_CP1252.has(b))) {
            throw new ErroreApi(422, 'file_illeggibile', 'Il CSV non è in UTF-8 né in Windows-1252.');
        }
        return new TextDecoder('windows-1252').decode(dati);
    }
}

// csv.Sniffer()._guess_quote_and_delimiter: un campo tra virgolette (doppie o singole) accanto a un separatore.
// Vale la prima espressione che trova qualcosa; \w di Python è Unicode, quindi lettere e cifre di ogni alfabeto
const NON_PAROLA = String.raw`[^\p{L}\p{N}_\n"']`;
// ^ e $ di re.MULTILINE vedono solo \n (in JavaScript anche \r): si scrivono per esteso, senza il flag m
const INIZIO_RIGA = String.raw`(?:(?<![\s\S])|(?<=\n)|\n)`;
const FINE_RIGA = String.raw`(?:(?=\n)|(?![\s\S])|\n)`;
const MODELLI_VIRGOLETTE = [
    String.raw`(?<delim>${NON_PAROLA})(?<space> ?)(?<quote>["']).*?\k<quote>\k<delim>`,
    String.raw`${INIZIO_RIGA}(?<quote>["']).*?\k<quote>(?<delim>${NON_PAROLA})(?<space> ?)`,
    String.raw`(?<delim>${NON_PAROLA})(?<space> ?)(?<quote>["']).*?\k<quote>${FINE_RIGA}`,
    String.raw`${INIZIO_RIGA}(?<quote>["']).*?\k<quote>${FINE_RIGA}`
].map((testo) => new RegExp(testo, 'gsu'));

function separatoreDaVirgolette(campione: string): string | null {
    for (const modello of MODELLI_VIRGOLETTE) {
        const trovati = [...campione.matchAll(modello)];
        if (trovati.length === 0) continue;
        const conteggi = new Map<string, number>();
        for (const m of trovati) {
            const d = m.groups?.delim;
            if (d && SEPARATORI.includes(d)) conteggi.set(d, (conteggi.get(d) ?? 0) + 1);
        }
        // max() di Python: a parità vince il primo trovato
        let migliore: string | null = null;
        let massimo = 0;
        for (const [d, n] of conteggi) if (n > massimo) { massimo = n; migliore = d; }
        return migliore;
    }
    return null;
}

// csv.Sniffer()._guess_delimiter: lo stesso numero di separatori sulle righe, a blocchi di 10 righe
function separatoreDaFrequenze(campione: string): string | null {
    const dati = campione.split('\n').filter((r) => r !== '');
    const lunghezzaBlocco = Math.min(10, dati.length);
    // Per ogni carattere: quante righe hanno 0, 1, 2... occorrenze (in ordine di prima apparizione)
    const frequenze = new Map<string, Map<number, number>>(SEPARATORI.map((c) => [c, new Map<number, number>()]));
    const mode = new Map<string, [number, number]>();
    const scelti = new Map<string, [number, number]>();
    let iterazione = 0;
    for (let inizio = 0, fine = lunghezzaBlocco; inizio < dati.length; inizio = fine, fine += lunghezzaBlocco) {
        iterazione++;
        for (const riga of dati.slice(inizio, fine)) {
            for (const c of SEPARATORI) {
                const f = frequenze.get(c) as Map<number, number>;
                const n = riga.split(c).length - 1;
                f.set(n, (f.get(n) ?? 0) + 1);
            }
        }
        for (const c of SEPARATORI) {
            const voci = [...(frequenze.get(c) as Map<number, number>).entries()];
            if (voci.length === 1 && voci[0]?.[0] === 0) continue;
            if (voci.length > 1) {
                let moda = voci[0] as [number, number];
                for (const v of voci) if (v[1] > moda[1]) moda = v;
                const altri = voci.filter((v) => v !== moda).reduce((somma, v) => somma + v[1], 0);
                mode.set(c, [moda[0], moda[1] - altri]);
            } else {
                mode.set(c, voci[0] as [number, number]);
            }
        }
        const totale = Math.min(lunghezzaBlocco * iterazione, dati.length);
        // Stessa aritmetica in virgola mobile di Python: 1.0, 0.99, ... fino a 0.9
        for (let consistenza = 1.0; scelti.size === 0 && consistenza >= 0.9; consistenza -= 0.01) {
            for (const c of SEPARATORI) {
                const v = mode.get(c);
                if (v && v[0] > 0 && v[1] > 0 && v[1] / totale >= consistenza) scelti.set(c, v);
            }
        }
        if (scelti.size === 1) return [...scelti.keys()][0] ?? null;
    }
    if (scelti.size === 0) return null;
    return PREFERITI.find((p) => scelti.has(p)) ?? null;
}

export function scegliSeparatore(testo: string): string {
    const campione = testo.slice(0, CAMPIONE_SEPARATORE);
    // Il separatore dell'Excel italiano se csv.Sniffer non sa decidere
    return separatoreDaVirgolette(campione) ?? separatoreDaFrequenze(campione) ?? ';';
}

// csv.reader con il dialetto excel (virgolette doppie, "" dentro un campo), non rigoroso; una riga vuota è []
export function leggiRigheCsv(testo: string, separatore: string): string[][] {
    const righe: string[][] = [];
    let riga: string[] = [];
    let campo = '';
    let traVirgolette = false;
    let eraTraVirgolette = false;
    let inizioCampo = true;
    let haCampi = false;
    const chiudiCampo = () => { riga.push(campo); campo = ''; inizioCampo = true; eraTraVirgolette = false; haCampi = true; };
    const chiudiRiga = () => {
        if (haCampi || campo !== '' || eraTraVirgolette) chiudiCampo();
        righe.push(riga);
        riga = [];
        haCampi = false;
    };
    for (let i = 0; i < testo.length; i++) {
        const c = testo[i] as string;
        if (traVirgolette) {
            if (c === '"') {
                if (testo[i + 1] === '"') { campo += '"'; i++; } else { traVirgolette = false; }
            } else {
                campo += c;
            }
            continue;
        }
        if (c === '"' && inizioCampo) {
            traVirgolette = true;
            eraTraVirgolette = true;
            inizioCampo = false;
        } else if (c === separatore) {
            chiudiCampo();
        } else if (c === '\r' || c === '\n') {
            if (c === '\r' && testo[i + 1] === '\n') i++;
            chiudiRiga();
        } else {
            campo += c;
            inizioCampo = false;
        }
    }
    // Virgolette non chiuse a fine file: in modalità non rigorosa Python salva il campo così com'è
    if (haCampi || campo !== '' || eraTraVirgolette) chiudiRiga();
    return righe;
}
