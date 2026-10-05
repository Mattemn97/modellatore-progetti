/* --- E2E: IMPORT DEI DATI DI UNA INSTALLAZIONE 1.x (voce 22) --- */
import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { apriApp, leggiJson, pronta, registraDialoghi, type AppDiProva } from '../app';
import { LIBRERIA_PROVA, progettoCollegato } from '../dati/libreria';

// Una cartella come quella accanto a start.exe della 1.x
function cartellaV1(base: string): string {
    const v1 = path.join(base, 'ModellatoreMBSE-1.4.2');
    const scrivi = (rel: string, dati: unknown) => {
        fs.mkdirSync(path.dirname(path.join(v1, rel)), { recursive: true });
        fs.writeFileSync(path.join(v1, rel), typeof dati === 'string' ? dati : JSON.stringify(dati, null, 2), 'utf-8');
    };
    scrivi('start.exe', 'finto');
    scrivi('progetti/impianto.json', progettoCollegato('Impianto della 1.x'));
    scrivi('progetti/_versioni/impianto.1.json', progettoCollegato('Impianto prima'));
    scrivi('progetti/_ultimo.json', { progetto: 'impianto' });
    scrivi('shared/libreria.json', { formatVersion: 1, versione: '1.4.0', library: LIBRERIA_PROVA });
    scrivi('shared/libreria.changelog.json', { formatVersion: 1, voci: [] });
    scrivi('settings.json', { grid: { size: 25 } });
    return v1;
}

// Impronta di tutti i file della cartella: deve restare identica dopo l'import
function impronta(cartella: string): string {
    const h = crypto.createHash('sha1');
    const visita = (c: string) => {
        for (const v of fs.readdirSync(c, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(c, v.name);
            if (v.isDirectory()) visita(p);
            else h.update(p).update(fs.readFileSync(p));
        }
    };
    visita(cartella);
    return h.digest('hex');
}

async function avviaImport(a: AppDiProva, v1: string): Promise<void> {
    await a.pagina.locator('#btnImpostazioni').click();
    await a.app.evaluate(({ dialog }, scelta) => {
        dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [scelta] })) as typeof dialog.showOpenDialog;
    }, v1);
    await a.pagina.locator('[data-imp="importaV1"]').click();
}

test('import con i file diversi sostituiti: progetti, versioni, librerie e settings arrivano, la 1.x resta identica', async () => {
    const a = await apriApp();
    const dialoghi = registraDialoghi(a.pagina);
    const v1 = cartellaV1(path.dirname(a.cartella));
    const prima = impronta(v1);
    try {
        await pronta(a.pagina);
        await avviaImport(a, v1);
        await expect.poll(() => dialoghi.at(-1) ?? '').toMatch(/^Import completato: \d+ file copiati/);
        expect(dialoghi[0]).toContain('file nuovi da copiare');
        // libreria.json e settings.json c'erano già e sono diversi: la seconda domanda li elenca
        expect(dialoghi[1]).toContain(path.join('shared', 'libreria.json'));
        expect(dialoghi[1]).toContain('settings.json');
        await pronta(a.pagina);
        expect(leggiJson<{ nome: string }>(path.join(a.cartella, 'progetti', 'impianto.json')).nome).toBe('Impianto della 1.x');
        expect(fs.existsSync(path.join(a.cartella, 'progetti', '_versioni', 'impianto.1.json'))).toBe(true);
        expect(leggiJson<{ versione: string }>(path.join(a.cartella, 'shared', 'libreria.json')).versione).toBe('1.4.0');
        expect(leggiJson<{ grid: { size: number } }>(path.join(a.cartella, 'settings.json')).grid.size).toBe(25);
        // L'editor ricaricato vede la libreria importata
        await expect(a.pagina.locator('#libraryContent')).toContainText('Alimentatore');
        expect(impronta(v1)).toBe(prima);
    } finally {
        await a.chiudi();
    }
});

test('import con i file diversi lasciati come sono: si copiano solo i nuovi', async () => {
    const a = await apriApp();
    // OK a tutto tranne alla domanda sui file diversi
    const dialoghi = registraDialoghi(a.pagina, (m) => !m.startsWith('Questi file esistono già'));
    const v1 = cartellaV1(path.dirname(a.cartella));
    const libreriaPrima = fs.readFileSync(path.join(a.cartella, 'shared', 'libreria.json'));
    try {
        await pronta(a.pagina);
        await avviaImport(a, v1);
        await expect.poll(() => dialoghi.at(-1) ?? '').toMatch(/^Import completato/);
        // Nuovi: il progetto e la sua versione; diversi e lasciati: libreria, changelog, _ultimo.json e settings.json creati dall'app
        expect(dialoghi.at(-1)).toBe('Import completato: 2 file copiati, 4 lasciati come erano.');
        expect(fs.readFileSync(path.join(a.cartella, 'shared', 'libreria.json')).equals(libreriaPrima)).toBe(true);
        expect(fs.existsSync(path.join(a.cartella, 'progetti', 'impianto.json'))).toBe(true);
        expect(fs.existsSync(path.join(a.cartella, 'shared', 'libreria.changelog.json'))).toBe(true);
    } finally {
        await a.chiudi();
    }
});

test('una cartella che non è della 1.x si rifiuta con un messaggio', async () => {
    const a = await apriApp();
    const vuota = path.join(path.dirname(a.cartella), 'qualcosa');
    fs.mkdirSync(vuota);
    try {
        await pronta(a.pagina);
        await avviaImport(a, vuota);
        await expect(a.pagina.locator('#impMessaggio')).toContainText('Non sembra la cartella di una versione 1.x');
    } finally {
        await a.chiudi();
    }
});
