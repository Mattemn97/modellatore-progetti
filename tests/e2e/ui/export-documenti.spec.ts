/* --- E2E INTERFACCIA: EXPORT WORD E PDF CON IL MODELLO AZIENDALE (funzionalità 32, spec 0028) --- */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ArchivioZip } from '../../../src/main/api/zip';
import { apriApp, intercettaDownload, leggiJson, preparaCopia, pronta, registraDialoghi } from '../app';
import { LIBRERIA_PROVA, progettoTracciato } from '../dati/libreria';

// PNG 1x1 come logo dell'azienda
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('Documenti: revisione nel progetto, Word con logo e intestazione, PDF', async () => {
    const copia = preparaCopia({
        libreria: LIBRERIA_PROVA,
        progetti: { sistema: progettoTracciato() },
        ultimo: 'sistema',
        impostazioni: { documentiExport: { anteprimaCaratteri: 200000, modello: { azienda: 'ACME S.p.A.', logo: 'modello/logo.png', classificazione: '', piePagina: 'Uso interno', autore: 'M. Rossi' } } }
    });
    fs.mkdirSync(path.join(copia.cartella, 'modello'));
    fs.writeFileSync(path.join(copia.cartella, 'modello', 'logo.png'), PNG);
    const { app, pagina, cartella, chiudi } = await apriApp({ copia });
    const dialoghi = registraDialoghi(pagina);
    const download = path.join(cartella, '..', 'download');
    fs.mkdirSync(download, { recursive: true });
    const scaricati = await intercettaDownload(app, download);
    try {
        await pronta(pagina);
        await pagina.locator('#btnDocumenti').click();
        await pagina.locator('#documentiScelta').selectOption('SSS');
        await expect(pagina.locator('#anteprimaDocumento')).toContainText('ali_002');

        // Prima revisione: A, data di oggi, autore del modello; la descrizione arriva nel progetto
        await pagina.locator('#revisioniDocumento summary').click();
        await pagina.locator('#btnNuovaRevisione').click();
        await expect(pagina.locator('#righeRevisioni input[data-campo="revisione"]')).toHaveValue('A');
        await expect(pagina.locator('#righeRevisioni input[data-campo="autore"]')).toHaveValue('M. Rossi');
        await pagina.locator('#righeRevisioni input[data-campo="descrizione"]').fill('Prima emissione');
        await pagina.locator('#righeRevisioni input[data-campo="descrizione"]').press('Tab');
        const fileProgetto = path.join(cartella, 'progetti', 'sistema.json');
        await expect.poll(() => leggiJson<{ revisioniDocumenti?: Record<string, Array<{ descrizione: string }>> }>(fileProgetto)
            .revisioniDocumenti?.SSS?.[0]?.descrizione).toBe('Prima emissione');

        await pagina.locator('#btnEsportaWord').click();
        await expect.poll(async () => (await scaricati()).includes('sistema-sss.docx')).toBe(true);
        const fileWord = path.join(download, 'sistema-sss.docx');
        await expect.poll(() => fs.existsSync(fileWord) && fs.statSync(fileWord).size > 0).toBe(true);
        const zip = new ArchivioZip(fs.readFileSync(fileWord));
        const documento = zip.leggi('word/document.xml', 10_000_000).toString('utf-8');
        expect(documento).toContain('ACME S.p.A.');
        expect(documento).toContain('Prima emissione');
        expect(documento).toContain("L'efficienza è almeno del 90%");
        expect(zip.ha('word/media/immagine1.png')).toBe(true);
        expect(zip.leggi('word/header1.xml', 100_000).toString('utf-8')).toContain('ACME S.p.A. · SSS · Rev. A');
        await expect(pagina.locator('#documentiAvviso')).toBeHidden();

        await pagina.locator('#btnEsportaPdf').click();
        await expect.poll(async () => (await scaricati()).includes('sistema-sss.pdf'), { timeout: 20_000 }).toBe(true);
        const filePdf = path.join(download, 'sistema-sss.pdf');
        await expect.poll(() => fs.existsSync(filePdf) && fs.statSync(filePdf).size > 1000).toBe(true);
        expect(fs.readFileSync(filePdf).subarray(0, 5).toString('latin1')).toBe('%PDF-');
        expect(dialoghi).toEqual([]);
    } finally {
        await chiudi();
    }
});

test('🖼 Immagine: il livello come SVG e PNG; il Word dell\'IRS ha il diagramma della radice (spec 0029)', async () => {
    const { app, pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoTracciato() }, ultimo: 'sistema' });
    const dialoghi = registraDialoghi(pagina);
    const download = path.join(cartella, '..', 'download');
    fs.mkdirSync(download, { recursive: true });
    const scaricati = await intercettaDownload(app, download);
    const scaricato = async (nome: string): Promise<Buffer> => {
        await expect.poll(async () => (await scaricati()).includes(nome)).toBe(true);
        const file = path.join(download, nome);
        await expect.poll(() => fs.existsSync(file) && fs.statSync(file).size > 0).toBe(true);
        return fs.readFileSync(file);
    };
    try {
        await pronta(pagina);
        await pagina.locator('#btnImmagine').click();
        await pagina.locator('#menuImmagine [data-formato="svg"]').click();
        const svg = (await scaricato('sistema-radice.svg')).toString('utf-8');
        expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
        expect(svg).toContain('>Alimentatore</text>');
        expect(svg).toContain('>Centralina</text>');
        await expect(pagina.locator('#menuImmagine')).toBeHidden();

        await pagina.locator('#btnImmagine').click();
        await pagina.locator('#menuImmagine [data-formato="png"]').click();
        expect((await scaricato('sistema-radice.png')).subarray(1, 4).toString('latin1')).toBe('PNG');

        await pagina.locator('#btnDocumenti').click();
        await pagina.locator('#documentiScelta').selectOption('IRS');
        await expect(pagina.locator('#anteprimaDocumento')).toContainText('_Diagrammi da completare._');
        await pagina.locator('#btnEsportaWord').click();
        const zip = new ArchivioZip(await scaricato('sistema-irs.docx'));
        expect(zip.ha('word/media/immagine1.png')).toBe(true);
        expect(zip.leggi('word/document.xml', 10_000_000).toString('utf-8')).toContain('Diagramma: Sistema tracciato');
        expect(dialoghi).toEqual([]);
    } finally {
        await chiudi();
    }
});
