/* --- XML MINIMO PER I FILE .xlsx: ELEMENTI, ATTRIBUTI, TESTO E CODA COME ElementTree --- */
// Niente DTD né entità definite dal file: chi chiama rifiuta prima i documenti con DOCTYPE

export class ErroreXml extends Error {}

export interface Elemento {
    tag: string;
    attributi: Record<string, string>;
    figli: Elemento[];
    // Testo prima del primo figlio (ElementTree .text) e dopo la chiusura (.tail)
    testo: string;
    coda: string;
}

// Nome senza prefisso o namespace: accetta l'OOXML di Excel e la variante strict
export function locale(nome: string): string {
    const graffa = nome.lastIndexOf('}');
    const senzaUri = graffa >= 0 ? nome.slice(graffa + 1) : nome;
    const duePunti = senzaUri.lastIndexOf(':');
    return duePunti >= 0 ? senzaUri.slice(duePunti + 1) : senzaUri;
}

// Attributo cercato per nome locale (es. l'id della relazione, che ha un prefisso)
export function attributo(el: Elemento, nome: string): string | null {
    for (const [chiave, valore] of Object.entries(el.attributi)) {
        if (locale(chiave) === nome) return valore;
    }
    return null;
}

// Tutti gli elementi in ordine di documento, l'elemento stesso per primo (ElementTree .iter())
export function* tutti(el: Elemento): Generator<Elemento> {
    yield el;
    for (const figlio of el.figli) yield* tutti(figlio);
}

const ENTITA: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodificaEntita(testo: string): string {
    return testo.replace(/&([^;&\s]*);?/g, (intero, nome: string) => {
        if (!intero.endsWith(';')) throw new ErroreXml('entità non chiusa');
        if (nome.startsWith('#x') || nome.startsWith('#X')) {
            const n = Number.parseInt(nome.slice(2), 16);
            if (!Number.isFinite(n)) throw new ErroreXml('riferimento non valido');
            return String.fromCodePoint(n);
        }
        if (nome.startsWith('#')) {
            const n = Number.parseInt(nome.slice(1), 10);
            if (!Number.isFinite(n)) throw new ErroreXml('riferimento non valido');
            return String.fromCodePoint(n);
        }
        const valore = ENTITA[nome];
        if (valore === undefined) throw new ErroreXml(`entità sconosciuta: ${nome}`);
        return valore;
    });
}

function normalizzaFineRiga(testo: string): string {
    return testo.replace(/\r\n?/g, '\n');
}

const NOME = /[^\s/>=]+/y;

export function analizzaXml(sorgente: string): Elemento {
    const testo = normalizzaFineRiga(sorgente.charCodeAt(0) === 0xfeff ? sorgente.slice(1) : sorgente);
    let p = 0;
    const pila: Elemento[] = [];
    let radice: Elemento | null = null;
    // Dove va il testo: .testo del genitore se non ha ancora figli, altrimenti .coda dell'ultimo figlio
    const aggiungiTesto = (pezzo: string) => {
        const genitore = pila.at(-1);
        if (!genitore) {
            if (pezzo.trim()) throw new ErroreXml('testo fuori dalla radice');
            return;
        }
        const ultimo = genitore.figli.at(-1);
        if (ultimo) ultimo.coda += pezzo;
        else genitore.testo += pezzo;
    };

    while (p < testo.length) {
        const apertura = testo.indexOf('<', p);
        if (apertura < 0) {
            aggiungiTesto(decodificaEntita(testo.slice(p)));
            break;
        }
        if (apertura > p) aggiungiTesto(decodificaEntita(testo.slice(p, apertura)));
        if (testo.startsWith('<?', apertura)) {
            const fine = testo.indexOf('?>', apertura);
            if (fine < 0) throw new ErroreXml('istruzione non chiusa');
            p = fine + 2;
        } else if (testo.startsWith('<!--', apertura)) {
            const fine = testo.indexOf('-->', apertura);
            if (fine < 0) throw new ErroreXml('commento non chiuso');
            p = fine + 3;
        } else if (testo.startsWith('<![CDATA[', apertura)) {
            const fine = testo.indexOf(']]>', apertura);
            if (fine < 0) throw new ErroreXml('CDATA non chiuso');
            aggiungiTesto(testo.slice(apertura + 9, fine));
            p = fine + 3;
        } else if (testo.startsWith('<!', apertura)) {
            throw new ErroreXml('dichiarazione non ammessa');
        } else if (testo.startsWith('</', apertura)) {
            const fine = testo.indexOf('>', apertura);
            if (fine < 0) throw new ErroreXml('tag di chiusura non chiuso');
            const nome = testo.slice(apertura + 2, fine).trim();
            const aperto = pila.pop();
            if (!aperto || aperto.tag !== nome) throw new ErroreXml('tag non corrispondente');
            p = fine + 1;
        } else {
            NOME.lastIndex = apertura + 1;
            const m = NOME.exec(testo);
            if (!m) throw new ErroreXml('nome del tag mancante');
            const el: Elemento = { tag: m[0], attributi: {}, figli: [], testo: '', coda: '' };
            p = NOME.lastIndex;
            for (;;) {
                while (p < testo.length && /\s/.test(testo[p] as string)) p++;
                if (testo.startsWith('/>', p)) { p += 2; break; }
                if (testo[p] === '>') { p += 1; pila.push(el); break; }
                NOME.lastIndex = p;
                const a = NOME.exec(testo);
                if (!a) throw new ErroreXml('attributo non valido');
                p = NOME.lastIndex;
                while (/\s/.test(testo[p] ?? '')) p++;
                if (testo[p] !== '=') throw new ErroreXml('attributo senza valore');
                p++;
                while (/\s/.test(testo[p] ?? '')) p++;
                const virgoletta = testo[p];
                if (virgoletta !== '"' && virgoletta !== "'") throw new ErroreXml('valore senza virgolette');
                const fine = testo.indexOf(virgoletta, p + 1);
                if (fine < 0) throw new ErroreXml('valore non chiuso');
                const valore = testo.slice(p + 1, fine);
                if (valore.includes('<')) throw new ErroreXml('< in un attributo');
                // Normalizzazione degli attributi XML: spazi bianchi diventano spazi
                el.attributi[a[0]] = decodificaEntita(valore.replace(/[\t\n]/g, ' '));
                p = fine + 1;
            }
            const genitore = pila.at(pila.includes(el) ? -2 : -1);
            if (genitore) genitore.figli.push(el);
            else if (radice) throw new ErroreXml('più di una radice');
            else radice = el;
        }
    }
    if (pila.length > 0 || !radice) throw new ErroreXml('documento incompleto');
    return radice;
}
