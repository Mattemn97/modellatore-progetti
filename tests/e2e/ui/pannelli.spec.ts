/* --- E2E INTERFACCIA: PANNELLI AGGANCIABILI, MENU FINESTRA E LAYOUT SALVATO (spec 0021) --- */
import { expect, test, type Page } from '@playwright/test';
import { apriApp, pronta } from '../app';
import { LIBRERIA_PROVA, progettoTracciato } from '../dati/libreria';

const scheda = (pagina: Page, id: string) => pagina.locator(`.dv-tab[data-tab-panel-id="${id}"]`);
const voce = (pagina: Page, id: string) => pagina.locator(`#menuFinestra [data-pannello="${id}"]`);

test('chiusi, ricaricati, riaperti dal menu Finestra e ripristinati', async () => {
    const { pagina, chiudi } = await apriApp();
    try {
        await pronta(pagina);
        // Disposizione predefinita (AC-1): Libreria e Cliente a schede, Canvas, Ispettore
        for (const id of ['libreria', 'cliente', 'canvas', 'ispettore']) await expect(scheda(pagina, id)).toHaveCount(1);
        await expect(pagina.locator('#schedaLibreria')).toBeVisible();
        await expect(pagina.locator('#propertiesPanel')).toBeVisible();

        // ✕ sulla scheda Cliente, Ispettore dal menu (AC-3)
        // La ✕ di una scheda dietro un'altra compare solo al passaggio del mouse
        await scheda(pagina, 'cliente').hover();
        await scheda(pagina, 'cliente').locator('.dv-default-tab-action').click();
        await pagina.locator('#toggleRightBtn').click();
        await expect(scheda(pagina, 'cliente')).toHaveCount(0);
        await expect(scheda(pagina, 'ispettore')).toHaveCount(0);

        // Il layout resta dopo una ricarica (AC-4)
        await pagina.waitForTimeout(500);
        await pagina.reload();
        await pronta(pagina);
        await expect(scheda(pagina, 'canvas')).toHaveCount(1);
        await expect(scheda(pagina, 'cliente')).toHaveCount(0);
        await expect(scheda(pagina, 'ispettore')).toHaveCount(0);

        // Il tour apre il pannello chiuso che spiega e lo richiude all'uscita (AC-7)
        await pagina.locator('#btnMenuAiuto').click();
        await pagina.locator('[data-aiuto-azione="tour"]').click();
        for (let i = 0; i < 7; i++) await pagina.keyboard.press('ArrowRight');
        await expect(pagina.getByText('Requisiti cliente', { exact: true })).toBeVisible();
        await expect(pagina.locator('#schedaCliente')).toBeVisible();
        await pagina.keyboard.press('Escape');
        await expect(scheda(pagina, 'cliente')).toHaveCount(0);

        await pagina.locator('#btnMenuFinestra').click();
        await expect(voce(pagina, 'cliente')).toHaveAttribute('aria-checked', 'false');
        await expect(voce(pagina, 'libreria')).toHaveAttribute('aria-checked', 'true');
        await voce(pagina, 'cliente').click();
        await expect(pagina.locator('#schedaCliente')).toBeVisible();

        await pagina.locator('#btnMenuFinestra').click();
        await pagina.locator('#menuFinestra [data-azione="ripristina"]').click();
        for (const id of ['libreria', 'cliente', 'canvas', 'ispettore']) await expect(scheda(pagina, id)).toHaveCount(1);
        await expect(pagina.locator('#schedaLibreria')).toBeVisible();
    } finally {
        await chiudi();
    }
});

test('il pannello Coerenza segue la modalità e la ✕ la spegne', async () => {
    const { pagina, chiudi } = await apriApp();
    try {
        await pronta(pagina);
        await expect(scheda(pagina, 'coerenza')).toHaveCount(0);
        await pagina.locator('#btnDRC').click();
        await expect(pagina.locator('#schedaCoerenza')).toBeVisible();
        await scheda(pagina, 'coerenza').locator('.dv-default-tab-action').click();
        await expect(pagina.locator('#btnDRC')).toHaveAttribute('aria-pressed', 'false');
        await expect(scheda(pagina, 'coerenza')).toHaveCount(0);
        // Il Canvas non ha la ✕ (AC-2)
        await expect(scheda(pagina, 'canvas').locator('.dv-default-tab-action')).toBeHidden();
        await expect(scheda(pagina, 'canvas')).toHaveCount(1);

        // Canvas dietro la scheda Cliente: il tour lo porta davanti e alla fine torna come prima (spec 0021, AC-7)
        await pagina.dragAndDrop('.dv-tab[data-tab-panel-id="cliente"]', '.contenuto-pannello[data-pannello="canvas"]');
        await expect(pagina.locator('#schedaCliente')).toBeVisible();
        await expect(pagina.locator('#workspaceSvg')).toBeHidden();
        await pagina.locator('#btnMenuAiuto').click();
        await pagina.locator('[data-aiuto-azione="tour"]').click();
        for (let i = 0; i < 8; i++) await pagina.keyboard.press('ArrowRight');
        await expect(pagina.getByText('Il canvas', { exact: true })).toBeVisible();
        await expect(pagina.locator('#workspaceSvg')).toBeVisible();
        await pagina.keyboard.press('Escape');
        await expect(pagina.locator('#schedaCliente')).toBeVisible();
    } finally {
        await chiudi();
    }
});

test('la Matrice si stacca in una finestra, resta allineata e si riaggancia (spec 0023)', async () => {
    const { app, pagina, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoTracciato() }, ultimo: 'sistema' });
    try {
        await pronta(pagina);
        await pagina.locator('#btnReqMatrix').click();
        await expect(pagina.locator('#matriceContenuto')).toContainText('ali_002');
        const gruppo = pagina.locator('.dv-groupview', { has: pagina.locator('.dv-tab[data-tab-panel-id="matrice"]') });
        const nuova = app.waitForEvent('window');
        await gruppo.locator('.pulsante-stacca').click();
        const staccata = await nuova;
        await expect(staccata.locator('#pannelloMatrice')).toBeVisible();
        await expect(pagina.locator('#pannelloMatrice')).toHaveCount(0);

        // Un filtro cambiato nella finestra staccata ricalcola la tabella lì (lo stesso codice della principale)
        await staccata.locator('#matriceDocumento').selectOption('IDD');
        await expect(staccata.locator('#matriceContenuto')).not.toContainText('ali_002');
        await staccata.locator('#matriceDocumento').selectOption({ index: 0 });
        await expect(staccata.locator('#matriceContenuto')).toContainText('ali_002');

        // Il menu di una colonna si apre nella finestra staccata (spec 0031)
        await staccata.locator('.menu-colonna[data-colonna="idPadre"]').click();
        await expect(staccata.locator('#menuColonnaMatrice')).toBeVisible();
        await staccata.locator('#menuColonnaMatrice input[data-valore="R1"]').uncheck();
        await staccata.locator('#menuColonnaMatrice [data-azione="ok"]').click();
        await expect(staccata.locator('#matriceContenuto')).not.toContainText('ali_002');
        await staccata.locator('#btnPulisciMatrice').click();
        await expect(staccata.locator('#matriceContenuto')).toContainText('ali_002');

        // Il clic chiude la sua stessa finestra: Playwright a volte lo segnala come pagina chiusa a metà clic.
        // L'effetto si controlla sotto
        await staccata.locator('.pulsante-stacca').click().catch(() => undefined);
        await expect(pagina.locator('#pannelloMatrice')).toBeVisible();
        await expect.poll(() => staccata.isClosed()).toBe(true);
    } finally {
        await chiudi();
    }
});
