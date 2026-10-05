/* --- E2E INTERFACCIA: COERENZA, GERARCHIA, MATRICE E DOCUMENTI (funzionalità 4, 5, 6, 7) --- */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { apriApp, intercettaDownload, pronta, registraDialoghi, type AppDiProva } from '../app';
import { LIBRERIA_PROVA, progettoTracciato } from '../dati/libreria';

test.describe.serial('tracciabilità su un progetto con requisiti cliente', () => {
    let a: AppDiProva;
    let scaricati: () => Promise<string[]>;
    let cartellaDownload = '';

    test.beforeAll(async () => {
        a = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoTracciato() }, ultimo: 'sistema' });
        registraDialoghi(a.pagina);
        cartellaDownload = path.join(a.cartella, '..', 'download');
        fs.mkdirSync(cartellaDownload, { recursive: true });
        scaricati = await intercettaDownload(a.app, cartellaDownload);
        await pronta(a.pagina);
    });
    test.afterAll(async () => { await a.chiudi(); });

    test('Verifica Coerenza: cliente senza figli e requisiti senza padre, con alone sui pin', async () => {
        const { pagina } = a;
        await expect(pagina.locator('#parentLayer')).toContainText('R1');
        await pagina.locator('#btnDRC').click();
        await expect(pagina.locator('#btnDRC')).toHaveAttribute('aria-pressed', 'true');
        await expect(pagina.locator('#schedaCoerenza')).toBeVisible();
        const gruppi = pagina.locator('#coerenzaGruppi');
        // Gruppi chiusi con il conteggio: ali_001, cen_001, cen_002 senza padre (ali_002 deriva da CLI-R1)
        await expect(gruppi).toContainText(/Cliente senza figli\s*1/);
        await expect(gruppi).toContainText(/Requisiti senza padre\s*3/);
        await gruppi.getByText('Cliente senza figli').click();
        await gruppi.getByText('Requisiti senza padre').click();
        await expect(gruppi).toContainText('R2');
        await expect(gruppi).toContainText('cen_002');
        await expect(gruppi).not.toContainText('ali_002');
        expect(await pagina.locator('.problema-coerenza').count()).toBeGreaterThan(0);
        await pagina.locator('#btnDRC').click();
        await expect(pagina.locator('#btnDRC')).toHaveAttribute('aria-pressed', 'false');
    });

    test('Gerarchia: scelto il requisito cliente si vede il figlio ali_002', async () => {
        const { pagina } = a;
        await pagina.locator('#btnGerarchia').click();
        await expect(pagina.locator('#schedaGerarchia')).toBeVisible();
        await pagina.locator('#parentLayer .parent-block').filter({ hasText: 'R1' }).first().click();
        const contenuto = pagina.locator('#gerarchiaContenuto');
        await expect(contenuto).toContainText('È un requisito cliente');
        await expect(contenuto).toContainText(/Discendenti\s*1 occorrenza/);
        await expect(contenuto).toContainText('ali_002');
        await pagina.locator('#btnGerarchia').click();
    });

    test('Matrice: derivazione con documenti, filtro per documento ed export .md', async () => {
        const { pagina } = a;
        await pagina.locator('#btnReqMatrix').click();
        await expect(pagina.locator('#pannelloMatrice')).toBeVisible();
        const tabella = pagina.locator('#matriceContenuto');
        await expect(tabella).toContainText('R1');
        await expect(tabella).toContainText('ali_002');
        await pagina.locator('#matriceDocumento').selectOption('IDD');
        await expect(tabella).not.toContainText('ali_002');
        await pagina.locator('#matriceDocumento').selectOption({ index: 0 });
        await pagina.locator('#btnEsportaMatrice').click();
        await expect.poll(scaricati).toHaveLength(1);
        const nome = (await scaricati())[0] ?? '';
        expect(nome).toMatch(/\.md$/);
        await expect.poll(() => fs.existsSync(path.join(cartellaDownload, nome))).toBe(true);
        expect(fs.readFileSync(path.join(cartellaDownload, nome), 'utf-8')).toContain('ali_002');
    });

    test('Matrice aperta come pannello: si aggiorna dopo una modifica e con Ctrl+Z (spec 0022)', async () => {
        const { pagina } = a;
        const conteggi = pagina.locator('#matriceConteggi');
        const prima = await conteggi.textContent();
        // Tolgo la derivazione CLI-R1 → ali_002 dal canvas: la Matrice resta aperta e si ricalcola
        await pagina.locator('#edgesLayer .edge-derivazione').first().dispatchEvent('contextmenu');
        await expect(conteggi).not.toHaveText(prima ?? '');
        await expect(pagina.locator('#btnAnnulla')).toBeEnabled();
        await pagina.locator('#matriceConteggi').click();
        await pagina.keyboard.press('Control+z');
        await expect(conteggi).toHaveText(prima ?? '');
        await pagina.locator('.dv-tab[data-tab-panel-id="matrice"] .dv-default-tab-action').click();
        await expect(pagina.locator('#pannelloMatrice')).toBeHidden();
    });

    test('Documenti: SSS con i testi da esportare ed export .md', async () => {
        const { pagina } = a;
        await pagina.locator('#btnDocumenti').click();
        await expect(pagina.locator('#pannelloDocumenti')).toBeVisible();
        await pagina.locator('#documentiScelta').selectOption('SSS');
        const anteprima = pagina.locator('#anteprimaDocumento');
        await expect(anteprima).toContainText("L'efficienza è almeno del 90%");
        await expect(anteprima).toContainText('ali_002');
        await pagina.locator('#btnEsportaDocumento').click();
        await expect.poll(async () => (await scaricati()).length).toBe(2);
        const nome = (await scaricati())[1] ?? '';
        await expect.poll(() => fs.existsSync(path.join(cartellaDownload, nome))).toBe(true);
        expect(fs.readFileSync(path.join(cartellaDownload, nome), 'utf-8')).toContain("L'efficienza è almeno del 90%");
    });
});
