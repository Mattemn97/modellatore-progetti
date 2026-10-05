/* --- E2E INTERFACCIA: IMPORT DEI REQUISITI CLIENTE (funzionalità 3, spec 0003) --- */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { apriApp, leggiJson, pronta, registraDialoghi } from '../app';
import { LIBRERIA_PROVA } from '../dati/libreria';

type Progetto = { cliente?: { prefisso: string; requisiti: Array<{ id: string; idCliente: string; testo: string }> } };

test('import di un CSV: mappatura, conferma, elenco Cliente e blocco tondo sul canvas', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA });
    registraDialoghi(pagina);
    const csv = path.join(cartella, '..', 'clienti.csv');
    fs.writeFileSync(csv, 'ID;Testo;Titolo\nR1;Il sistema pesa meno di 10 kg;Peso\nR2;Il sistema funziona a 24V;Tensione\n', 'utf-8');
    try {
        await pronta(pagina);
        await pagina.locator('[data-scheda="cliente"]').click();
        await expect(pagina.locator('#clienteVuoto')).toBeVisible();
        const scelta = pagina.waitForEvent('filechooser');
        await pagina.locator('#btnImportaCliente').click();
        await (await scelta).setFiles(csv);

        await expect(pagina.locator('#importClienteModal')).toBeVisible();
        await expect(pagina.locator('#importClienteContenuto')).toContainText('clienti.csv');
        await pagina.locator('select[data-campo="id"]').selectOption({ label: 'A: ID' });
        await pagina.locator('select[data-campo="testo"]').selectOption({ label: 'B: Testo' });
        await expect(pagina.locator('#impAnteprima')).toContainText('2 nuovi');
        await pagina.locator('#impConferma').click();
        await expect(pagina.locator('#importClienteModal')).toBeHidden();

        await expect(pagina.locator('#clienteRighe')).toContainText('R1');
        await expect(pagina.locator('#clienteRighe')).toContainText('R2');
        const file = path.join(cartella, 'progetti', 'nuovo_progetto.json');
        await expect.poll(() => leggiJson<Progetto>(file).cliente?.requisiti.map((r) => r.idCliente)).toEqual(['R1', 'R2']);
        expect(leggiJson<Progetto>(file).cliente?.requisiti[0]).toMatchObject({ id: 'CLI-R1', testo: 'Il sistema pesa meno di 10 kg' });

        // Trascinato sulla radice diventa un blocco tondo
        await pagina.dragAndDrop('#clienteRighe [data-id="CLI-R1"]', '#workspaceSvg', { targetPosition: { x: 300, y: 300 } });
        await expect(pagina.locator('#parentLayer')).toContainText('R1');
    } finally {
        await chiudi();
    }
});
