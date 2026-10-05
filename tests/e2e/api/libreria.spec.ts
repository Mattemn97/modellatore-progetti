/* --- E2E CONTRATTO: API DELLA LIBRERIA (spec 0002, 0010, 0017 AC-2) --- */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { api } from '../api';
import { apriApp, leggiJson, pronta, type AppDiProva } from '../app';
import { LIBRERIA_PROVA } from '../dati/libreria';

const PERCORSO = 'shared/libreria.json';

interface Voce {
    versione: string; data: string; autore: string; origine: string; livello: string | null; livelloCalcolato: string | null;
    nota: string; impronta: string; improntaContenuto: string; modifiche: Array<Record<string, unknown>>;
}
interface Apertura {
    libreria: { formatVersion?: number; versione?: string; library: Record<string, Blocco> };
    impronta: string; scrivibile: boolean; formato: number; vociAggiunte: Voce[]; versione: string | null; avviso?: string;
}
interface Blocco { id: string; titolo: string; requisiti: Array<Record<string, unknown>>; [k: string]: unknown }
interface Salvataggio { libreria: Apertura['libreria']; impronta: string; versione: string; voce: Voce | null; invariata?: boolean; vociAggiunte: Voce[]; formato?: number; errore?: string }

const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

test.describe.serial('contratto /api/libreria', () => {
    let a: AppDiProva;
    let impronta = '';
    const file = (...parti: string[]) => path.join(a.cartella, ...parti);

    async function apri(percorso = PERCORSO) {
        return api<Apertura>(a.pagina, 'POST', '/api/libreria/apri', { percorso });
    }
    async function salva(blocco: Blocco, extra: Record<string, unknown> = {}) {
        const r = await api<Salvataggio>(a.pagina, 'POST', '/api/libreria/salva', {
            percorso: PERCORSO, blocco, nuovo: false, rinomine: {}, livello: 'auto', nota: '', improntaAttesa: impronta, ...extra
        });
        if (r.stato === 200) impronta = r.corpo.impronta;
        return r;
    }
    async function blocco(id: string): Promise<Blocco> {
        const b = (await apri()).corpo.libreria.library[id];
        if (!b) throw new Error(`blocco ${id} assente`);
        return copia(b);
    }

    test.beforeAll(async () => {
        a = await apriApp({ libreria: LIBRERIA_PROVA });
        await pronta(a.pagina);
    });
    test.afterAll(async () => { await a.chiudi(); });

    test('apri: libreria scrivibile, versione e voce iniziale nel changelog', async () => {
        const r = await apri();
        expect(r.stato).toBe(200);
        expect(r.corpo).toMatchObject({ scrivibile: true, formato: 1, versione: '1.0.0', vociAggiunte: [] });
        expect(r.corpo.libreria.library).toEqual(LIBRERIA_PROVA);
        impronta = r.corpo.impronta;
        // La voce iniziale l'ha scritta l'app all'avvio
        const changelog = leggiJson<{ formatVersion: number; voci: Voce[] }>(file('shared', 'libreria.changelog.json'));
        expect(changelog.formatVersion).toBe(1);
        expect(changelog.voci).toHaveLength(1);
        expect(changelog.voci[0]).toMatchObject({ versione: '1.0.0', origine: 'iniziale', livello: null, livelloCalcolato: null, nota: '', modifiche: [] });
        expect(changelog.voci[0]?.data).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
        expect(fs.existsSync(file('shared', '_versioni', 'libreria.riferimento.json'))).toBe(true);
    });

    test('apri: percorsi non validi 400, file assente 404, metodo GET 405', async () => {
        for (const p of ['../x.json', 'progetti/x.json', 'C:/x.json', '/shared/libreria.json', 'shared\\libreria.json', 'shared/libreria.changelog.json', 'shared/x.txt', 'shared/./libreria.json']) {
            const r = await apri(p);
            expect(r.stato, p).toBe(400);
            expect(r.corpo).toMatchObject({ errore: 'percorso_non_valido' });
        }
        expect((await apri('shared/assente.json')).stato).toBe(404);
        expect((await api(a.pagina, 'GET', '/api/libreria/apri')).stato).toBe(405);
    });

    test('apri: una libreria fuori da shared/ è in sola lettura e non scrive il changelog', async () => {
        fs.mkdirSync(file('altre'), { recursive: true });
        fs.writeFileSync(file('altre', 'lib.json'), JSON.stringify({ formatVersion: 1, versione: '4.5.6', library: {} }), 'utf-8');
        const r = await apri('altre/lib.json');
        expect(r.stato).toBe(200);
        expect(r.corpo).toMatchObject({ scrivibile: false, versione: '4.5.6' });
        expect(fs.existsSync(file('altre', 'lib.changelog.json'))).toBe(false);
        const s = await api(a.pagina, 'POST', '/api/libreria/salva', { percorso: 'altre/lib.json', blocco: LIBRERIA_PROVA.sensore, nuovo: true, livello: 'auto' });
        expect(s.stato).toBe(403);
        expect(s.corpo.errore).toBe('percorso_non_scrivibile');
    });

    test('salva: cambio di titolo → patch, copia in _versioni/ e voce di changelog', async () => {
        const b = await blocco('centralina');
        b.titolo = 'Centralina principale';
        const r = await salva(b);
        expect(r.stato).toBe(200);
        expect(r.corpo.versione).toBe('1.0.1');
        expect(r.corpo.voce).toMatchObject({
            versione: '1.0.1', origine: 'app', livello: 'patch', livelloCalcolato: 'patch',
            modifiche: [{ blocco: 'centralina', titolo: 'Centralina principale', tipo: 'modificato', campiBlocco: ['titolo'], requisiti: [] }]
        });
        const suDisco = leggiJson<Apertura['libreria']>(file('shared', 'libreria.json'));
        expect(suDisco).toMatchObject({ formatVersion: 1, versione: '1.0.1' });
        expect(suDisco.library.centralina?.titolo).toBe('Centralina principale');
        expect(leggiJson<Apertura['libreria']>(file('shared', '_versioni', 'libreria.1.json')).versione).toBe('1.0.0');
        expect(r.corpo.voce?.impronta).toMatch(/^[0-9a-f]{40}$/);
    });

    test('salva: requisito aggiunto → minor; livello scelto più alto vince; nota senza spazi ai lati', async () => {
        const b = await blocco('centralina');
        b.requisiti.push({ id: 'cen_003', titolo: 'Nuovo', tipologia: null, metodoVerifica: 'Test', testiExport: [] });
        const r = await salva(b, { livello: 'major', nota: '  Richiesta cliente 12  ' });
        expect(r.corpo.versione).toBe('2.0.0');
        expect(r.corpo.voce).toMatchObject({ livello: 'major', livelloCalcolato: 'minor', nota: 'Richiesta cliente 12' });
        expect(r.corpo.voce?.modifiche[0]?.requisiti).toEqual([{ id: 'cen_003', tipo: 'aggiunto', campi: [] }]);
    });

    test('salva: requisito rinominato con rinomine → major con idPrecedente', async () => {
        const b = await blocco('centralina');
        const req = b.requisiti.find((r) => r.id === 'cen_003');
        if (!req) throw new Error('cen_003 assente');
        req.id = 'cen_009';
        req.titolo = 'Rinominato';
        const r = await salva(b, { rinomine: { cen_003: 'cen_009' } });
        expect(r.corpo.versione).toBe('3.0.0');
        expect(r.corpo.voce?.modifiche[0]?.requisiti).toEqual([{ id: 'cen_009', tipo: 'rinominato', idPrecedente: 'cen_003', campi: ['titolo'] }]);
    });

    test('salva: nessuna modifica → invariata, nessun file toccato', async () => {
        const prima = fs.readFileSync(file('shared', 'libreria.json'));
        const copie = fs.readdirSync(file('shared', '_versioni')).length;
        const r = await salva(await blocco('centralina'));
        expect(r.stato).toBe(200);
        expect(r.corpo).toMatchObject({ invariata: true, versione: '3.0.0' });
        expect(fs.readFileSync(file('shared', 'libreria.json')).equals(prima)).toBe(true);
        expect(fs.readdirSync(file('shared', '_versioni')).length).toBe(copie);
    });

    test('salva: id duplicato, blocco nuovo esistente, rinomine sbagliate, livello e blocco non validi', async () => {
        const b = await blocco('sensore');
        b.requisiti.push({ id: 'ali_001', titolo: 'x' });
        expect((await salva(b)).corpo.errore).toBe('id_duplicato');
        expect((await salva(await blocco('sensore'), { nuovo: true })).corpo.errore).toBe('esiste');
        expect((await salva(await blocco('sensore'), { rinomine: { inventato: 'sen_001' } })).corpo.errore).toBe('rinomine_non_valide');
        expect((await salva(await blocco('sensore'), { livello: 'enorme' })).corpo.errore).toBe('livello_non_valido');
        expect((await salva({ id: 'x', titolo: '', requisiti: [] })).corpo.errore).toBe('blocco_non_valido');
        const doppio = await blocco('sensore');
        doppio.requisiti.push({ id: 'sen_001' });
        expect((await salva(doppio)).corpo.errore).toBe('blocco_non_valido');
        expect((await salva(await blocco('sensore'), { nota: 'x'.repeat(2001) })).stato).toBe(400);
    });

    test('salva: impronta vecchia → 409 conflitto; forza registra prima la modifica esterna', async () => {
        // Il blocco si legge prima della modifica a mano: aprire la libreria registrerebbe subito la voce esterna
        const b = await blocco('alimentatore');
        b.titolo = 'Alimentatore 2';
        const suDisco = leggiJson<Apertura['libreria']>(file('shared', 'libreria.json'));
        (suDisco.library.sensore as Blocco).descrizione = 'Cambiata a mano';
        fs.writeFileSync(file('shared', 'libreria.json'), JSON.stringify(suDisco, null, 2), 'utf-8');
        const conflitto = await salva(b, { improntaAttesa: 'vecchia' });
        expect(conflitto.stato).toBe(409);
        expect(conflitto.corpo).toMatchObject({ errore: 'conflitto', impronta: expect.any(String) });
        const r = await salva(b, { improntaAttesa: 'vecchia', forza: true });
        expect(r.stato).toBe(200);
        expect(r.corpo.vociAggiunte).toHaveLength(1);
        expect(r.corpo.vociAggiunte[0]).toMatchObject({
            origine: 'esterna', versione: '3.0.1', livello: 'patch', nota: "Modifica fatta fuori dall'app",
            modifiche: [{ blocco: 'sensore', tipo: 'modificato', campiBlocco: ['descrizione'], requisiti: [] }]
        });
        expect(r.corpo.versione).toBe('3.0.2');
        expect(r.corpo.libreria.library.sensore?.descrizione).toBe('Cambiata a mano');
    });

    test('apri dopo una modifica esterna: voce esterna major se un requisito sparisce', async () => {
        const suDisco = leggiJson<Apertura['libreria']>(file('shared', 'libreria.json'));
        (suDisco.library.sensore as Blocco).requisiti = [];
        fs.writeFileSync(file('shared', 'libreria.json'), JSON.stringify(suDisco), 'utf-8');
        const r = await apri();
        expect(r.corpo.vociAggiunte[0]).toMatchObject({ origine: 'esterna', livello: 'major', versione: '4.0.0' });
        expect(r.corpo.vociAggiunte[0]?.modifiche[0]?.requisiti).toEqual([{ id: 'sen_001', tipo: 'rimosso', campi: [] }]);
        // Riaprire senza altri cambiamenti non aggiunge voci
        expect((await apri()).corpo.vociAggiunte).toEqual([]);
        impronta = r.corpo.impronta;
    });

    test('copie di sicurezza: al massimo libreria.versioni copie più il riferimento', async () => {
        for (const titolo of ['A', 'B', 'C', 'D']) {
            const b = await blocco('sensore');
            b.titolo = titolo;
            expect((await salva(b)).stato).toBe(200);
        }
        expect(fs.readdirSync(file('shared', '_versioni')).sort()).toEqual(['libreria.1.json', 'libreria.2.json', 'libreria.3.json', 'libreria.riferimento.json']);
    });

    test('rinomina di un blocco: stesso posto, voce rinominato major; errori', async () => {
        const r = await api<Salvataggio>(a.pagina, 'POST', '/api/libreria/rinomina', { percorso: PERCORSO, idBlocco: 'sensore', nuovoId: 'termometro', livello: 'auto', nota: '', improntaAttesa: impronta });
        expect(r.stato).toBe(200);
        impronta = r.corpo.impronta;
        expect(Object.keys(r.corpo.libreria.library)).toEqual(['alimentatore', 'centralina', 'termometro']);
        expect(r.corpo.libreria.library.termometro?.id).toBe('termometro');
        expect(r.corpo.voce).toMatchObject({ livello: 'major', modifiche: [{ blocco: 'termometro', idPrecedente: 'sensore', tipo: 'rinominato', campiBlocco: ['id'], requisiti: [] }] });
        const base = { percorso: PERCORSO, livello: 'auto', improntaAttesa: impronta };
        expect((await api(a.pagina, 'POST', '/api/libreria/rinomina', { ...base, idBlocco: 'termometro', nuovoId: 'Centralina' })).corpo.errore).toBe('esiste');
        expect((await api(a.pagina, 'POST', '/api/libreria/rinomina', { ...base, idBlocco: 'termometro', nuovoId: 'termometro' })).corpo.errore).toBe('id_uguale');
        expect((await api(a.pagina, 'POST', '/api/libreria/rinomina', { ...base, idBlocco: 'termometro', nuovoId: 'con spazi' })).corpo.errore).toBe('id_non_valido');
        expect((await api(a.pagina, 'POST', '/api/libreria/rinomina', { ...base, idBlocco: 'assente', nuovoId: 'x' })).stato).toBe(404);
    });

    test('elimina un blocco: voce eliminato major con i requisiti rimossi', async () => {
        const r = await api<Salvataggio>(a.pagina, 'POST', '/api/libreria/elimina', { percorso: PERCORSO, idBlocco: 'alimentatore', livello: 'auto', nota: '', improntaAttesa: impronta });
        expect(r.stato).toBe(200);
        impronta = r.corpo.impronta;
        expect(r.corpo.libreria.library.alimentatore).toBeUndefined();
        expect(r.corpo.voce).toMatchObject({
            livello: 'major',
            modifiche: [{ blocco: 'alimentatore', tipo: 'eliminato', campiBlocco: [], requisiti: [{ id: 'ali_001', tipo: 'rimosso', campi: [] }, { id: 'ali_002', tipo: 'rimosso', campi: [] }] }]
        });
    });

    test('changelog: versione e voci in ordine; changelog rotto → apertura in sola lettura con avviso', async () => {
        const r = await api<{ versione: string; voci: Voce[] }>(a.pagina, 'GET', `/api/libreria/changelog?percorso=${encodeURIComponent(PERCORSO)}`);
        expect(r.stato).toBe(200);
        expect(r.corpo.voci[0]?.origine).toBe('iniziale');
        expect(r.corpo.versione).toBe(r.corpo.voci.at(-1)?.versione);
        expect((await api(a.pagina, 'POST', `/api/libreria/changelog?percorso=${PERCORSO}`, {})).stato).toBe(405);
        fs.writeFileSync(file('shared', 'libreria.changelog.json'), '{ rotto', 'utf-8');
        const aperta = await apri();
        expect(aperta.corpo).toMatchObject({ scrivibile: false });
        expect(aperta.corpo.avviso).toContain('Il changelog non è leggibile');
        expect((await api(a.pagina, 'GET', `/api/libreria/changelog?percorso=${PERCORSO}`)).stato).toBe(422);
    });

    test('libreria in formato vecchio: salva con base la converte al formato 1', async () => {
        fs.writeFileSync(file('shared', 'vecchia.json'), JSON.stringify({ blocco_v: { id: 'blocco_v', titolo: 'Vecchio', requisiti: [] } }), 'utf-8');
        const aperta = await apri('shared/vecchia.json');
        expect(aperta.corpo).toMatchObject({ formato: 0, scrivibile: true, versione: '1.0.0' });
        const base = { blocco_v: { id: 'blocco_v', titolo: 'Vecchio', requisiti: [] } };
        const r = await api<Salvataggio>(a.pagina, 'POST', '/api/libreria/salva', {
            percorso: 'shared/vecchia.json', blocco: { id: 'blocco_v', titolo: 'Vecchio', requisiti: [] }, nuovo: false, livello: 'auto', improntaAttesa: aperta.corpo.impronta, base
        });
        expect(r.corpo).toMatchObject({ invariata: true, formato: 1 });
        expect(leggiJson(file('shared', 'vecchia.json'))).toEqual({ formatVersion: 1, versione: '1.0.0', library: base });
        const senzaBase = await api(a.pagina, 'POST', '/api/libreria/elimina', { percorso: 'shared/vecchia.json', idBlocco: 'blocco_v', livello: 'auto', improntaAttesa: r.corpo.impronta });
        expect(senzaBase.stato).toBe(200);
    });
});
