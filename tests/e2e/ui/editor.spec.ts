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
        await expect(pagina.getByText('Passo 1 di 18')).toBeVisible({ timeout: 20_000 });
        await pagina.keyboard.press('ArrowRight');
        await expect(pagina.getByText('Passo 2 di 18')).toBeVisible();
        await pagina.keyboard.press('ArrowLeft');
        await expect(pagina.getByText('Passo 1 di 18')).toBeVisible();
        await pagina.keyboard.press('Escape');
        await expect(pagina.getByText('Passo 1 di 18')).toBeHidden();

        await pagina.locator('.icona-aiuto[data-aiuto="libreria.ricerca"]').hover();
        await expect(pagina.locator('#suggerimento')).toBeVisible();
        expect((await pagina.locator('#suggerimento').textContent())?.length ?? 0).toBeGreaterThan(10);

        // Il menu Aiuto fa ripartire il tour
        await pagina.locator('#btnMenuAiuto').click();
        await pagina.locator('[data-aiuto-azione="tour"]').click();
        await expect(pagina.getByText('Passo 1 di 18')).toBeVisible();
    } finally {
        await chiudi();
    }
});

test('pin di capacità: Shift+trascina lo sposta dentro il blocco, Riposiziona i pin lo rimette in fila (spec 0032)', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoCollegato() }, ultimo: 'sistema' });
    type ConPin = { workspace: { nodes: Array<{ id: string; capabilityPositions?: Record<string, { x: number; y: number }> }>; edges: unknown[] } };
    const file = path.join(cartella, 'progetti', 'sistema.json');
    const alimentatore = () => leggiJson<ConPin>(file).workspace.nodes.find((n) => n.id === 'node_a');
    try {
        await pronta(pagina);
        expect(alimentatore()).not.toHaveProperty('capabilityPositions');
        const svg = await pagina.locator('#workspaceSvg').boundingBox();
        const pin = await pagina.locator('#nodesLayer rect.pin-capacita').first().boundingBox();
        if (!svg || !pin) throw new Error('canvas o pin senza dimensioni');
        // Alimentatore in (100, 100), zoom 1: il pin va in (40, 20) relativo al blocco
        await pagina.mouse.move(pin.x + pin.width / 2, pin.y + pin.height / 2);
        await pagina.keyboard.down('Shift');
        await pagina.mouse.down();
        await pagina.mouse.move(svg.x + 145, svg.y + 118, { steps: 5 });
        await pagina.mouse.up();
        await pagina.keyboard.up('Shift');
        await expect.poll(() => alimentatore()?.capabilityPositions).toEqual({ ali_002: { x: 40, y: 20 } });
        // Nessun filo nuovo: con Shift il pin si sposta e basta
        expect(leggiJson<ConPin>(file).workspace.edges).toHaveLength(1);

        await pagina.locator('#nodesLayer > g', { hasText: 'Alimentatore' }).locator('rect.node-rect').click({ position: { x: 120, y: 10 } });
        const riposiziona = pagina.locator('#btnRiposizionaPin');
        await expect(riposiziona).toBeEnabled();
        await riposiziona.click();
        await expect(riposiziona).toBeDisabled();
        await expect.poll(() => alimentatore()).not.toHaveProperty('capabilityPositions');
    } finally {
        await chiudi();
    }
});

test('instradamento automatico: il filo gira intorno a un blocco, il doppio clic lo fa a mano, Reinstrada lo riporta automatico (spec 0033)', async () => {
    // Un sensore proprio fra alimentatore (porta a sinistra in 100, 130) e centralina (porta a sinistra in 500, 130)
    const progetto = progettoCollegato() as { workspace: { nodes: unknown[] } };
    progetto.workspace.nodes.push({ id: 'node_s', type: 'sensore', label: 'Sensore', width: 160, height: 60, position: { x: 300, y: 100 }, internal_graph: { nodes: [], edges: [] } });
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progetto }, ultimo: 'sistema' });
    const dialoghi = registraDialoghi(pagina);
    type ConFili = { workspace: { edges: Array<{ id: string; waypoints: Array<{ x: number; y: number }> }> } };
    const file = path.join(cartella, 'progetti', 'sistema.json');
    const snodi = () => leggiJson<ConFili>(file).workspace.edges[0]?.waypoints;
    try {
        await pronta(pagina);
        const filo = pagina.locator('#edgesLayer path.edge-path').first();
        await expect(filo).toHaveClass(/filo-automatico/);
        const d = (await filo.getAttribute('d')) ?? '';
        const numeri = d.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number);
        const punti = numeri.reduce<Array<{ x: number; y: number }>>((acc, n, i) => (i % 2 ? acc : [...acc, { x: n, y: numeri[i + 1]! }]), []);
        expect(punti.length).toBeGreaterThan(2);
        // Nessun tratto passa dentro il sensore (300..460 × 100..160) e tutti sono orizzontali o verticali
        punti.slice(0, -1).forEach((a, i) => {
            const b = punti[i + 1]!;
            expect(a.x === b.x || a.y === b.y).toBe(true);
            const dentro = a.y === b.y
                ? a.y > 100 && a.y < 160 && Math.max(a.x, b.x) > 300 && Math.min(a.x, b.x) < 460
                : a.x > 300 && a.x < 460 && Math.max(a.y, b.y) > 100 && Math.min(a.y, b.y) < 160;
            expect(dentro).toBe(false);
        });
        // L'apertura non scrive nulla: il percorso automatico non si salva
        expect(snodi()).toEqual([]);

        // Doppio clic: il filo diventa a mano con gli angoli di adesso più il nuovo snodo
        await filo.dispatchEvent('dblclick');
        await expect.poll(() => snodi()?.length ?? 0).toBeGreaterThanOrEqual(punti.length - 2);
        await expect(pagina.locator('#edgesLayer path.edge-path').first()).toHaveClass(/filo-a-mano/);

        // Reinstrada dal dettaglio del filo
        await pagina.locator('#edgesLayer path.edge-path').first().dispatchEvent('click');
        const reinstradaFilo = pagina.locator('#btnReinstradaFilo');
        await expect(reinstradaFilo).toBeEnabled();
        await reinstradaFilo.click();
        await expect.poll(snodi).toEqual([]);
        await expect(reinstradaFilo).toBeDisabled();

        // Reinstrada del livello: senza fili a mano lo dice, con un filo a mano chiede conferma
        await pagina.locator('#btnReinstrada').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Nessun filo con punti messi a mano in questo livello.');
        await pagina.locator('#edgesLayer path.edge-path').first().dispatchEvent('dblclick');
        await expect.poll(() => snodi()?.length ?? 0).toBeGreaterThan(0);
        await pagina.locator('#btnReinstrada').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Togliere i punti messi a mano da 1 filo di questo livello?');
        await expect.poll(snodi).toEqual([]);
    } finally {
        await chiudi();
    }
});
