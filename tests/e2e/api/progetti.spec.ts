/* --- E2E CONTRATTO: API DEI PROGETTI (spec 0001, 0017 AC-1) --- */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { api, progettoVuoto } from '../api';
import { apriApp, leggiJson, pronta, type AppDiProva } from '../app';
import { LIBRERIA_PROVA } from '../dati/libreria';

type Esito = { impronta: string; versioni: number; slug?: string };

test.describe.serial('contratto /api/progetti', () => {
    let a: AppDiProva;
    const file = (...parti: string[]) => path.join(a.cartella, 'progetti', ...parti);

    test.beforeAll(async () => {
        a = await apriApp({ libreria: LIBRERIA_PROVA });
        await pronta(a.pagina);
    });
    test.afterAll(async () => { await a.chiudi(); });

    test('POST crea il file con la forma attesa e 0 versioni', async () => {
        const r = await api<Esito>(a.pagina, 'POST', '/api/progetti', { slug: 'alfa', progetto: progettoVuoto('Alfa') });
        expect(r.stato).toBe(201);
        expect(r.corpo).toEqual({ slug: 'alfa', impronta: expect.stringMatching(/^[0-9a-f]{40}$/), versioni: 0 });
        expect(leggiJson(file('alfa.json'))).toEqual(progettoVuoto('Alfa'));
        // JSON con rientro di 2 spazi, UTF-8
        expect(fs.readFileSync(file('alfa.json'), 'utf-8')).toContain('\n  "nome": "Alfa"');
    });

    test('POST su uno slug esistente risponde 409 esiste', async () => {
        const r = await api(a.pagina, 'POST', '/api/progetti', { slug: 'alfa', progetto: progettoVuoto('Alfa') });
        expect(r.stato).toBe(409);
        expect(r.corpo.errore).toBe('esiste');
    });

    test('GET elenco: slug, nome, modificato, danneggiato, dal più recente', async () => {
        fs.writeFileSync(file('rotto.json'), '{ non json', 'utf-8');
        const r = await api<{ progetti: Array<{ slug: string; nome: string; modificato: number; danneggiato: boolean }> }>(a.pagina, 'GET', '/api/progetti');
        expect(r.stato).toBe(200);
        const alfa = r.corpo.progetti.find((p) => p.slug === 'alfa');
        expect(alfa).toMatchObject({ nome: 'Alfa', danneggiato: false });
        expect(typeof alfa?.modificato).toBe('number');
        expect(r.corpo.progetti.find((p) => p.slug === 'rotto')).toMatchObject({ nome: 'rotto', danneggiato: true });
        const date = r.corpo.progetti.map((p) => p.modificato);
        expect([...date].sort((x, y) => y - x)).toEqual(date);
        fs.unlinkSync(file('rotto.json'));
    });

    test('GET di un progetto: contenuto, impronta e numero di versioni', async () => {
        const r = await api<{ progetto: unknown; impronta: string; versioni: number }>(a.pagina, 'GET', '/api/progetti/alfa');
        expect(r.stato).toBe(200);
        expect(r.corpo.progetto).toEqual(progettoVuoto('Alfa'));
        expect(r.corpo.versioni).toBe(0);
        const assente = await api(a.pagina, 'GET', '/api/progetti/non_esiste');
        expect(assente.stato).toBe(404);
        expect(assente.corpo.errore).toBe('non_trovato');
    });

    test('PUT con impronta giusta scrive e ruota le versioni fino al massimo', async () => {
        let impronta = (await api<Esito>(a.pagina, 'GET', '/api/progetti/alfa')).corpo.impronta;
        for (let i = 1; i <= 4; i++) {
            const p = progettoVuoto('Alfa');
            (p.workspace as { nodes: unknown[] }).nodes.push(...Array.from({ length: i }, (_, k) => ({ id: `n${k + 1}` })));
            const r = await api<Esito>(a.pagina, 'PUT', '/api/progetti/alfa', { progetto: p, improntaAttesa: impronta, forza: false });
            expect(r.stato).toBe(200);
            impronta = r.corpo.impronta;
            expect(r.corpo.versioni).toBe(Math.min(i, 3));
        }
        // Massimo 3 versioni (progetti.versioni), la .1 è lo stato prima dell'ultima scrittura
        expect(fs.readdirSync(file('_versioni')).filter((n) => n.startsWith('alfa.')).sort()).toEqual(['alfa.1.json', 'alfa.2.json', 'alfa.3.json']);
        expect(leggiJson<{ workspace: { nodes: unknown[] } }>(file('_versioni', 'alfa.1.json')).workspace.nodes).toHaveLength(3);
    });

    test('PUT senza cambiamenti non crea una versione', async () => {
        const letto = (await api<{ progetto: unknown; impronta: string; versioni: number }>(a.pagina, 'GET', '/api/progetti/alfa')).corpo;
        const r = await api<Esito>(a.pagina, 'PUT', '/api/progetti/alfa', { progetto: letto.progetto, improntaAttesa: letto.impronta, forza: false });
        expect(r.stato).toBe(200);
        expect(r.corpo.impronta).toBe(letto.impronta);
        expect(r.corpo.versioni).toBe(letto.versioni);
    });

    test('PUT con impronta vecchia: 409 conflitto con l\'impronta attuale; forza sovrascrive', async () => {
        const attuale = (await api<Esito>(a.pagina, 'GET', '/api/progetti/alfa')).corpo.impronta;
        const r = await api(a.pagina, 'PUT', '/api/progetti/alfa', { progetto: progettoVuoto('Alfa'), improntaAttesa: 'vecchia', forza: false });
        expect(r.stato).toBe(409);
        expect(r.corpo).toMatchObject({ errore: 'conflitto', impronta: attuale });
        const forzato = await api<Esito>(a.pagina, 'PUT', '/api/progetti/alfa', { progetto: progettoVuoto('Alfa'), improntaAttesa: 'vecchia', forza: true });
        expect(forzato.stato).toBe(200);
        expect(leggiJson<{ workspace: { nodes: unknown[] } }>(file('alfa.json')).workspace.nodes).toHaveLength(0);
        expect(leggiJson<{ workspace: { nodes: unknown[] } }>(file('_versioni', 'alfa.1.json')).workspace.nodes).toHaveLength(4);
    });

    test('PUT con un progetto senza la forma attesa: 400 progetto_non_valido', async () => {
        const impronta = (await api<Esito>(a.pagina, 'GET', '/api/progetti/alfa')).corpo.impronta;
        for (const progetto of [{ nome: 'x' }, { ...progettoVuoto('x'), formatVersion: 3 }, { ...progettoVuoto(' ') }, { ...progettoVuoto('x'), cliente: [] }]) {
            const r = await api(a.pagina, 'PUT', '/api/progetti/alfa', { progetto, improntaAttesa: impronta, forza: false });
            expect(r.stato).toBe(400);
            expect(r.corpo.errore).toBe('progetto_non_valido');
        }
    });

    test('annulla ripristina la versione .1 (solo workspace e cliente) e scala le altre', async () => {
        const prima = (await api<Esito & { progetto: unknown }>(a.pagina, 'GET', '/api/progetti/alfa')).corpo;
        const r = await api<Esito & { progetto: { nome: string; workspace: { nodes: unknown[] } } }>(a.pagina, 'POST', '/api/progetti/alfa/annulla', { improntaAttesa: prima.impronta });
        expect(r.stato).toBe(200);
        expect(r.corpo.progetto.workspace.nodes).toHaveLength(4);
        expect(r.corpo.progetto.nome).toBe('Alfa');
        expect(r.corpo.versioni).toBe(prima.versioni - 1);
        const conflitto = await api(a.pagina, 'POST', '/api/progetti/alfa/annulla', { improntaAttesa: 'vecchia' });
        expect(conflitto.stato).toBe(409);
    });

    test('annulla senza versioni: 409 nessuna_versione', async () => {
        const c = await api<Esito>(a.pagina, 'POST', '/api/progetti', { slug: 'senza_versioni', progetto: progettoVuoto('Senza') });
        const r = await api(a.pagina, 'POST', '/api/progetti/senza_versioni/annulla', { improntaAttesa: c.corpo.impronta });
        expect(r.stato).toBe(409);
        expect(r.corpo.errore).toBe('nessuna_versione');
    });

    test('rinomina sposta file e versioni e aggiorna _ultimo.json', async () => {
        await api(a.pagina, 'PUT', '/api/ultimo', { progetto: 'alfa' });
        const prima = (await api<Esito>(a.pagina, 'GET', '/api/progetti/alfa')).corpo;
        const r = await api<Esito>(a.pagina, 'POST', '/api/progetti/alfa/rinomina', { nuovoSlug: 'beta', nome: 'Beta', improntaAttesa: prima.impronta });
        expect(r.stato).toBe(200);
        expect(r.corpo).toMatchObject({ slug: 'beta', versioni: prima.versioni });
        expect(fs.existsSync(file('alfa.json'))).toBe(false);
        expect(leggiJson<{ nome: string }>(file('beta.json')).nome).toBe('Beta');
        expect(fs.readdirSync(file('_versioni')).some((n) => n.startsWith('alfa.'))).toBe(false);
        expect((await api(a.pagina, 'GET', '/api/ultimo')).corpo).toEqual({ progetto: 'beta' });
        const esiste = await api(a.pagina, 'POST', '/api/progetti/beta/rinomina', { nuovoSlug: 'senza_versioni', nome: 'X', improntaAttesa: r.corpo.impronta });
        expect(esiste.stato).toBe(409);
        expect(esiste.corpo.errore).toBe('esiste');
        const vuoto = await api(a.pagina, 'POST', '/api/progetti/beta/rinomina', { nuovoSlug: 'gamma', nome: '  ', improntaAttesa: r.corpo.impronta });
        expect(vuoto.stato).toBe(400);
    });

    test('DELETE sposta nel cestino, toglie le versioni e azzera _ultimo.json', async () => {
        const r = await api(a.pagina, 'DELETE', '/api/progetti/beta');
        expect(r.stato).toBe(204);
        expect(fs.existsSync(file('beta.json'))).toBe(false);
        expect(fs.readdirSync(file('_cestino')).some((n) => /^beta_\d{8}_\d{6}(_\d+)?\.json$/.test(n))).toBe(true);
        expect(fs.readdirSync(file('_versioni')).some((n) => n.startsWith('beta.'))).toBe(false);
        expect((await api(a.pagina, 'GET', '/api/ultimo')).corpo).toEqual({ progetto: null });
        expect((await api(a.pagina, 'DELETE', '/api/progetti/beta')).stato).toBe(404);
    });

    test('ultimo: PUT con slug non valido 400, GET con file rotto null', async () => {
        expect((await api(a.pagina, 'PUT', '/api/ultimo', { progetto: '../x' })).stato).toBe(400);
        expect((await api(a.pagina, 'PUT', '/api/ultimo', { progetto: 'senza_versioni' })).stato).toBe(204);
        expect(leggiJson(file('_ultimo.json'))).toEqual({ progetto: 'senza_versioni' });
        fs.writeFileSync(file('_ultimo.json'), 'rotto', 'utf-8');
        expect((await api(a.pagina, 'GET', '/api/ultimo')).corpo).toEqual({ progetto: null });
    });

    test('slug non validi, metodi e tipi sbagliati, rotte sconosciute', async () => {
        for (const slug of ['..%2Fsettings', 'con', 'Maiuscole', 'a__b', '_a', 'a'.repeat(81)]) {
            const r = await api(a.pagina, 'GET', `/api/progetti/${slug}`);
            expect(r.stato, slug).toBe(400);
            expect(r.corpo.errore).toBe('slug_non_valido');
        }
        expect((await api(a.pagina, 'POST', '/api/progetti', '{}', 'text/plain')).stato).toBe(415);
        expect((await api(a.pagina, 'POST', '/api/progetti/senza_versioni', {})).stato).toBe(405);
        expect((await api(a.pagina, 'GET', '/api/progetti/senza_versioni/annulla')).stato).toBe(405);
        expect((await api(a.pagina, 'GET', '/api/sconosciuta')).stato).toBe(404);
        expect((await api(a.pagina, 'POST', '/api/progetti', 'non json')).corpo.errore).toBe('json_non_valido');
        expect((await api(a.pagina, 'POST', '/api/progetti', '[1]')).stato).toBe(400);
    });

    test('un progetto con JSON rotto: 422 json_non_valido in lettura', async () => {
        fs.writeFileSync(file('guasto.json'), '{', 'utf-8');
        const r = await api(a.pagina, 'GET', '/api/progetti/guasto');
        expect(r.stato).toBe(422);
        expect(r.corpo.errore).toBe('json_non_valido');
    });
});
