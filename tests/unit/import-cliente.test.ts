// @vitest-environment happy-dom
/* --- TEST: FILTRO DELLE RIGHE NELL'IMPORT CLIENTE (spec 0030) --- */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// I moduli dell'interfaccia cercano i loro elementi all'import: prima la pagina vera, poi l'import
let cliente: typeof import('../../src/renderer/cliente');

beforeAll(async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'), 'utf-8');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
    globalThis.fetch = (async () => new Response('{}')) as typeof fetch;
    cliente = await import('../../src/renderer/cliente');
});

const foglio = {
    nome: 'Requisiti',
    nascosto: false,
    righe: [
        ['ID', 'Tipo', 'Testo'],
        ['1', 'Titolo', 'Capitolo 1'],
        ['R1', 'Requirement', 'Il sistema pesa meno di 10 kg'],
        ['', '', ''],
        ['N1', 'Nota', 'Una nota'],
        ['R2', ' REQ. ', 'Il sistema funziona a 24V'],
        ['R3', '', 'Senza tipo']
    ]
};
const colonne = { id: 0, testo: 2 };

describe('passaFiltro', () => {
    it('contiene, senza maiuscole e spazi ai lati', () => {
        expect(cliente.passaFiltro('  Requirement ', 'requirement')).toBe(true);
        expect(cliente.passaFiltro('System Requirement', 'Requirement')).toBe(true);
        expect(cliente.passaFiltro('Nota', 'Requirement')).toBe(false);
    });

    it('valori separati da ; valgono in alternativa, un testo vuoto lascia passare tutto', () => {
        expect(cliente.passaFiltro('REQ.', 'Requirement; Req')).toBe(true);
        expect(cliente.passaFiltro('Titolo', 'Requirement; Req')).toBe(false);
        expect(cliente.passaFiltro('qualsiasi', '')).toBe(true);
        expect(cliente.passaFiltro('qualsiasi', ' ; ')).toBe(true);
    });
});

describe('estraiRighe con il filtro', () => {
    it('senza filtro tutte le righe non vuote, nessuna esclusa', () => {
        const { righe, escluse } = cliente.estraiRighe(foglio, 1, colonne);
        expect(righe.map((r) => r.idCliente)).toEqual(['1', 'R1', 'N1', 'R2', 'R3']);
        expect(escluse).toEqual([]);
    });

    it('una colonna senza testo non filtra', () => {
        const { righe } = cliente.estraiRighe(foglio, 1, colonne, { colonna: 1, testo: '  ' });
        expect(righe).toHaveLength(5);
        expect(cliente.filtroAttivo({ colonna: 1, testo: '' })).toBe(false);
        expect(cliente.filtroAttivo({ colonna: null, testo: 'Req' })).toBe(false);
    });

    it('passano solo le righe con il testo nella colonna; le altre sono escluse con riga, ID e valore', () => {
        const { righe, escluse } = cliente.estraiRighe(foglio, 1, colonne, { colonna: 1, testo: 'Requirement; Req' });
        expect(righe.map((r) => r.idCliente)).toEqual(['R1', 'R2']);
        // La riga vuota non conta
        expect(escluse).toEqual([
            { riga: 2, idCliente: '1', valore: 'Titolo' },
            { riga: 5, idCliente: 'N1', valore: 'Nota' },
            { riga: 7, idCliente: 'R3', valore: '' }
        ]);
    });
});
