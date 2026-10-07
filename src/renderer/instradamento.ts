/* --- INSTRADAMENTO DEI FILI: PERCORSI AD ANGOLI RETTI INTORNO AI BLOCCHI (spec 0033) --- */
// Funzioni pure, senza pagina né stato: le usano il canvas e i diagrammi tramite percorsoFilo() (diagramma.ts).
// A* su una griglia sparsa (griglia di Hanan): le righe e le colonne candidate passano per i bordi dei blocchi
// allargati di un margine e per i due estremi. Costo = lunghezza + una penalità per curva.

import type { Punto } from './tipi.js';

export interface Rettangolo {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export type Direzione = 'su' | 'giu' | 'sinistra' | 'destra';

export interface EstremoFilo {
    // Centro del pin
    punto: Punto;
    // Verso in cui il filo lascia il pin
    direzione: Direzione;
    // Il riquadro da cui il pin esce (il suo blocco o il suo blocco tondo): il primo tratto lo attraversa
    proprio: Rettangolo | null;
}

// Indici delle direzioni: l'opposta di d è d ^ 1
const DIREZIONI: Direzione[] = ['su', 'giu', 'sinistra', 'destra'];
const PASSI: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
// Quanto si allarga, attorno ai due estremi, la zona in cui si cercano blocchi e percorsi
const ZONA = 240;
const MAX_ESPANSIONI = 200_000;
const MAX_CACHE = 4000;

const cache = new Map<string, Punto[] | 'globale'>();

function indiceDirezione(d: Direzione): number {
    return DIREZIONI.indexOf(d);
}

// Primo punto fuori dal riquadro del pin, a un margine di distanza, nel verso di uscita
export function puntoDiUscita(e: EstremoFilo, margine: number): Punto {
    const p = e.punto;
    const r = e.proprio;
    switch (e.direzione) {
        case 'su': return { x: p.x, y: Math.min(p.y, r ? r.y1 : p.y) - margine };
        case 'giu': return { x: p.x, y: Math.max(p.y, r ? r.y2 : p.y) + margine };
        case 'sinistra': return { x: Math.min(p.x, r ? r.x1 : p.x) - margine, y: p.y };
        case 'destra': return { x: Math.max(p.x, r ? r.x2 : p.x) + margine, y: p.y };
    }
}

// Toglie i punti ripetuti e quelli in mezzo a un tratto dritto
export function semplifica(punti: Punto[]): Punto[] {
    const uniti: Punto[] = [];
    punti.forEach((p) => {
        const ultimo = uniti[uniti.length - 1];
        if (!ultimo || ultimo.x !== p.x || ultimo.y !== p.y) uniti.push(p);
    });
    return uniti.filter((p, i) => {
        const a = uniti[i - 1];
        const b = uniti[i + 1];
        if (!a || !b) return true;
        return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
    });
}

function dentroAperto(r: Rettangolo, p: Punto): boolean {
    return p.x > r.x1 && p.x < r.x2 && p.y > r.y1 && p.y < r.y2;
}

function allarga(r: Rettangolo, m: number): Rettangolo {
    return { x1: r.x1 - m, y1: r.y1 - m, x2: r.x2 + m, y2: r.y2 + m };
}

function siToccano(a: Rettangolo, b: Rettangolo): boolean {
    return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function chiaveRettangoli(lista: Rettangolo[]): string {
    return lista.map((r) => `${r.x1},${r.y1},${r.x2},${r.y2}`).join(';');
}

// Coda con priorità minima (heap binario) di stati con la loro stima
class Coda {
    private stime: number[] = [];
    private stati: number[] = [];

    get vuota(): boolean {
        return this.stati.length === 0;
    }

    get minimo(): number {
        return this.stime[0] ?? Infinity;
    }

    metti(stima: number, stato: number): void {
        const s = this.stime;
        const t = this.stati;
        let i = s.length;
        s.push(stima);
        t.push(stato);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (s[p]! <= stima) break;
            s[i] = s[p]!;
            t[i] = t[p]!;
            i = p;
        }
        s[i] = stima;
        t[i] = stato;
    }

    togli(): number {
        const s = this.stime;
        const t = this.stati;
        const primo = t[0]!;
        const ultimaStima = s.pop()!;
        const ultimoStato = t.pop()!;
        if (t.length > 0) {
            let i = 0;
            const n = t.length;
            for (;;) {
                const sx = 2 * i + 1;
                if (sx >= n) break;
                const dx = sx + 1;
                const figlio = dx < n && s[dx]! < s[sx]! ? dx : sx;
                if (s[figlio]! >= ultimaStima) break;
                s[i] = s[figlio]!;
                t[i] = t[figlio]!;
                i = figlio;
            }
            s[i] = ultimaStima;
            t[i] = ultimoStato;
        }
        return primo;
    }
}

// Percorso da s a e (inclusi) sulla griglia di Hanan dentro la zona, o null se non c'è.
// partenza: verso del tratto che arriva in s; arrivo: verso del tratto che lascia e verso il pin
function cerca(s: Punto, e: Punto, partenza: number, arrivo: number, ostacoli: Rettangolo[], zona: Rettangolo, curva: number): Punto[] | null {
    const xsInsieme = new Set<number>([s.x, e.x, zona.x1, zona.x2]);
    const ysInsieme = new Set<number>([s.y, e.y, zona.y1, zona.y2]);
    ostacoli.forEach((o) => {
        if (o.x1 >= zona.x1 && o.x1 <= zona.x2) xsInsieme.add(o.x1);
        if (o.x2 >= zona.x1 && o.x2 <= zona.x2) xsInsieme.add(o.x2);
        if (o.y1 >= zona.y1 && o.y1 <= zona.y2) ysInsieme.add(o.y1);
        if (o.y2 >= zona.y1 && o.y2 <= zona.y2) ysInsieme.add(o.y2);
    });
    const xs = [...xsInsieme].sort((a, b) => a - b);
    const ys = [...ysInsieme].sort((a, b) => a - b);
    const nx = xs.length;
    const ny = ys.length;
    const indiceX = new Map(xs.map((x, i) => [x, i]));
    const indiceY = new Map(ys.map((y, i) => [y, i]));

    // Griglia doppia: (2i, 2j) sono i punti, (2i+1, 2j) e (2i, 2j+1) i tratti fra due punti vicini
    const larghezza = 2 * nx - 1;
    const vietato = new Uint8Array(larghezza * (2 * ny - 1));
    ostacoli.forEach((o) => {
        const da = (v: number, valori: number[], indici: Map<number, number>) => (v < valori[0]! ? 0 : 2 * indici.get(v)! + 1);
        const a = (v: number, valori: number[], indici: Map<number, number>, n: number) => (v > valori[valori.length - 1]! ? 2 * n - 2 : 2 * indici.get(v)! - 1);
        const dx1 = da(o.x1, xs, indiceX);
        const dx2 = a(o.x2, xs, indiceX, nx);
        const dy1 = da(o.y1, ys, indiceY);
        const dy2 = a(o.y2, ys, indiceY, ny);
        for (let dy = dy1; dy <= dy2; dy++) {
            const riga = dy * larghezza;
            for (let dx = dx1; dx <= dx2; dx++) vietato[riga + dx] = 1;
        }
    });

    const is = indiceX.get(s.x)!;
    const js = indiceY.get(s.y)!;
    const ie = indiceX.get(e.x)!;
    const je = indiceY.get(e.y)!;
    const libero = (dx: number, dy: number) => vietato[dy * larghezza + dx] === 0;
    if (!libero(2 * is, 2 * js) || !libero(2 * ie, 2 * je)) return null;

    const totale = nx * ny * 4;
    const costi = new Float64Array(totale).fill(Infinity);
    const padri = new Int32Array(totale).fill(-1);
    const coda = new Coda();
    const stima = (i: number, j: number) => Math.abs(xs[i]! - e.x) + Math.abs(ys[j]! - e.y);
    const inizio = (js * nx + is) * 4 + partenza;
    costi[inizio] = 0;
    coda.metti(stima(is, js), inizio);
    let migliore = Infinity;
    let fine = -1;
    let espansioni = 0;

    while (!coda.vuota && coda.minimo < migliore) {
        const stato = coda.togli();
        const d = stato & 3;
        const cella = stato >> 2;
        const i = cella % nx;
        const j = (cella - i) / nx;
        const g = costi[stato]!;
        if (i === ie && j === je) {
            const totaleArrivo = g + (d === arrivo ? 0 : curva);
            if (totaleArrivo < migliore) {
                migliore = totaleArrivo;
                fine = stato;
            }
            continue;
        }
        if (++espansioni > MAX_ESPANSIONI) return null;
        for (let d2 = 0; d2 < 4; d2++) {
            if (d2 === (d ^ 1)) continue;
            const [px, py] = PASSI[d2]!;
            const ni = i + px;
            const nj = j + py;
            if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
            if (!libero(2 * i + px, 2 * j + py) || !libero(2 * ni, 2 * nj)) continue;
            const passo = Math.abs(xs[ni]! - xs[i]!) + Math.abs(ys[nj]! - ys[j]!);
            const nuovo = g + passo + (d2 === d ? 0 : curva);
            const prossimo = (nj * nx + ni) * 4 + d2;
            if (nuovo < costi[prossimo]!) {
                costi[prossimo] = nuovo;
                padri[prossimo] = stato;
                coda.metti(nuovo + stima(ni, nj), prossimo);
            }
        }
    }
    if (fine < 0) return null;

    const punti: Punto[] = [];
    for (let stato = fine; stato >= 0; stato = padri[stato]!) {
        const cella = stato >> 2;
        const i = cella % nx;
        punti.push({ x: xs[i]!, y: ys[(cella - i) / nx]! });
    }
    return punti.reverse();
}

// Ripiego senza ostacoli: un percorso a L che parte nel verso di uscita
function percorsoAL(s: Punto, e: Punto, partenza: Direzione): Punto[] {
    const orizzontale = partenza === 'sinistra' || partenza === 'destra';
    return [s, orizzontale ? { x: e.x, y: s.y } : { x: s.x, y: e.y }, e];
}

/**
 * Percorso ad angoli retti fra due pin, intorno agli ostacoli (blocchi e blocchi tondi del livello).
 * Restituisce la spezzata completa, dal centro del primo pin al centro del secondo.
 * margine: distanza minima dai bordi degli ostacoli (un passo di griglia)
 */
export function instrada(da: EstremoFilo, a: EstremoFilo, ostacoli: Rettangolo[], margine: number): Punto[] {
    const s = puntoDiUscita(da, margine);
    const e = puntoDiUscita(a, margine);
    const partenza = indiceDirezione(da.direzione);
    // Il tratto finale va da e verso il pin: il contrario del verso di uscita di a
    const arrivo = indiceDirezione(a.direzione) ^ 1;
    const curva = margine * 2;
    // Un blocco che contiene un'uscita (due blocchi attaccati) non può fare da ostacolo a quel filo
    const allargati = ostacoli.map((o) => allarga(o, margine)).filter((o) => !dentroAperto(o, s) && !dentroAperto(o, e));
    const testa = `${da.punto.x},${da.punto.y},${da.direzione}|${a.punto.x},${a.punto.y},${a.direzione}|${s.x},${s.y}|${e.x},${e.y}|${margine}`;

    const vicina: Rettangolo = {
        x1: Math.min(s.x, e.x) - ZONA, y1: Math.min(s.y, e.y) - ZONA,
        x2: Math.max(s.x, e.x) + ZONA, y2: Math.max(s.y, e.y) + ZONA
    };
    const vicini = allargati.filter((o) => siToccano(o, vicina));
    const chiaveVicina = `${testa}|${chiaveRettangoli(vicini)}`;
    let trovato = cache.get(chiaveVicina);
    if (trovato === undefined) {
        trovato = cerca(s, e, partenza, arrivo, vicini, vicina, curva) ?? 'globale';
        ricorda(chiaveVicina, trovato);
    }
    if (trovato === 'globale') {
        // Fra i blocchi vicini non c'è passaggio: si riprova con tutti, in una zona che li contiene
        const tutta: Rettangolo = { ...vicina };
        allargati.forEach((o) => {
            tutta.x1 = Math.min(tutta.x1, o.x1 - margine);
            tutta.y1 = Math.min(tutta.y1, o.y1 - margine);
            tutta.x2 = Math.max(tutta.x2, o.x2 + margine);
            tutta.y2 = Math.max(tutta.y2, o.y2 + margine);
        });
        const chiaveTutta = `${testa}|*|${chiaveRettangoli(allargati)}`;
        let globale = cache.get(chiaveTutta);
        if (globale === undefined || globale === 'globale') {
            globale = cerca(s, e, partenza, arrivo, allargati, tutta, curva) ?? percorsoAL(s, e, da.direzione);
            ricorda(chiaveTutta, globale);
        }
        trovato = globale;
    }
    return semplifica([da.punto, ...trovato, a.punto]);
}

function ricorda(chiave: string, valore: Punto[] | 'globale'): void {
    if (cache.size >= MAX_CACHE) {
        const primo = cache.keys().next().value;
        if (primo !== undefined) cache.delete(primo);
    }
    cache.set(chiave, valore);
}

// Solo per i test: svuota la memoria dei percorsi
export function svuotaCachePercorsi(): void {
    cache.clear();
}

// Il punto del tratto più vicino a p e l'indice del tratto (per inserire uno snodo dove hai cliccato)
export function trattoPiuVicino(punti: Punto[], p: Punto): number {
    let migliore = 0;
    let distanza = Infinity;
    for (let i = 0; i < punti.length - 1; i++) {
        const a = punti[i]!;
        const b = punti[i + 1]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
        const qx = a.x + t * dx - p.x;
        const qy = a.y + t * dy - p.y;
        const d = qx * qx + qy * qy;
        if (d < distanza) {
            distanza = d;
            migliore = i;
        }
    }
    return migliore;
}
