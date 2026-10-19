/* --- GEOMETRIA DEI BLOCCHI IN STILE IDV: INTESTAZIONE, RIGHE DEI REQUISITI E PORTE AI LATI (spec 0035) --- */
// Un blocco è un componente IDV: intestazione con nome, categoria e badge del tipo, poi una riga per requisito
// (nell'ordine della libreria) e, per un matrioska, una fascia con le porte propagate dai blocchi interni.
// La porta di una riga sta sul bordo sinistro o destro alla sua altezza: interfaccia sul bordo, capacità appena
// dentro. Il lato è quello salvato (Shift+trascina) oppure quello verso l'altro capo del filo.
// Funzioni pure: le usano renderer.ts e diagramma.ts, mai calcoli separati.

import { isInterfaccia } from './model.js';
import { chiavePorta, portePropagate } from './porte.js';
import type { Blocco, Impostazioni, Libreria, Nodo, Punto, Requisito, RequisitoLibreria } from './tipi.js';

type Geometria = Pick<Impostazioni, 'node' | 'grid'>;

export type Lato = 'left' | 'right';

// Misure del disegno (stile del componente IDV, non sono impostazioni di progetto)
export const LARGHEZZA_MINIMA = 200;
export const ALTEZZA_TESTA = 50;
export const ALTEZZA_RIGA = 20;
export const ALTEZZA_FASCIA_PROPAGATE = 18;
const PIEDE = 4;
// Distanza dal bordo del marcatore di una capacità (l'interfaccia sta sul bordo)
export const RIENTRO_CAPACITA = 9;

export interface RigaBlocco {
    // reqId, o percorso:reqId per una porta propagata
    chiave: string;
    reqId: string;
    percorso: string[];
    req: RequisitoLibreria;
    interfaccia: boolean;
    propagata: boolean;
    // Etichette dei nodi interni (solo porte propagate)
    etichette: string[];
    // Centro verticale della riga, relativo al blocco
    y: number;
}

export interface FormaBlocco {
    larghezza: number;
    altezza: number;
    righe: RigaBlocco[];
    // Inizio della fascia delle porte propagate (relativo), null se non ce ne sono
    inizioPropagate: number | null;
}

export function larghezzaBlocco(node: Nodo, imp: Geometria): number {
    return Math.max(node.width || imp.node.width, LARGHEZZA_MINIMA);
}

// Forma del blocco: le righe vengono dai requisiti della libreria e dalle porte propagate dell'interno di adesso
export function formaBlocco(node: Nodo, def: Blocco, libreria: Libreria, imp: Geometria): FormaBlocco {
    const righe: RigaBlocco[] = [];
    let y = ALTEZZA_TESTA;
    def.requisiti.forEach((req) => {
        righe.push({ chiave: req.id, reqId: req.id, percorso: [], req, interfaccia: isInterfaccia(req), propagata: false, etichette: [], y: y + ALTEZZA_RIGA / 2 });
        y += ALTEZZA_RIGA;
    });
    // Un blocco senza requisiti ha una riga vuota con la scritta
    if (!def.requisiti.length) y += ALTEZZA_RIGA;
    const propagate = portePropagate(node, libreria);
    let inizioPropagate: number | null = null;
    if (propagate.length) {
        inizioPropagate = y;
        y += ALTEZZA_FASCIA_PROPAGATE;
        propagate.forEach((p) => {
            righe.push({
                chiave: chiavePorta(p.reqId, p.percorso), reqId: p.reqId, percorso: p.percorso, req: p.req,
                interfaccia: true, propagata: true, etichette: p.etichette, y: y + ALTEZZA_RIGA / 2
            });
            y += ALTEZZA_RIGA;
        });
    }
    return { larghezza: larghezzaBlocco(node, imp), altezza: y + PIEDE, righe, inizioPropagate };
}

// Lato salvato con Shift+trascina; dalle versioni prima della 2.3 anche 'top'/'bottom', che vanno al lato più vicino
export function latoSalvato(node: Nodo, chiave: string): Lato | null {
    const pin = node.pinPositions?.[chiave];
    if (!pin) return null;
    if (pin.side === 'left' || pin.side === 'right') return pin.side;
    return pin.ratio < 0.5 ? 'left' : 'right';
}

export function rigaDi(forma: FormaBlocco, reqId: string, percorso: readonly string[] = []): RigaBlocco | undefined {
    const chiave = chiavePorta(reqId, percorso);
    return forma.righe.find((r) => r.chiave === chiave);
}

// Punto della porta di una riga, relativo al blocco
export function puntoRigaRelativo(forma: FormaBlocco, riga: RigaBlocco, lato: Lato): Punto {
    const rientro = riga.interfaccia ? 0 : RIENTRO_CAPACITA;
    return { x: lato === 'left' ? rientro : forma.larghezza - rientro, y: riga.y };
}

export function puntoRiga(node: Nodo, forma: FormaBlocco, riga: RigaBlocco, lato: Lato): Punto {
    const p = puntoRigaRelativo(forma, riga, lato);
    return { x: node.position.x + p.x, y: node.position.y + p.y };
}

// Lato scelto dal mouse durante Shift+trascina: la metà del blocco in cui sta il cursore
export function latoDalPunto(node: Nodo, forma: FormaBlocco, p: Punto): Lato {
    return p.x < node.position.x + forma.larghezza / 2 ? 'left' : 'right';
}

/* --- Testi: misura e taglio con i puntini, come nell'IDV --- */

const FONT = "'Segoe UI', system-ui, Arial, sans-serif";
const MONO = "Consolas, 'Cascadia Mono', monospace";
let contestoMisura: CanvasRenderingContext2D | null | undefined;
const cacheMisure = new Map<string, number>();

export function fontTesto(px: number, grassetto = false, mono = false): string {
    return `${grassetto ? '700 ' : ''}${px}px ${mono ? MONO : FONT}`;
}

// Larghezza di un testo: con il canvas quando c'è, altrimenti una stima (test, ambienti senza canvas)
export function larghezzaTesto(testo: string, px: number, grassetto = false, mono = false): number {
    const font = fontTesto(px, grassetto, mono);
    const chiave = `${font}\u0001${testo}`;
    const nota = cacheMisure.get(chiave);
    if (nota !== undefined) return nota;
    if (contestoMisura === undefined) {
        try {
            contestoMisura = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
        } catch {
            contestoMisura = null;
        }
    }
    let w: number;
    if (contestoMisura && typeof contestoMisura.measureText === 'function') {
        contestoMisura.font = font;
        w = contestoMisura.measureText(testo).width;
        if (!Number.isFinite(w) || (w === 0 && testo)) w = testo.length * px * (mono ? 0.6 : 0.55);
    } else {
        w = testo.length * px * (mono ? 0.6 : 0.55) * (grassetto ? 1.06 : 1);
    }
    if (cacheMisure.size > 5000) cacheMisure.clear();
    cacheMisure.set(chiave, w);
    return w;
}

export function tagliaTesto(testo: string, px: number, massimo: number, grassetto = false, mono = false): string {
    if (massimo <= 0) return '';
    if (larghezzaTesto(testo, px, grassetto, mono) <= massimo) return testo;
    let basso = 0;
    let alto = testo.length;
    while (basso < alto) {
        const medio = (basso + alto + 1) >> 1;
        if (larghezzaTesto(`${testo.slice(0, medio)}…`, px, grassetto, mono) <= massimo) basso = medio;
        else alto = medio - 1;
    }
    return `${testo.slice(0, basso)}…`;
}

// Sigla della classe a destra della riga: le prime lettere della tipologia, CAP per la capacità
export function siglaClasse(req: Requisito): string {
    if (!isInterfaccia(req)) return 'CAP';
    const pulita = req.tipologia.normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');
    return (pulita.slice(0, 3) || req.tipologia.slice(0, 3)).toUpperCase();
}

// Colore stabile per un testo (categoria del blocco): la stessa tavolozza dei domini IDV
const TAVOLOZZA = ['#2a78d6', '#6250d6', '#0f8a7e', '#c2417a', '#008300', '#d59a00', '#d03b3b', '#e06a2c', '#8c1d18', '#6f7c8c'];
export function coloreDaTesto(testo: string): string {
    let h = 0;
    for (const c of testo) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return TAVOLOZZA[h % TAVOLOZZA.length]!;
}
