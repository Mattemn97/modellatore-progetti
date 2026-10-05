/* --- E2E CONTRATTO: LETTURA DEI FILE DEL CLIENTE (spec 0003, 0017 AC-3) --- */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { api } from '../api';
import { apriApp, pronta, type AppDiProva } from '../app';

const b64 = (testo: string | Buffer) => Buffer.from(testo).toString('base64');

test.describe.serial('contratto /api/cliente/leggi', () => {
    let a: AppDiProva;
    const leggi = (corpo: unknown) => api<{ formato: string; fogli: Array<{ nome: string; nascosto: boolean; righe: string[][] }>; errore?: string }>(a.pagina, 'POST', '/api/cliente/leggi', corpo);

    // cliente.maxFileMB si legge all'avvio: 0.01 MB per provare il limite senza file enormi
    test.beforeAll(async () => {
        a = await apriApp({ impostazioni: { cliente: { maxFileMB: 0.01 } } });
        await pronta(a.pagina);
    });
    test.afterAll(async () => { await a.chiudi(); });

    test('CSV con punto e virgola, BOM UTF-8 e righe vuote finali', async () => {
        const r = await leggi({ nomeFile: 'C:\\cartella\\clienti.csv', contenuto: b64('\ufeffID;Testo\nR1;"Primo; con separatore"\nR2;Città\n;\n\n') });
        expect(r.stato).toBe(200);
        expect(r.corpo).toEqual({ formato: 'csv', fogli: [{ nome: 'clienti', nascosto: false, righe: [['ID', 'Testo'], ['R1', 'Primo; con separatore'], ['R2', 'Città']] }] });
    });

    test('CSV con virgole e in Windows-1252', async () => {
        const virgole = await leggi({ nomeFile: 'a.csv', contenuto: b64('ID,Testo\nR1,Uno\n') });
        expect(virgole.corpo.fogli[0]?.righe).toEqual([['ID', 'Testo'], ['R1', 'Uno']]);
        const cp1252 = await leggi({ nomeFile: 'b.csv', contenuto: Buffer.from([0x49, 0x44, 0x3b, 0x54, 0x0a, 0x52, 0x31, 0x3b, 0xe8]).toString('base64') });
        expect(cp1252.corpo.fogli[0]?.righe).toEqual([['ID', 'T'], ['R1', 'è']]);
    });

    test('xlsx: fogli in ordine, foglio nascosto, testi condivisi e ricchi, numeri, booleani, righe vuote', async () => {
        const dati = fs.readFileSync(path.join(__dirname, '..', 'dati', 'clienti.xlsx'));
        const r = await leggi({ nomeFile: 'clienti.xlsx', contenuto: dati.toString('base64') });
        expect(r.stato).toBe(200);
        expect(r.corpo).toEqual({
            formato: 'xlsx',
            fogli: [
                { nome: 'Requisiti', nascosto: false, righe: [['ID', 'Testo', 'Peso'], ['R-1', 'Il sistema pesa poco', '12'], [], ['R-2', 'Città è "bella"', '2.5', '', '1']] },
                { nome: 'Note', nascosto: true, righe: [['', 'nota nascosta']] }
            ]
        });
    });

    test('errori: estensione, vuoto, base64, troppo grande, .xls vecchio, zip rotto, campi mancanti, metodo', async () => {
        expect((await leggi({ nomeFile: 'a.txt', contenuto: b64('x') })).corpo.errore).toBe('formato_non_supportato');
        expect((await leggi({ nomeFile: 'a.csv', contenuto: b64(' \n ') })).corpo.errore).toBe('file_vuoto');
        expect((await leggi({ nomeFile: 'a.csv', contenuto: b64(';;\n;') })).corpo.errore).toBe('file_vuoto');
        expect((await leggi({ nomeFile: 'a.csv', contenuto: '***' })).corpo.errore).toBe('richiesta_non_valida');
        const grande = await leggi({ nomeFile: 'a.csv', contenuto: b64('x'.repeat(20_000)) });
        expect(grande.stato).toBe(413);
        expect(grande.corpo.errore).toBe('troppo_grande');
        const ole = await leggi({ nomeFile: 'a.xlsx', contenuto: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]).toString('base64') });
        expect(ole.stato).toBe(415);
        const rotto = await leggi({ nomeFile: 'a.xlsx', contenuto: b64('non è uno zip') });
        expect(rotto.stato).toBe(422);
        expect(rotto.corpo.errore).toBe('file_illeggibile');
        expect((await leggi({ contenuto: b64('x') })).stato).toBe(400);
        expect((await api(a.pagina, 'GET', '/api/cliente/leggi')).stato).toBe(405);
    });
});
