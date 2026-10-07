/* --- TEST: INSTRADAMENTO DEI FILI AD ANGOLI RETTI INTORNO AI BLOCCHI (spec 0033) --- */
import { beforeEach, describe, expect, it } from 'vitest';
import { instrada, puntoDiUscita, semplifica, svuotaCachePercorsi, trattoPiuVicino, type EstremoFilo, type Rettangolo } from '../../src/renderer/instradamento';
import type { Punto } from '../../src/renderer/tipi';

const M = 20;
const blocco = (x: number, y: number, w = 160, h = 60): Rettangolo => ({ x1: x, y1: y, x2: x + w, y2: y + h });

// Un tratto orizzontale o verticale passa dentro un rettangolo (aperto)?
function attraversa(a: Punto, b: Punto, r: Rettangolo): boolean {
    if (a.y === b.y) return a.y > r.y1 && a.y < r.y2 && Math.max(a.x, b.x) > r.x1 && Math.min(a.x, b.x) < r.x2;
    return a.x > r.x1 && a.x < r.x2 && Math.max(a.y, b.y) > r.y1 && Math.min(a.y, b.y) < r.y2;
}

function controllaPercorso(punti: Punto[], ostacoli: Rettangolo[]): void {
    for (let i = 0; i < punti.length - 1; i++) {
        const a = punti[i]!;
        const b = punti[i + 1]!;
        // Solo tratti orizzontali o verticali
        expect(a.x === b.x || a.y === b.y, `tratto ${i} obliquo: ${JSON.stringify([a, b])}`).toBe(true);
        // Il primo e l'ultimo tratto escono dal blocco del pin; gli altri non toccano nessun blocco
        if (i === 0 || i === punti.length - 2) continue;
        ostacoli.forEach((o) => expect(attraversa(a, b, o), `tratto ${i} dentro ${JSON.stringify(o)}`).toBe(false));
    }
}

beforeEach(() => svuotaCachePercorsi());

describe('instrada', () => {
    it('due porte una di fronte all\'altra con un blocco in mezzo: il filo gira intorno', () => {
        const a = blocco(0, 100);
        const ostacolo = blocco(300, 80, 100, 100);
        const b = blocco(600, 100);
        const da: EstremoFilo = { punto: { x: 160, y: 130 }, direzione: 'destra', proprio: a };
        const verso: EstremoFilo = { punto: { x: 600, y: 130 }, direzione: 'sinistra', proprio: b };
        const punti = instrada(da, verso, [a, ostacolo, b], M);
        expect(punti[0]).toEqual({ x: 160, y: 130 });
        expect(punti.at(-1)).toEqual({ x: 600, y: 130 });
        controllaPercorso(punti, [a, ostacolo, b]);
        // Esce a destra dalla porta e arriva da sinistra
        expect(punti[1]!.y).toBe(130);
        expect(punti[1]!.x).toBeGreaterThan(160);
        expect(punti.at(-2)!.y).toBe(130);
        expect(punti.at(-2)!.x).toBeLessThan(600);
        // Resta a un passo di griglia dall'ostacolo
        punti.slice(1, -1).forEach((p) => expect(p.x <= 300 - M || p.x >= 400 + M || p.y <= 80 - M || p.y >= 180 + M).toBe(true));
    });

    it('senza nulla in mezzo è una retta', () => {
        const a = blocco(0, 100);
        const b = blocco(400, 100);
        const punti = instrada({ punto: { x: 160, y: 130 }, direzione: 'destra', proprio: a }, { punto: { x: 400, y: 130 }, direzione: 'sinistra', proprio: b }, [a, b], M);
        expect(punti).toEqual([{ x: 160, y: 130 }, { x: 400, y: 130 }]);
    });

    it('un pin di capacità attraversa il suo blocco solo nel primo tratto', () => {
        const a = blocco(0, 0);
        const b = blocco(0, 300);
        const pin: EstremoFilo = { punto: { x: 80, y: 48 }, direzione: 'giu', proprio: a };
        expect(puntoDiUscita(pin, M)).toEqual({ x: 80, y: 80 });
        const punti = instrada(pin, { punto: { x: 80, y: 312 }, direzione: 'su', proprio: b }, [a, b], M);
        expect(punti).toEqual([{ x: 80, y: 48 }, { x: 80, y: 312 }]);
    });

    it('preferisce poche curve: una L invece di una scala', () => {
        const a = blocco(0, 0);
        const b = blocco(400, 300);
        const punti = instrada({ punto: { x: 160, y: 30 }, direzione: 'destra', proprio: a }, { punto: { x: 480, y: 300 }, direzione: 'su', proprio: b }, [a, b], M);
        controllaPercorso(punti, [a, b]);
        expect(punti).toEqual([{ x: 160, y: 30 }, { x: 480, y: 30 }, { x: 480, y: 300 }]);
    });

    it('chiuso da ogni lato: ripiega su una L senza bloccarsi', () => {
        const a = blocco(0, 0);
        const b = blocco(1000, 0);
        // Un muro che avvolge l'uscita di a
        const muri = [blocco(170, -200, 20, 500), blocco(-200, -200, 400, 20), blocco(-200, 260, 400, 20), blocco(-220, -200, 20, 480)];
        const punti = instrada({ punto: { x: 160, y: 30 }, direzione: 'destra', proprio: a }, { punto: { x: 1000, y: 30 }, direzione: 'sinistra', proprio: b }, [a, b, ...muri], M);
        expect(punti[0]).toEqual({ x: 160, y: 30 });
        expect(punti.at(-1)).toEqual({ x: 1000, y: 30 });
        punti.slice(0, -1).forEach((p, i) => { const q = punti[i + 1]!; expect(p.x === q.x || p.y === q.y).toBe(true); });
    });

    it('livello affollato: 50 blocchi e 100 fili in poco tempo, e quasi nulla al secondo disegno', () => {
        const blocchi: Rettangolo[] = [];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) blocchi.push(blocco(c * 260, r * 160));
        const fili: Array<[EstremoFilo, EstremoFilo]> = [];
        for (let i = 0; i < 100; i++) {
            const a = blocchi[(i * 7) % 50]!;
            const b = blocchi[(i * 13 + 5) % 50]!;
            if (a === b) continue;
            fili.push([{ punto: { x: a.x2, y: a.y1 + 30 }, direzione: 'destra', proprio: a }, { punto: { x: b.x1, y: b.y1 + 30 }, direzione: 'sinistra', proprio: b }]);
        }
        let t = performance.now();
        const percorsi = fili.map(([a, b]) => instrada(a, b, blocchi, M));
        const primo = performance.now() - t;
        percorsi.forEach((p) => controllaPercorso(p, blocchi));
        t = performance.now();
        fili.forEach(([a, b]) => instrada(a, b, blocchi, M));
        const secondo = performance.now() - t;
        expect(primo).toBeLessThan(3000);
        expect(secondo).toBeLessThan(primo);
        expect(secondo).toBeLessThan(100);
    });
});

describe('aiuti', () => {
    it('semplifica toglie i doppioni e i punti in mezzo ai tratti dritti', () => {
        expect(semplifica([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 5 }])).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 5 }]);
    });

    it('trattoPiuVicino', () => {
        const punti = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
        expect(trattoPiuVicino(punti, { x: 50, y: 5 })).toBe(0);
        expect(trattoPiuVicino(punti, { x: 95, y: 60 })).toBe(1);
    });
});
