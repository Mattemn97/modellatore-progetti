/* --- E2E INTERFACCIA: PROGETTO SU DISCO (funzionalità 1, spec 0001) --- */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { apriApp, leggiJson, pronta } from '../app';
import { LIBRERIA_PROVA, progettoCollegato } from '../dati/libreria';

type Progetto = { nome: string; workspace: { nodes: Array<{ id: string; position: { x: number } }>; edges: unknown[] } };

async function trascinaBlocco(pagina: Page, titolo: string, x: number, y: number): Promise<void> {
    await pagina.dragAndDrop(`#libraryContent >> text=${titolo}`, '#workspaceSvg', { targetPosition: { x, y } });
}

test('una modifica arriva su disco con una versione; Annulla e Ripeti dai pulsanti e da tastiera', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA });
    const file = path.join(cartella, 'progetti', 'nuovo_progetto.json');
    const nodi = () => leggiJson<Progetto>(file).workspace.nodes.length;
    try {
        await pronta(pagina);
        expect(leggiJson<Progetto>(file)).toEqual({ formatVersion: 2, nome: 'Nuovo progetto', libraryPath: 'shared/libreria.json', workspace: { nodes: [], edges: [] } });
        await trascinaBlocco(pagina, 'Alimentatore', 300, 250);
        await expect.poll(nodi).toBe(1);
        await trascinaBlocco(pagina, 'Centralina', 600, 250);
        await expect.poll(nodi).toBe(2);
        expect(fs.existsSync(path.join(cartella, 'progetti', '_versioni', 'nuovo_progetto.1.json'))).toBe(true);
        await expect(pagina.locator('#badgeSalvataggio')).toHaveText('Salvato');

        await pagina.locator('#btnAnnulla').click();
        await expect.poll(nodi).toBe(1);
        await pagina.locator('#btnRipeti').click();
        await expect.poll(nodi).toBe(2);
        await pagina.locator('#workspaceSvg').click({ position: { x: 40, y: 400 } });
        await pagina.keyboard.press('Control+z');
        await expect.poll(nodi).toBe(1);
        await pagina.keyboard.press('Control+Shift+z');
        await expect.poll(nodi).toBe(2);
    } finally {
        await chiudi();
    }
});

test('Rinomina dal menu Progetto: la finestra di richiesta del testo sostituisce prompt()', async () => {
    const { app, pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoCollegato() }, ultimo: 'sistema' });
    try {
        await pronta(pagina);
        await expect(pagina.locator('#breadcrumb')).toContainText('Sistema di prova');
        await pagina.locator('#btnMenuProgetto').click();
        // La pagina resta ferma finché la finestra non risponde (come prompt): il clic si attende dopo
        const finestraRichiesta = app.waitForEvent('window');
        const clic = pagina.locator('#menuProgetto [data-azione="rinomina"]').click();
        const richiesta = await finestraRichiesta;
        await expect(richiesta.locator('label')).toHaveText('Nuovo nome del progetto:');
        await expect(richiesta.locator('#testo')).toHaveValue('Sistema di prova');
        await richiesta.locator('#testo').fill('Impianto Nord');
        await richiesta.locator('#ok').click();
        await clic;
        const nuovo = path.join(cartella, 'progetti', 'impianto_nord.json');
        await expect.poll(() => fs.existsSync(nuovo)).toBe(true);
        expect(leggiJson<Progetto>(nuovo).nome).toBe('Impianto Nord');
        expect(fs.existsSync(path.join(cartella, 'progetti', 'sistema.json'))).toBe(false);
        await expect(pagina.locator('#breadcrumb')).toContainText('Impianto Nord');

        // Annulla nella finestra: non cambia nulla
        await pagina.locator('#btnMenuProgetto').click();
        const seconda = app.waitForEvent('window');
        const secondoClic = pagina.locator('#menuProgetto [data-azione="rinomina"]').click();
        const annulla = await seconda;
        await expect(annulla.locator('#testo')).toBeVisible();
        // La finestra si chiude durante il tasto: Playwright lo segnala come pagina chiusa
        await annulla.keyboard.press('Escape').catch(() => {});
        await secondoClic;
        await pagina.waitForTimeout(300);
        expect(fs.existsSync(nuovo)).toBe(true);
    } finally {
        await chiudi();
    }
});

test('file cambiato a mano: badge Conflitto, Ricarica dal disco mostra il contenuto nuovo', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoCollegato() }, ultimo: 'sistema' });
    const file = path.join(cartella, 'progetti', 'sistema.json');
    try {
        await pronta(pagina);
        const aMano = leggiJson<Progetto>(file);
        aMano.workspace.nodes = aMano.workspace.nodes.slice(0, 1);
        aMano.workspace.edges = [];
        fs.writeFileSync(file, JSON.stringify(aMano, null, 2), 'utf-8');
        // Una modifica nell'app fa scattare il salvataggio, che trova il file cambiato
        await trascinaBlocco(pagina, 'Sensore', 300, 400);
        await expect(pagina.locator('#badgeSalvataggio')).toHaveText('Conflitto');
        await expect(pagina.locator('#bannerProgetto')).toBeVisible();
        expect(leggiJson<Progetto>(file).workspace.nodes).toHaveLength(1);
        await pagina.locator('#bannerProgetto [data-banner="ricarica"]').click();
        await expect(pagina.locator('#badgeSalvataggio')).toHaveText('Salvato');
        await expect(pagina.locator('#nodesLayer text', { hasText: 'Centralina' })).toHaveCount(0);
        await expect(pagina.locator('#nodesLayer text', { hasText: 'Alimentatore' })).toHaveCount(1);
    } finally {
        await chiudi();
    }
});
