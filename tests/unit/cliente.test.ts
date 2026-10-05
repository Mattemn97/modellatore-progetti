/* --- TEST: LETTURA DEI FILE DEL CLIENTE UGUALE A start.py (oracoli in dati/) --- */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { leggiFileCliente } from '../../src/main/api/cliente';
import { ErroreApi } from '../../src/main/api/errori';
import { analizzaXml } from '../../src/main/api/xml';

interface Caso {
    contenuto: string;
    atteso: { esito?: unknown; errore?: string };
}

const DATI = path.join(__dirname, 'dati');

function leggi(contenuto: string, nomeFile = 'clienti.csv'): { esito?: unknown; errore?: string } {
    try {
        return { esito: leggiFileCliente({ nomeFile, contenuto }, 20) };
    } catch (e) {
        if (e instanceof ErroreApi) return { errore: e.codice };
        throw e;
    }
}

describe('CSV come il modulo csv e csv.Sniffer di Python', () => {
    const casi = JSON.parse(fs.readFileSync(path.join(DATI, 'csv.json'), 'utf-8')) as Caso[];
    it(`${casi.length} file generati da Python danno le stesse righe`, () => {
        for (const [i, caso] of casi.entries()) {
            expect(leggi(caso.contenuto), `caso ${i}: ${Buffer.from(caso.contenuto, 'base64').toString('utf-8').slice(0, 80)}`).toEqual(caso.atteso);
        }
    });
});

describe('xlsx', () => {
    it('il file di riferimento dà fogli, testi e numeri come Python', () => {
        const contenuto = fs.readFileSync(path.join(__dirname, '..', 'e2e', 'dati', 'clienti.xlsx')).toString('base64');
        expect(leggi(contenuto, 'clienti.xlsx')).toEqual({
            esito: {
                formato: 'xlsx',
                fogli: [
                    { nome: 'Requisiti', nascosto: false, righe: [['ID', 'Testo', 'Peso'], ['R-1', 'Il sistema pesa poco', '12'], [], ['R-2', 'Città è "bella"', '2.5', '', '1']] },
                    { nome: 'Note', nascosto: true, righe: [['', 'nota nascosta']] }
                ]
            }
        });
    });
});

describe('XML minimo', () => {
    it('testo, coda, entità, CDATA e prefissi', () => {
        const radice = analizzaXml('<?xml version="1.0"?><a x:b="1 &amp; 2"><t>uno &lt;due&gt; &#233;</t>coda<![CDATA[<c>]]><v/></a>');
        expect(radice.attributi['x:b']).toBe('1 & 2');
        expect(radice.figli[0]?.testo).toBe('uno <due> é');
        expect(radice.figli[0]?.coda).toBe('coda<c>');
        expect(radice.figli[1]?.tag).toBe('v');
    });

    it('rifiuta dichiarazioni, entità sconosciute e tag sbagliati', () => {
        for (const testo of ['<!DOCTYPE a><a/>', '<a>&ent;</a>', '<a><b></a>', '<a>', '<a/><b/>']) {
            expect(() => analizzaXml(testo), testo).toThrow();
        }
    });
});
