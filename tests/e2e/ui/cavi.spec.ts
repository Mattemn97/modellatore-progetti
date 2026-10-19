/* --- E2E CAVI FISICI: STRATO SEPARATO, CREAZIONE, ISPETTORE E LISTA (spec 0036) --- */
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { apriApp, leggiJson, pronta, registraDialoghi } from '../app';
import { LIBRERIA_PROVA, progettoCollegato } from '../dati/libreria';

type Progetto = { workspace: { edges: Array<{ id: string }>; cavi?: Array<{ sigla: string; da: string; a: string; fili: string[]; tipo?: string; lunghezza?: number }> } };

test('strato Cavi: niente fili, un cavo trascinato fra due blocchi porta il filo e finisce nella lista', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoCollegato() }, ultimo: 'sistema' });
    const file = path.join(cartella, 'progetti', 'sistema.json');
    registraDialoghi(pagina);
    try {
        await pronta(pagina);
        await expect(pagina.locator('#edgesLayer path.edge-path')).toHaveCount(1);
        await pagina.locator('#btnStratoCavi').click();
        await expect(pagina.locator('#btnStratoCavi')).toHaveAttribute('aria-pressed', 'true');
        // I due strati non si mescolano: nello strato Cavi nessun filo e nessuna etichetta di filo (AC-3)
        await expect(pagina.locator('#edgesLayer path.edge-path')).toHaveCount(0);
        await expect(pagina.locator('#labelsLayer .lbl:not(.lbl-cavo)')).toHaveCount(0);

        // Maniglia dell'alimentatore trascinata sulla centralina (AC-5)
        const maniglia = pagina.locator('#nodesLayer > g', { hasText: 'Alimentatore' }).locator('circle.maniglia-cavo');
        const da = await maniglia.boundingBox();
        const verso = await pagina.locator('#nodesLayer > g', { hasText: 'Centralina' }).locator('rect.node-rect').boundingBox();
        if (!da || !verso) throw new Error('blocchi senza dimensioni');
        await pagina.mouse.move(da.x + da.width / 2, da.y + da.height / 2);
        await pagina.mouse.down();
        await pagina.mouse.move(verso.x + verso.width / 2, verso.y + 20, { steps: 5 });
        await pagina.mouse.up();
        await expect(pagina.locator('#caviLayer .cavo-g')).toHaveCount(1);
        await expect(pagina.locator('#labelsLayer .lbl-cavo')).toContainText('W001 · 1 filo');

        // Ispettore del cavo: tipo e lunghezza nel file del progetto (AC-6)
        const ispettore = pagina.locator('#propsContent');
        await expect(ispettore).toContainText('Cavo W001');
        await expect(ispettore.locator('input[data-filo-cavo]')).toBeChecked();
        await ispettore.locator('input[data-campo-cavo="tipo"]').fill('Shielded twisted pair (STP)');
        await ispettore.locator('input[data-campo-cavo="tipo"]').press('Tab');
        await ispettore.locator('input[data-campo-cavo="lunghezza"]').fill('2,5');
        await ispettore.locator('input[data-campo-cavo="lunghezza"]').press('Tab');
        await expect.poll(() => leggiJson<Progetto>(file).workspace.cavi?.[0]).toMatchObject({
            sigla: 'W001', da: 'node_a', a: 'node_c', fili: ['edge_1'], tipo: 'Shielded twisted pair (STP)', lunghezza: 2.5
        });

        // Lista dei cavi (AC-7) e ritorno allo strato Interfacce con la colonna Cavo
        await pagina.locator('#navSezioni [data-sezione="cavi"]').click();
        await expect(pagina.locator('#navSezioni [data-conta="cavi"]')).toHaveText('1');
        await expect(pagina.locator('#tabellaCavi tbody tr')).toHaveCount(1);
        await expect(pagina.locator('#tabellaCavi tbody tr')).toContainText('ali_001 ↔ cen_001');
        await pagina.locator('#btnStratoInterfacce').click();
        await expect(pagina.locator('#caviLayer .cavo-g')).toHaveCount(0);
        await expect(pagina.locator('#edgesLayer path.edge-path')).toHaveCount(1);
        await pagina.locator('#navSezioni [data-sezione="interfacce"]').click();
        await expect(pagina.locator('#tabellaInterfacce tbody tr')).toContainText('W001');

        // Eliminare il filo lo toglie dal cavo; il cavo resta, vuoto
        await pagina.locator('#edgesLayer path.edge-path').first().dispatchEvent('contextmenu');
        await expect.poll(() => leggiJson<Progetto>(file).workspace.cavi?.[0]?.fili).toEqual([]);
    } finally {
        await chiudi();
    }
});
