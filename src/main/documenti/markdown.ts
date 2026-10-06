/* --- LETTURA DEL MARKDOWN DEI DOCUMENTI: BLOCCHI PER WORD E PDF (spec 0028, logica pura) --- */
// Solo il sottoinsieme che scrive il generatore (spec 0007) più il Markdown comune dei testi dell'utente:
// titoli, paragrafi, elenchi, tabelle a barre, grassetto, corsivo, codice e le figure dei diagrammi (spec 0029).
// Tutto il resto resta testo così com'è.

export interface Pezzo {
    testo: string;
    grassetto?: boolean;
    corsivo?: boolean;
    codice?: boolean;
}

// Una riga di testo formattato
export type Riga = Pezzo[];

export type BloccoMd =
    | { tipo: 'titolo'; livello: number; pezzi: Riga }
    | { tipo: 'paragrafo'; righe: Riga[] }
    | { tipo: 'elenco'; ordinato: boolean; voci: Riga[] }
    | { tipo: 'tabella'; intestazione: Riga[]; righe: Riga[][] }
    | { tipo: 'immagine'; chiave: string; didascalia: string };

const TITOLO = /^(#{1,6})\s+(.*)$/;
const IMMAGINE = /^!\[([^\]]*)\]\((diagramma:[^)\s]+)\)\s*$/;
const PUNTATO = /^\s*[-*+]\s+(.*)$/;
const NUMERATO = /^\s*\d+[.)]\s+(.*)$/;
const SEPARATORE_TABELLA = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

// Grassetto, codice, corsivo con * o con _ (il trattino basso solo tra confini di parola: sys_cap resta com'è)
const IN_RIGA = /\*\*([^*]+?)\*\*|`([^`]+)`|(?<![\w*])\*([^*\s](?:[^*]*[^*\s])?)\*(?![\w*])|(?<![\w])_([^_\s](?:[^_]*[^_\s])?)_(?!\w)/g;

export function leggiRiga(testo: string): Riga {
    const pezzi: Riga = [];
    let ultimo = 0;
    for (const m of testo.matchAll(IN_RIGA)) {
        const inizio = m.index ?? 0;
        if (inizio > ultimo) pezzi.push({ testo: testo.slice(ultimo, inizio) });
        if (m[1] !== undefined) pezzi.push({ testo: m[1], grassetto: true });
        else if (m[2] !== undefined) pezzi.push({ testo: m[2], codice: true });
        else pezzi.push({ testo: m[3] ?? m[4] ?? '', corsivo: true });
        ultimo = inizio + m[0].length;
    }
    if (ultimo < testo.length) pezzi.push({ testo: testo.slice(ultimo) });
    return pezzi;
}

// Celle di una riga di tabella: separate dalle barre non precedute da \, con \| e \\ tolti (inverso di cellaMd)
export function celleTabella(riga: string): string[] {
    let t = riga.trim();
    if (t.startsWith('|')) t = t.slice(1);
    const celle: string[] = [];
    let attuale = '';
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (c === '\\' && (t[i + 1] === '|' || t[i + 1] === '\\')) {
            attuale += t[i + 1];
            i++;
        } else if (c === '|') {
            celle.push(attuale.trim());
            attuale = '';
        } else {
            attuale += c;
        }
    }
    // Una barra finale chiude l'ultima cella: quello che resta dopo è vuoto
    if (attuale.trim() !== '' || !t.trimEnd().endsWith('|')) celle.push(attuale.trim());
    return celle;
}

export function leggiMarkdown(testo: string): BloccoMd[] {
    const righe = testo.replace(/\r\n?/g, '\n').split('\n');
    const blocchi: BloccoMd[] = [];
    let paragrafo: Riga[] = [];
    const chiudiParagrafo = (): void => {
        if (paragrafo.length) blocchi.push({ tipo: 'paragrafo', righe: paragrafo });
        paragrafo = [];
    };

    for (let i = 0; i < righe.length; i++) {
        const riga = righe[i] ?? '';
        if (!riga.trim()) {
            chiudiParagrafo();
            continue;
        }
        const titolo = TITOLO.exec(riga);
        if (titolo) {
            chiudiParagrafo();
            blocchi.push({ tipo: 'titolo', livello: titolo[1]!.length, pezzi: leggiRiga(titolo[2]!.trim()) });
            continue;
        }
        const immagine = IMMAGINE.exec(riga.trim());
        if (immagine) {
            chiudiParagrafo();
            blocchi.push({ tipo: 'immagine', didascalia: immagine[1] ?? '', chiave: immagine[2]!.slice('diagramma:'.length) });
            continue;
        }
        if (riga.trim().startsWith('|') && SEPARATORE_TABELLA.test(righe[i + 1] ?? '')) {
            chiudiParagrafo();
            const intestazione = celleTabella(riga).map(leggiRiga);
            const corpo: Riga[][] = [];
            i += 2;
            while (i < righe.length && (righe[i] ?? '').trim().startsWith('|')) {
                corpo.push(celleTabella(righe[i]!).map(leggiRiga));
                i++;
            }
            i--;
            blocchi.push({ tipo: 'tabella', intestazione, righe: corpo });
            continue;
        }
        const puntato = PUNTATO.exec(riga);
        const numerato = puntato ? null : NUMERATO.exec(riga);
        if (puntato || numerato) {
            chiudiParagrafo();
            const ordinato = !!numerato;
            const modello = ordinato ? NUMERATO : PUNTATO;
            const voci: Riga[] = [];
            while (i < righe.length) {
                const m = modello.exec(righe[i] ?? '');
                if (!m) break;
                voci.push(leggiRiga(m[1]!));
                i++;
            }
            i--;
            blocchi.push({ tipo: 'elenco', ordinato, voci });
            continue;
        }
        paragrafo.push(leggiRiga(riga));
    }
    chiudiParagrafo();
    return blocchi;
}

// Toglie il titolo iniziale del documento e la riga "Data: …" che lo segue: li sostituisce il frontespizio,
// e i titoli scalano di un livello (## diventa 1)
export function corpoDocumento(blocchi: BloccoMd[]): BloccoMd[] {
    let resto = blocchi;
    if (resto[0]?.tipo === 'titolo' && resto[0].livello === 1) {
        resto = resto.slice(1);
        const primo = resto[0];
        if (primo?.tipo === 'paragrafo' && testoDi(primo.righe[0] ?? []).startsWith('Data:')) resto = resto.slice(1);
    }
    return resto.map((b) => (b.tipo === 'titolo' ? { ...b, livello: Math.max(1, b.livello - 1) } : b));
}

export function testoDi(riga: Riga): string {
    return riga.map((p) => p.testo).join('');
}
