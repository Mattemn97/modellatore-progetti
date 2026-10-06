/* --- TEST: LETTURA DEL MARKDOWN, WORD E PAGINA DEL PDF CON IL MODELLO AZIENDALE (spec 0028) --- */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArchivioZip } from '../../src/main/api/zip';
import { scriviDocx } from '../../src/main/documenti/docx';
import { htmlDocumento } from '../../src/main/documenti/html';
import { corpoDocumento, leggiMarkdown, leggiRiga } from '../../src/main/documenti/markdown';
import { controllaRichiesta, leggiLogo, type RichiestaExport } from '../../src/main/documenti/modello';

const MD = [
    '# SSS · Specifica del sistema/sottosistema · Prova',
    'Data: 2026-10-06 · Libreria: libreria.json v1.0.0',
    '## 1. Scopo',
    '### 1.1 Identificazione',
    'Riga uno\nriga due con **grassetto** e sys_cap e _Da completare._',
    '| ID | Titolo |\n| --- | --- |\n| a\\|b | c\\\\d |',
    '- Metodo di verifica: Test\n- Blocco: Sistema',
    '![Diagramma: Prova](diagramma:radice)'
].join('\n\n');

function richiesta(extra: Partial<RichiestaExport> = {}): RichiestaExport {
    return {
        formato: 'docx',
        markdown: MD,
        intestazione: { documento: 'SSS', titolo: 'Specifica del sistema/sottosistema', progetto: 'Prova <&>', data: '2026-10-06', libreria: 'libreria.json v1.0.0' },
        modello: { azienda: 'ACME S.p.A.', logo: '', classificazione: 'Riservato', piePagina: 'Uso interno', autore: 'M. Rossi' },
        revisioni: [{ revisione: 'A', data: '2026-10-01', descrizione: 'Prima emissione', autore: 'M. Rossi' }, { revisione: 'B', data: '2026-10-06', descrizione: 'Aggiornamento', autore: 'M. Rossi' }],
        immagini: {},
        ...extra
    };
}

// PNG 1x1 valido
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('lettura del Markdown', () => {
    it('titoli, paragrafi con a capo, tabelle con escape, elenchi, immagini; il titolo iniziale va al frontespizio', () => {
        const blocchi = corpoDocumento(leggiMarkdown(MD));
        expect(blocchi.map((b) => b.tipo)).toEqual(['titolo', 'titolo', 'paragrafo', 'tabella', 'elenco', 'immagine']);
        expect(blocchi[0]).toMatchObject({ livello: 1 });
        const tabella = blocchi[3] as Extract<typeof blocchi[number], { tipo: 'tabella' }>;
        expect(tabella.righe[0]!.map((c) => c.map((p) => p.testo).join(''))).toEqual(['a|b', 'c\\d']);
        expect(blocchi[5]).toEqual({ tipo: 'immagine', chiave: 'radice', didascalia: 'Diagramma: Prova' });
    });

    it('grassetto, corsivo e codice; il trattino basso dentro una parola resta', () => {
        expect(leggiRiga('id sys_cap_2 e _corsivo_ e **forte** e `x_y`')).toEqual([
            { testo: 'id sys_cap_2 e ' }, { testo: 'corsivo', corsivo: true }, { testo: ' e ' },
            { testo: 'forte', grassetto: true }, { testo: ' e ' }, { testo: 'x_y', codice: true }
        ]);
    });
});

describe('Word', () => {
    it('frontespizio, revisioni, titoli con gli stili, tabella, intestazione e piè di pagina con i numeri di pagina', () => {
        const zip = new ArchivioZip(scriviDocx(richiesta(), null));
        const documento = zip.leggi('word/document.xml', 10_000_000).toString('utf-8');
        expect(documento).toContain('ACME S.p.A.');
        expect(documento).toContain('Prova &lt;&amp;&gt;');
        expect(documento).toContain('Registro delle revisioni');
        expect(documento).toContain('Prima emissione');
        expect(documento).toContain('<w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">1. Scopo</w:t></w:r>');
        expect(documento).not.toContain('Data: 2026-10-06 · Libreria');
        expect(documento).toContain('<w:i/></w:rPr><w:t xml:space="preserve">Da completare.</w:t>');
        expect(documento).toContain('a|b');
        // Revisione corrente: l'ultima riga
        expect(documento).toContain('<w:t xml:space="preserve">B</w:t>');
        expect(zip.leggi('word/header1.xml', 100_000).toString('utf-8')).toContain('ACME S.p.A. · SSS · Rev. B');
        const pie = zip.leggi('word/footer1.xml', 100_000).toString('utf-8');
        expect(pie).toContain('Uso interno · Pagina ');
        expect(pie).toContain('NUMPAGES');
        expect(zip.ha('word/styles.xml') && zip.ha('[Content_Types].xml') && zip.ha('word/numbering.xml')).toBe(true);
    });

    it('logo e diagramma come immagini nel pacchetto', () => {
        const r = richiesta({ immagini: { radice: { svg: '<svg/>', png: new Uint8Array(PNG), larghezza: 400, altezza: 200 } } });
        const zip = new ArchivioZip(scriviDocx(r, { dati: PNG, tipo: 'png', larghezza: 1, altezza: 1 }));
        expect(zip.ha('word/media/immagine1.png') && zip.ha('word/media/immagine2.png')).toBe(true);
        expect(zip.leggi('word/_rels/document.xml.rels', 100_000).toString('utf-8')).toContain('media/immagine2.png');
        expect(zip.leggi('word/document.xml', 10_000_000).toString('utf-8')).toContain('Diagramma: Prova');
    });
});

describe('PDF e richiesta', () => {
    it('la pagina da stampare ha frontespizio, revisioni e testi con l\'escape', () => {
        const html = htmlDocumento(richiesta({ formato: 'pdf' }), null);
        expect(html).toContain('<div class="azienda">ACME S.p.A.</div>');
        expect(html).toContain('Prova &lt;&amp;&gt;');
        expect(html).toContain('<h1>1. Scopo</h1>');
        expect(html).toContain('<strong>Classificazione:</strong> Riservato');
    });

    it('richiesta della pagina controllata; logo solo dentro la cartella di lavoro, PNG o JPEG', () => {
        expect(controllaRichiesta({ formato: 'exe', markdown: '' })).toBeNull();
        expect(controllaRichiesta({ formato: 'pdf', markdown: 'x', modello: { azienda: 3 } })?.modello.azienda).toBe('');
        const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'modellatore-logo-'));
        try {
            fs.writeFileSync(path.join(cartella, 'logo.png'), PNG);
            fs.writeFileSync(path.join(cartella, 'logo.txt'), 'testo');
            expect(leggiLogo(cartella, 'logo.png').logo).toMatchObject({ tipo: 'png', larghezza: 1, altezza: 1 });
            expect(leggiLogo(cartella, '../fuori.png').motivo).toBe('../fuori.png è fuori dalla cartella di lavoro');
            expect(leggiLogo(cartella, 'logo.txt').motivo).toBe('logo.txt non è un PNG o un JPEG');
            expect(leggiLogo(cartella, 'manca.png').motivo).toBe('manca.png non si trova');
            expect(leggiLogo(cartella, '')).toEqual({ logo: null, motivo: null });
        } finally {
            fs.rmSync(cartella, { recursive: true, force: true });
        }
    });
});
