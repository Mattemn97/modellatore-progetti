/* --- E2E INTERFACCIA: FILTRI, FILI, RILASCIO E AIUTO (funzionalità 8, 9, 11, 12) --- */
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { apriApp, leggiJson, pronta, registraDialoghi } from '../app';
import { LIBRERIA_PROVA, progettoCollegato } from '../dati/libreria';

type Progetto = { workspace: { nodes: Array<{ type: string; position: { x: number; y: number }; width: number; height: number }>; edges: Array<{ id: string }> } };

test('Filtri: una sottocategoria attenua o nasconde gli altri blocchi', async () => {
    // Più un sensore senza fili: in modalità Nascondi sparisce, la centralina collegata resta
    const progetto = progettoCollegato() as { workspace: { nodes: unknown[] } };
    progetto.workspace.nodes.push({ id: 'node_s', type: 'sensore', label: 'Sensore', width: 160, height: 60, position: { x: 300, y: 300 }, internal_graph: { nodes: [], edges: [] } });
    const { pagina, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progetto }, ultimo: 'sistema' });
    try {
        await pronta(pagina);
        await pagina.locator('#btnFiltri').click();
        await expect(pagina.locator('#pannelloFiltri')).toBeVisible();
        await pagina.locator('#pannelloFiltri input[data-gruppo="sottocategorie"][value="Potenza"]').check();
        await expect(pagina.locator('#btnFiltri')).toHaveText('🔎 Filtri (1)');
        // Il filo resta incluso finché uno dei suoi estremi lo è
        await expect(pagina.locator('#riepilogoFiltri')).toHaveText('In questo livello: 2 blocchi e 0 fili esclusi');
        // I blocchi esclusi hanno rettangolo ed etichetta attenuati
        await expect(pagina.locator('#nodesLayer rect.node-rect.fuori-filtro')).toHaveCount(2);
        await expect(pagina.locator('#nodesLayer text.fuori-filtro')).toHaveText(['Centralina', 'Sensore']);

        await pagina.locator('#pannelloFiltri input[name="modoFiltri"][value="nascondi"]').check();
        await expect(pagina.locator('#nodesLayer text', { hasText: 'Sensore' })).toHaveCount(0);
        await expect(pagina.locator('#nodesLayer')).toContainText('Centralina');
        await expect(pagina.locator('#nodesLayer')).toContainText('Alimentatore');

        await pagina.locator('#btnAzzeraFiltri').click();
        await expect(pagina.locator('#btnFiltri')).toHaveText('🔎 Filtri');
        await expect(pagina.locator('#nodesLayer')).toContainText('Sensore');
    } finally {
        await chiudi();
    }
});

test('clic su un filo: dettaglio dei due requisiti nell\'ispettore ed eliminazione', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoCollegato() }, ultimo: 'sistema' });
    const dialoghi = registraDialoghi(pagina);
    try {
        await pronta(pagina);
        // Un filo orizzontale ha un riquadro alto 0, che Playwright considera invisibile
        await pagina.locator('#edgesLayer path.edge-path').first().dispatchEvent('click');
        const ispettore = pagina.locator('#propsContent');
        await expect(ispettore).toContainText('ali_001');
        await expect(ispettore).toContainText('cen_001');
        await ispettore.getByText('🗑 Elimina collegamento').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Vuoi eliminare questo collegamento?');
        await expect.poll(() => leggiJson<Progetto>(path.join(cartella, 'progetti', 'sistema.json')).workspace.edges).toHaveLength(0);
    } finally {
        await chiudi();
    }
});

test('un blocco rilasciato con lo zoom cade sotto il cursore', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA });
    try {
        await pronta(pagina);
        const svg = pagina.locator('#workspaceSvg');
        const box = await svg.boundingBox();
        if (!box) throw new Error('canvas senza dimensioni');
        await pagina.mouse.move(box.x + 200, box.y + 200);
        await pagina.mouse.wheel(0, -500);
        await pagina.waitForTimeout(200);
        const punto = { x: 420, y: 330 };
        await pagina.dragAndDrop('#libraryContent >> text=Sensore', '#workspaceSvg', { targetPosition: punto });
        const nodo = pagina.locator('#nodesLayer > g', { hasText: 'Sensore' });
        await expect(nodo).toHaveCount(1);
        const r = await nodo.locator('rect.node-rect').boundingBox();
        if (!r) throw new Error('blocco senza dimensioni');
        // Centro del blocco a meno di un passo di griglia (scalato) dal punto di rilascio
        const scala = r.width / 160;
        expect(scala).toBeGreaterThan(1);
        expect(Math.abs(r.x + r.width / 2 - (box.x + punto.x))).toBeLessThanOrEqual(20 * scala);
        expect(Math.abs(r.y + r.height / 2 - (box.y + punto.y))).toBeLessThanOrEqual(20 * scala);
        await expect.poll(() => leggiJson<Progetto>(path.join(cartella, 'progetti', 'nuovo_progetto.json')).workspace.nodes.length).toBe(1);
    } finally {
        await chiudi();
    }
});

test('tour al primo avvio con la tastiera e suggerimento della (i)', async () => {
    const { pagina, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA });
    try {
        await expect(pagina.getByText('Passo 1 di 17')).toBeVisible({ timeout: 20_000 });
        await pagina.keyboard.press('ArrowRight');
        await expect(pagina.getByText('Passo 2 di 17')).toBeVisible();
        await pagina.keyboard.press('ArrowLeft');
        await expect(pagina.getByText('Passo 1 di 17')).toBeVisible();
        await pagina.keyboard.press('Escape');
        await expect(pagina.getByText('Passo 1 di 17')).toBeHidden();

        await pagina.locator('.icona-aiuto[data-aiuto="libreria.ricerca"]').hover();
        await expect(pagina.locator('#suggerimento')).toBeVisible();
        expect((await pagina.locator('#suggerimento').textContent())?.length ?? 0).toBeGreaterThan(10);

        // Il menu Aiuto fa ripartire il tour
        await pagina.locator('#btnMenuAiuto').click();
        await pagina.locator('[data-aiuto-azione="tour"]').click();
        await expect(pagina.getByText('Passo 1 di 17')).toBeVisible();
    } finally {
        await chiudi();
    }
});
