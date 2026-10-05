/* --- E2E: CARTELLE DI LAVORO, PAGINA DI BENVENUTO E IMPOSTAZIONI (voce 21, spec 0019) --- */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { apriApp, leggiJson, preparaCopia, pronta, registraDialoghi } from '../app';
import { LIBRERIA_PROVA } from '../dati/libreria';

type Libreria = { versione: string; library: Record<string, { titolo: string }> };

test('primo avvio: la pagina di benvenuto propone Documenti, prepara la cartella e la ricorda', async () => {
    const copia = preparaCopia();
    const documenti = path.join(path.dirname(copia.cartella), 'documenti');
    const lavoro = path.join(documenti, 'Modellatore MBSE');
    let a = await apriApp({ copia, senzaCartella: true });
    try {
        await expect(a.pagina.getByText('Benvenuto nel Modellatore MBSE')).toBeVisible();
        await expect(a.pagina.locator('#cartellaLavoro')).toHaveText(lavoro);
        await expect(a.pagina.locator('#cartellaLibrerie')).toHaveText(path.join(lavoro, 'shared'));
        await a.pagina.locator('#btnUsa').click();
        await pronta(a.pagina);
        expect(a.pagina.url()).toBe('app://modellatore/index.html');
        await expect(a.pagina.getByText('Centralina Condivisa')).toBeVisible();
        expect(fs.existsSync(path.join(lavoro, 'progetti', 'nuovo_progetto.json'))).toBe(true);
        expect(fs.existsSync(path.join(lavoro, 'shared', 'libreria.json'))).toBe(true);
        expect(fs.readFileSync(path.join(lavoro, 'settings.json'), 'utf-8')).toBe(fs.readFileSync(path.join(copia.cartella, 'settings.json'), 'utf-8'));
        expect(leggiJson(path.join(copia.datiUtente, 'configurazione.json'))).toEqual({ formatVersion: 1, cartellaLavoro: lavoro, cartellaLibrerie: null });
    } finally {
        await a.app.close();
    }
    // Secondo avvio: niente benvenuto, si apre l'editor sulla cartella ricordata
    a = await apriApp({ copia, senzaCartella: true });
    try {
        await pronta(a.pagina);
        expect(a.pagina.url()).toBe('app://modellatore/index.html');
    } finally {
        await a.chiudi();
    }
});

test('cartella di lavoro sparita: il benvenuto spiega quale e propone di ricrearla', async () => {
    const copia = preparaCopia();
    const sparita = path.join(path.dirname(copia.cartella), 'non-esiste-piu');
    fs.mkdirSync(copia.datiUtente, { recursive: true });
    fs.writeFileSync(path.join(copia.datiUtente, 'configurazione.json'), JSON.stringify({ formatVersion: 1, cartellaLavoro: sparita, cartellaLibrerie: null }));
    const a = await apriApp({ copia, senzaCartella: true });
    try {
        await expect(a.pagina.locator('#motivo')).toContainText(sparita);
        await expect(a.pagina.locator('#cartellaLavoro')).toHaveText(sparita);
        // Le API rispondono 503 finché non c'è una cartella
        const stato = await a.pagina.evaluate(async () => (await fetch('/api/progetti')).status);
        expect(stato).toBe(503);
        await a.pagina.locator('#btnUsa').click();
        await pronta(a.pagina);
        expect(fs.existsSync(path.join(sparita, 'progetti'))).toBe(true);
    } finally {
        await a.chiudi();
    }
});

test('Impostazioni: spostare la cartella delle librerie, crearla e salvarci un blocco', async () => {
    const a = await apriApp({ libreria: LIBRERIA_PROVA });
    const dialoghi = registraDialoghi(a.pagina);
    const nuove = path.join(path.dirname(a.cartella), 'librerie-di-rete');
    try {
        await pronta(a.pagina);
        await a.pagina.locator('#btnImpostazioni').click();
        await expect(a.pagina.locator('#impostazioniModal')).toBeVisible();
        await expect(a.pagina.locator('#impLavoro')).toHaveText(a.cartella);
        await expect(a.pagina.locator('#impLibrerie')).toContainText('(predefinita)');
        await expect(a.pagina.locator('[data-imp="applica"]')).toBeDisabled();

        // La finestra di Windows per scegliere la cartella risponde con la cartella nuova
        await a.app.evaluate(({ dialog }, scelta) => {
            dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [scelta] })) as typeof dialog.showOpenDialog;
        }, nuove);
        await a.pagina.locator('[data-imp="cambiaLibrerie"]').click();
        await expect(a.pagina.locator('#impLibrerie')).toHaveText(nuove);
        await a.pagina.locator('[data-imp="applica"]').click();
        await expect.poll(() => dialoghi.at(-1) ?? '').toContain(nuove);
        // Ricaricato sulle cartelle nuove: libreria di esempio nella cartella nuova
        await expect(a.pagina.getByText('Centralina Condivisa')).toBeVisible();
        expect(fs.existsSync(path.join(nuove, 'libreria.json'))).toBe(true);
        expect(leggiJson(path.join(a.datiUtente, 'configurazione.json'))).toEqual({ formatVersion: 1, cartellaLavoro: a.cartella, cartellaLibrerie: nuove });

        await a.pagina.locator('#libraryContent').getByText('Centralina Condivisa', { exact: true }).click();
        await a.pagina.locator('#edtBlockTitolo').fill('Centralina di rete');
        await a.pagina.locator('#btnSaveBlockToLib').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Blocco salvato. Libreria v1.0.1 (patch).');
        expect(leggiJson<Libreria>(path.join(nuove, 'libreria.json')).library.centralina_condivisa?.titolo).toBe('Centralina di rete');
        // La libreria della cartella di lavoro non è stata toccata
        expect(leggiJson<Libreria>(path.join(a.cartella, 'shared', 'libreria.json')).versione).toBe('1.0.0');
    } finally {
        await a.chiudi();
    }
});

test('settings.json della pagina è quello della cartella di lavoro', async () => {
    const a = await apriApp({ impostazioni: { grid: { size: 40 } } });
    try {
        await pronta(a.pagina);
        const servito = await a.pagina.evaluate(async () => (await (await fetch('settings.json')).json()).grid.size);
        expect(servito).toBe(40);
    } finally {
        await a.chiudi();
    }
});
