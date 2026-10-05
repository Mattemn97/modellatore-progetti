/* --- TEST: CONFIGURAZIONE DELLE CARTELLE (spec 0019) --- */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cartelleDi, daPreparare, leggiConfigurazione, preparaCartelle, problemaCartelle, scriviConfigurazione, statoCartelle } from '../../src/main/configurazione';

let base = '';
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'modellatore-conf-')); });
afterEach(() => { fs.rmSync(base, { recursive: true, force: true }); });

describe('configurazione.json', () => {
    it('si scrive e si rilegge; librerie null = shared dentro la cartella di lavoro', () => {
        const lavoro = path.join(base, 'lavoro');
        scriviConfigurazione(base, { formatVersion: 1, cartellaLavoro: lavoro, cartellaLibrerie: null });
        const letta = leggiConfigurazione(base);
        expect(letta).toEqual({ formatVersion: 1, cartellaLavoro: lavoro, cartellaLibrerie: null });
        expect(letta && cartelleDi(letta)).toEqual({ lavoro, librerie: path.join(lavoro, 'shared') });
    });

    it('rotta, di un formato diverso o con percorsi relativi vale "non configurato"', () => {
        const file = path.join(base, 'configurazione.json');
        for (const contenuto of ['{', '[]', '{"formatVersion":2,"cartellaLavoro":"C:\\\\x"}', '{"formatVersion":1,"cartellaLavoro":"relativa"}',
            JSON.stringify({ formatVersion: 1, cartellaLavoro: path.join(base, 'x'), cartellaLibrerie: 'relativa' })]) {
            fs.writeFileSync(file, contenuto);
            expect(leggiConfigurazione(base), contenuto).toBeNull();
        }
        fs.rmSync(file);
        expect(leggiConfigurazione(base)).toBeNull();
    });
});

describe('cartelle', () => {
    it('rifiuta librerie dentro progetti/, cartelle uguali o relative', () => {
        const lavoro = path.join(base, 'lavoro');
        expect(problemaCartelle({ lavoro, librerie: path.join(lavoro, 'shared') })).toBeNull();
        expect(problemaCartelle({ lavoro, librerie: path.join(lavoro, 'progetti', 'lib') })).toMatch(/dentro la cartella dei progetti/);
        expect(problemaCartelle({ lavoro, librerie: lavoro })).toMatch(/due cartelle diverse/);
        expect(problemaCartelle({ lavoro: path.join(lavoro, 'shared', 'x'), librerie: path.join(lavoro, 'shared') })).toMatch(/dentro la cartella delle librerie/);
        expect(problemaCartelle({ lavoro: 'relativa', librerie: path.join(lavoro, 'shared') })).toMatch(/percorso completo/);
    });

    it('prepara crea ciò che manca senza sovrascrivere', () => {
        const cartelle = { lavoro: path.join(base, 'lavoro'), librerie: path.join(base, 'librerie') };
        const predefinite = path.join(base, 'predefinite.json');
        fs.writeFileSync(predefinite, '{"grid":{"size":20}}');
        expect(statoCartelle(cartelle).pronte).toBe(false);
        expect(daPreparare(cartelle)).toEqual([cartelle.lavoro, cartelle.librerie]);
        preparaCartelle(cartelle, predefinite);
        expect(statoCartelle(cartelle).pronte).toBe(true);
        expect(daPreparare(cartelle)).toEqual([]);
        expect(fs.readFileSync(path.join(cartelle.lavoro, 'settings.json'), 'utf-8')).toBe('{"grid":{"size":20}}');
        expect(JSON.parse(fs.readFileSync(path.join(cartelle.librerie, 'libreria.json'), 'utf-8')).centralina_condivisa.titolo).toBe('Centralina Condivisa');
        // Una seconda preparazione non tocca settings.json né le librerie esistenti
        fs.writeFileSync(path.join(cartelle.lavoro, 'settings.json'), '{"mio":true}');
        fs.rmSync(path.join(cartelle.librerie, 'libreria.json'));
        fs.writeFileSync(path.join(cartelle.librerie, 'altra.json'), '{}');
        preparaCartelle(cartelle, predefinite);
        expect(fs.readFileSync(path.join(cartelle.lavoro, 'settings.json'), 'utf-8')).toBe('{"mio":true}');
        expect(fs.existsSync(path.join(cartelle.librerie, 'libreria.json'))).toBe(false);
    });
});
