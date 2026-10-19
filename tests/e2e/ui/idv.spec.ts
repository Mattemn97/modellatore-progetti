/* --- E2E INTERFACCIA IDV: SEZIONI E TABELLE, PORTE PROPAGATE DEI MATRIOSKA (spec 0035) --- */
import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { apriApp, leggiJson, pronta, registraDialoghi } from '../app';
import { LIBRERIA_PROVA, progettoCollegato } from '../dati/libreria';

type Filo = { source: string; sourceHandle: string; target: string; targetHandle: string; targetPercorso?: string[]; sourcePercorso?: string[] };
type Progetto = { workspace: { edges: Filo[]; nodes: Array<{ id: string; internal_graph: { edges: Filo[] } }> } };

const nodo = (id: string, type: string, label: string, x: number, y: number, interno: unknown[] = []) =>
    ({ id, type, label, width: 160, height: 60, position: { x, y }, internal_graph: { nodes: interno, edges: [] } });

// Trascina da un pin a un altro con il mouse vero (premi, muovi, rilascia)
async function collega(pagina: Page, da: Locator, a: Locator): Promise<void> {
    const p1 = await da.boundingBox();
    const p2 = await a.boundingBox();
    if (!p1 || !p2) throw new Error('pin senza dimensioni');
    await pagina.mouse.move(p1.x + p1.width / 2, p1.y + p1.height / 2);
    await pagina.mouse.down();
    await pagina.mouse.move(p2.x + p2.width / 2, p2.y + p2.height / 2, { steps: 8 });
    await pagina.mouse.up();
}

test('sezioni della testata: aprono le tabelle come pannelli, una riga porta al blocco o al filo', async () => {
    const { pagina, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoCollegato() }, ultimo: 'sistema' });
    try {
        await pronta(pagina);
        await expect(pagina.locator('#nomeProgettoTestata')).toHaveText('Sistema di prova');
        await expect(pagina.locator('#navSezioni [data-conta="componenti"]')).toHaveText('2');
        await expect(pagina.locator('#navSezioni [data-conta="interfacce"]')).toHaveText('1');

        await pagina.locator('#navSezioni [data-sezione="componenti"]').click();
        await expect(pagina.locator('.dv-tab[data-tab-panel-id="componenti"]')).toBeVisible();
        await expect(pagina.locator('#navSezioni [data-sezione="componenti"]')).toHaveClass(/active/);
        const righe = pagina.locator('#tabellaComponenti tbody tr');
        await expect(righe).toHaveCount(2);
        await righe.filter({ hasText: 'Centralina' }).click();
        await expect(pagina.locator('#edtBlockId')).toHaveValue('centralina');
        await expect(pagina.locator('#nodesLayer g.blocco-idv.selezionato')).toHaveCount(1);

        await pagina.locator('#navSezioni [data-sezione="interfacce"]').click();
        const filo = pagina.locator('#tabellaInterfacce tbody tr');
        await expect(filo).toHaveCount(1);
        await expect(filo).toContainText('ali_001');
        await expect(filo).toContainText('OK');
        await filo.click();
        await expect(pagina.locator('#propsContent')).toContainText('Collegamento');
        await expect(pagina.locator('#edgesLayer path.filo-selezionato')).toHaveCount(1);

        await pagina.locator('#navSezioni [data-sezione="dashboard"]').click();
        await expect(pagina.locator('#contenutoDashboard')).toContainText('Istanze nel progetto');
        await expect(pagina.locator('#contenutoDashboard .tile', { hasText: 'Fili' })).toContainText('1');

        // Etichette dei fili: si spengono e si riaccendono dalla barra
        await expect(pagina.locator('#labelsLayer .lbl')).toHaveCount(1);
        await pagina.locator('#btnMostraEtichette').click();
        await expect(pagina.locator('#labelsLayer .lbl')).toHaveCount(0);
        await pagina.locator('#btnMostraEtichette').click();
        await expect(pagina.locator('#labelsLayer .lbl')).toHaveCount(1);
    } finally {
        await chiudi();
    }
});

test('porta propagata: l\'interfaccia libera di un blocco interno sale sul bordo e si collega alla radice (spec 0035)', async () => {
    // Centralina con un alimentatore dentro, senza fili: la sua uscita Elettrica sale sul bordo della centralina
    const progetto = {
        formatVersion: 2, nome: 'Matrioska', libraryPath: 'shared/libreria.json',
        workspace: {
            nodes: [nodo('node_a', 'alimentatore', 'Alimentatore', 100, 100), nodo('node_c', 'centralina', 'Centralina', 600, 100, [nodo('node_in', 'alimentatore', 'Alim. interno', 400, 200)])],
            edges: []
        }
    };
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { m: progetto }, ultimo: 'm' });
    const dialoghi = registraDialoghi(pagina);
    const file = path.join(cartella, 'progetti', 'm.json');
    try {
        await pronta(pagina);
        const propagata = pagina.locator('#nodesLayer g.pin[data-nodo="node_c"][data-porta="node_in:ali_001"]');
        await expect(propagata).toHaveCount(1);
        await expect(pagina.locator('#nodesLayer')).toContainText('PORTE DAI BLOCCHI INTERNI');

        await collega(pagina, pagina.locator('#nodesLayer g.pin[data-nodo="node_a"][data-porta="ali_001"] rect.node-req-pin'), propagata.locator('rect.node-req-pin'));
        await expect.poll(() => leggiJson<Progetto>(file).workspace.edges).toEqual([
            expect.objectContaining({ source: 'node_a', sourceHandle: 'ali_001', target: 'node_c', targetHandle: 'ali_001', targetPercorso: ['node_in'] })
        ]);
        await expect(propagata.locator('rect.on-if')).toHaveCount(1);

        // Dentro la centralina la porta dell'alimentatore risulta collegata sopra
        await pagina.locator('#nodesLayer > g', { hasText: 'Centralina' }).locator('rect.node-rect').dispatchEvent('dblclick');
        await expect(pagina.locator('#breadcrumb')).toContainText('Centralina');
        const interna = pagina.locator('#nodesLayer g.pin[data-nodo="node_in"][data-porta="ali_001"] rect.collegata-sopra');
        await expect(interna).toHaveCount(1);

        // Collegarla anche dentro (al blocco tondo cen_001): l'app avvisa, e il filo della radice va riparato
        await collega(pagina, interna, pagina.locator('#parentLayer g.pin[data-porta="cen_001"] .node-req-pin'));
        await expect.poll(() => dialoghi.find((d) => d.includes('è già collegata a un livello superiore')) ?? '').not.toBe('');
        await expect.poll(() => leggiJson<Progetto>(file).workspace.nodes.find((n) => n.id === 'node_c')?.internal_graph.edges.length).toBe(1);
        await pagina.locator('#backBtn').click();
        await expect(pagina.locator('#nodesLayer g.pin[data-nodo="node_c"][data-porta="node_in:ali_001"]')).toHaveCount(0);
        await pagina.locator('#btnDRC').click();
        await pagina.locator('#coerenzaGruppi .gruppo-coerenza-testa', { hasText: 'Da riparare' }).click();
        await expect(pagina.locator('#coerenzaGruppi')).toContainText('già collegata dentro');
    } finally {
        await chiudi();
    }
});
