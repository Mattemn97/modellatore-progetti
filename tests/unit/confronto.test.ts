/* --- TEST: CONFRONTO DEI BLOCCHI UGUALE A start.py (oracolo in dati/confronti.json) --- */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { avanzaVersione, confrontaBlocco, confrontaLibrerie, livelloDi, type Modifica } from '../../src/main/api/confronto';

interface Caso {
    prima: unknown;
    dopo: unknown;
    rinomine: Record<string, string>;
    modifica: Modifica | null;
    livello: string | null;
}

const casi = JSON.parse(fs.readFileSync(path.join(__dirname, 'dati', 'confronti.json'), 'utf-8')) as Caso[];

describe('confrontaBlocco e livelloDi come start.py', () => {
    it(`${casi.length} casi generati da Python danno la stessa modifica e lo stesso livello`, () => {
        for (const [i, caso] of casi.entries()) {
            const modifica = confrontaBlocco('b', caso.prima, caso.dopo, caso.rinomine);
            expect(modifica, `caso ${i}`).toEqual(caso.modifica);
            expect(modifica ? livelloDi([modifica]) : null, `caso ${i}`).toBe(caso.livello);
        }
    });

    it('scambio di due id con le rinomine: due rinominato, livello major', () => {
        const prima = { id: 'b', titolo: 'B', requisiti: [{ id: 'a', titolo: 'A' }, { id: 'c', titolo: 'C' }] };
        const dopo = { id: 'b', titolo: 'B', requisiti: [{ id: 'c', titolo: 'A' }, { id: 'a', titolo: 'C' }] };
        const m = confrontaBlocco('b', prima, dopo, { a: 'c', c: 'a' });
        expect(m?.requisiti).toEqual([
            { id: 'c', tipo: 'rinominato', idPrecedente: 'a', campi: [] },
            { id: 'a', tipo: 'rinominato', idPrecedente: 'c', campi: [] }
        ]);
        expect(m && livelloDi([m])).toBe('major');
    });

    it('confrontaLibrerie segue l\'ordine dei blocchi di prima, poi i nuovi', () => {
        const m = confrontaLibrerie({ x: { titolo: 'X', requisiti: [] }, y: { titolo: 'Y', requisiti: [] } }, { y: { titolo: 'Y2', requisiti: [] }, z: { titolo: 'Z', requisiti: [] } });
        expect(m.map((x) => [x.blocco, x.tipo])).toEqual([['x', 'eliminato'], ['y', 'modificato'], ['z', 'creato']]);
    });

    it('avanzaVersione', () => {
        expect(avanzaVersione('1.2.3', 'patch')).toBe('1.2.4');
        expect(avanzaVersione('1.2.3', 'minor')).toBe('1.3.0');
        expect(avanzaVersione('1.2.3', 'major')).toBe('2.0.0');
    });
});
