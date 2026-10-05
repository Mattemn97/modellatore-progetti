/* --- TEST: JSON COME PYTHON, IMPRONTE, COPIE NUMERATE E SLUG (spec 0018) --- */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formaCanonica, improntaDi, interpretaJson, numeriCopie, ruotaCopie, serializza, valoriUguali } from '../../src/main/api/file';
import { ErroreApi } from '../../src/main/api/errori';
import { slugValido } from '../../src/main/api/progetti';

// Valore con chiavi non ASCII, fuori dal piano base, caratteri di controllo e separatori di riga
// b: separatore di riga, virgolette, barra rovesciata seguita da "n", carattere di controllo 0x1f
const DIFFICILE = { z: 1, [String.fromCodePoint(0xe9)]: String.fromCodePoint(0xe0), A: [true, null, { b: String.fromCharCode(0x2028, 34, 92, 110, 31), a: -3 }], [String.fromCodePoint(0x1f600)]: 'x', [String.fromCodePoint(0xff21)]: 'y', '': 0 };

describe('JSON come start.py', () => {
    it('forma canonica: stessi byte di json.dumps(sort_keys=True, ensure_ascii=False, separators=(",", ":"))', () => {
        // Impronte calcolate con Python 3 sullo stesso valore
        expect(improntaDi(formaCanonica(DIFFICILE))).toBe('f6784c5ebc28b2549d9cfe5933f864f0fab275b7');
        // Ordine per punto di codice: U+FF21 prima di U+1F600 (in UTF-16 sarebbe il contrario)
        const testo = formaCanonica(DIFFICILE).toString('utf-8');
        expect(testo.indexOf(String.fromCodePoint(0xff21))).toBeLessThan(testo.indexOf(String.fromCodePoint(0x1f600)));
    });

    it('serializza: stessi byte di json.dumps(indent=2, ensure_ascii=False)', () => {
        expect(improntaDi(serializza(DIFFICILE))).toBe('24ab5b2f2080343bfeae9c50027c1d9af155472c');
        expect(serializza({ a: [], b: {}, c: [1] }).toString('utf-8')).toBe('{\n  "a": [],\n  "b": {},\n  "c": [\n    1\n  ]\n}');
    });

    it('valoriUguali ignora l\'ordine delle chiavi ma non quello degli elenchi', () => {
        expect(valoriUguali({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
        expect(valoriUguali({ b: [2, 1] }, { b: [1, 2] })).toBe(false);
    });

    it('interpretaJson: 422 per JSON rotto, non oggetto o con BOM (come bytes.decode di Python)', () => {
        expect(interpretaJson(Buffer.from('{"a":1}'), 'x')).toEqual({ a: 1 });
        for (const testo of ['{', '[1]', '﻿{"a":1}']) {
            expect(() => interpretaJson(Buffer.from(testo, 'utf-8'), 'messaggio')).toThrowError(ErroreApi);
        }
        expect(() => interpretaJson(Buffer.from([0xff, 0x7b]), 'x')).toThrowError(ErroreApi);
    });
});

describe('copie numerate', () => {
    let cartella = '';
    beforeEach(() => { cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'modellatore-unit-')); });
    afterEach(() => { fs.rmSync(cartella, { recursive: true, force: true }); });

    it('ruota .1 → .2 → .3, scarta oltre il massimo e non duplica una rotazione già fatta', () => {
        for (const n of [1, 2, 3, 4]) ruotaCopie(cartella, 'p', Buffer.from(`v${n}`), 3);
        expect(numeriCopie(cartella, 'p').sort()).toEqual([1, 2, 3]);
        expect(fs.readFileSync(path.join(cartella, 'p.1.json'), 'utf-8')).toBe('v4');
        expect(fs.readFileSync(path.join(cartella, 'p.3.json'), 'utf-8')).toBe('v2');
        ruotaCopie(cartella, 'p', Buffer.from('v4'), 3);
        expect(fs.readFileSync(path.join(cartella, 'p.2.json'), 'utf-8')).toBe('v3');
        // Massimo sceso a 1: restano solo le copie sotto il limite più la nuova
        ruotaCopie(cartella, 'p', Buffer.from('v5'), 1);
        expect(numeriCopie(cartella, 'p')).toEqual([1]);
    });

    it('numeriCopie ignora nomi simili', () => {
        for (const nome of ['p.1.json', 'p.x.json', 'pp.2.json', 'p.3.json.tmp']) fs.writeFileSync(path.join(cartella, nome), '');
        expect(numeriCopie(cartella, 'p')).toEqual([1]);
    });
});

describe('slug dei progetti', () => {
    it('accetta minuscole, cifre e underscore singoli; rifiuta nomi riservati e lunghi', () => {
        for (const s of ['a', 'progetto_1', 'a1_b2_c3']) expect(slugValido(s)).toBe(true);
        for (const s of ['', 'A', 'a__b', '_a', 'a_', 'con', 'com1', 'lpt9', 'a-b', 'a'.repeat(81), 3, null]) expect(slugValido(s)).toBe(false);
        expect(slugValido('a'.repeat(80))).toBe(true);
    });
});
