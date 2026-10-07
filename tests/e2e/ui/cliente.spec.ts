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
        await pagina.locator('.dv-tab[data-tab-panel-id="cliente"]').click();
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

test('filtro delle righe (spec 0030): solo le righe che passano diventano requisiti e il filtro si ripropone', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA });
    registraDialoghi(pagina);
    const csv = path.join(cartella, '..', 'clienti-misti.csv');
    fs.writeFileSync(csv, 'ID;Tipo;Testo\n1;Titolo;Capitolo 1\nR1;Requirement;Il sistema pesa meno di 10 kg\nN1;Nota;Una nota\nR2;REQ;Il sistema funziona a 24V\n', 'utf-8');
    const importa = async () => {
        const scelta = pagina.waitForEvent('filechooser');
        await pagina.locator('#btnImportaCliente').click();
        await (await scelta).setFiles(csv);
        await expect(pagina.locator('#importClienteModal')).toBeVisible();
    };
    try {
        await pronta(pagina);
        await pagina.locator('.dv-tab[data-tab-panel-id="cliente"]').click();
        await importa();
        await pagina.locator('select[data-campo="id"]').selectOption({ label: 'A: ID' });
        await pagina.locator('select[data-campo="testo"]').selectOption({ label: 'C: Testo' });
        await expect(pagina.locator('#impAnteprima')).toContainText('4 nuovi');
        await expect(pagina.locator('#impEsitoFiltro')).toHaveCount(0);

        await pagina.locator('#impFiltroColonna').selectOption({ label: 'B: Tipo' });
        await pagina.locator('#impFiltroTesto').fill('requirement; req');
        await expect(pagina.locator('#impEsitoFiltro')).toHaveText('2 righe passano il filtro, 2 escluse');
        await expect(pagina.locator('#impAnteprima')).toContainText('2 nuovi');
        await pagina.locator('[data-scheda="esclusi"]').click();
        await expect(pagina.locator('#impAnteprima .contenuto-scheda-import')).toContainText('Nota');
        await pagina.locator('#impConferma').click();
        await expect(pagina.locator('#importClienteModal')).toBeHidden();

        const file = path.join(cartella, 'progetti', 'nuovo_progetto.json');
        type ConFiltro = { cliente?: { requisiti: Array<{ idCliente: string }>; ultimoImport: { filtro: unknown; conteggi: Record<string, number> } } };
        await expect.poll(() => leggiJson<ConFiltro>(file).cliente?.requisiti.map((r) => r.idCliente)).toEqual(['R1', 'R2']);
        expect(leggiJson<ConFiltro>(file).cliente?.ultimoImport).toMatchObject({
            filtro: { colonna: { nome: 'Tipo', lettera: 'B' }, testo: 'requirement; req' },
            conteggi: { esclusi: 2, nuovi: 2 }
        });

        // Il secondo import ripropone colonna e testo del filtro
        await importa();
        await expect(pagina.locator('#impFiltroColonna')).toHaveValue('1');
        await expect(pagina.locator('#impFiltroTesto')).toHaveValue('requirement; req');
        await expect(pagina.locator('#impEsitoFiltro')).toHaveText('2 righe passano il filtro, 2 escluse');
        await expect(pagina.locator('#impAnteprima')).toContainText('2 invariati');
        await pagina.locator('#impAnnulla').click();
    } finally {
        await chiudi();
    }
});
