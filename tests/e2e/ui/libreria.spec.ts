/* --- E2E INTERFACCIA: LIBRERIA (funzionalità 2 e 10, spec 0002 e 0010) --- */
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { apriApp, leggiJson, pronta, registraDialoghi, rispondiRichiesta } from '../app';
import { LIBRERIA_PROVA, progettoCollegato } from '../dati/libreria';

type Libreria = { versione: string; library: Record<string, { titolo: string }> };
type Progetto = { workspace: { nodes: Array<{ id: string; type: string }> } };

test('salvare un blocco dall\'ispettore aggiorna file, versione e changelog', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA });
    const dialoghi = registraDialoghi(pagina);
    try {
        await pronta(pagina);
        await expect(pagina.locator('#versioneLibreria')).toContainText('1.0.0');
        await pagina.locator('#libraryContent').getByText('Centralina', { exact: true }).click();
        await expect(pagina.locator('#edtBlockTitolo')).toHaveValue('Centralina');
        await pagina.locator('#edtBlockTitolo').fill('Centralina principale');
        await pagina.locator('#edtNotaModifica').fill('Nome più chiaro');
        await pagina.locator('#btnSaveBlockToLib').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Blocco salvato. Libreria v1.0.1 (patch).');
        const lib = leggiJson<Libreria>(path.join(cartella, 'shared', 'libreria.json'));
        expect(lib.versione).toBe('1.0.1');
        expect(lib.library.centralina?.titolo).toBe('Centralina principale');
        await expect(pagina.locator('#versioneLibreria')).toContainText('1.0.1');
        await expect(pagina.locator('#libraryContent')).toContainText('Centralina principale');

        await pagina.locator('#btnChangelog').click();
        await expect(pagina.locator('#pannelloChangelog')).toBeVisible();
        await expect(pagina.locator('#vociChangelog')).toContainText('Nome più chiaro');
        await expect(pagina.locator('#changelogTitolo')).toContainText('1.0.1');
    } finally {
        await chiudi();
    }
});

test('un blocco usato non si elimina; uno libero sì; la rinomina dell\'ID aggiorna le istanze', async () => {
    const { app, pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progettoCollegato() }, ultimo: 'sistema' });
    const dialoghi = registraDialoghi(pagina);
    try {
        await pronta(pagina);
        await pagina.locator('#libraryContent').getByText('Alimentatore', { exact: true }).click();
        await pagina.locator('#btnEliminaBloccoLib').click();
        await expect.poll(() => dialoghi.at(-1)).toContain('è usato in 1 istanze nel progetto e non si può eliminare');
        expect(leggiJson<Libreria>(path.join(cartella, 'shared', 'libreria.json')).library.alimentatore).toBeDefined();

        await pagina.locator('#libraryContent').getByText('Sensore', { exact: true }).click();
        await pagina.locator('#btnEliminaBloccoLib').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Blocco eliminato. Libreria v2.0.0 (major).');
        await expect(pagina.locator('#libraryContent')).not.toContainText('Sensore');

        await pagina.locator('#libraryContent').getByText('Centralina', { exact: true }).click();
        const domanda = await rispondiRichiesta(app, () => pagina.locator('#lnkRinominaBlocco').click(), 'centralina_x');
        expect(domanda).toBe('Nuovo ID del blocco');
        await expect.poll(() => dialoghi.at(-1)).toContain('ID rinominato: centralina → centralina_x. 1 istanze aggiornate. Libreria v3.0.0 (major).');
        await expect.poll(() => leggiJson<Progetto>(path.join(cartella, 'progetti', 'sistema.json')).workspace.nodes.find((n) => n.id === 'node_c')?.type).toBe('centralina_x');
    } finally {
        await chiudi();
    }
});

test('blocco matrioska: l\'interno di un\'istanza diventa l\'interno standard e le nuove istanze nascono con lui (spec 0034)', async () => {
    // La centralina ha dentro un alimentatore, con la derivazione cen_002 → ali_002
    const progetto = progettoCollegato() as { workspace: { nodes: Array<Record<string, unknown>> } };
    progetto.workspace.nodes[1]!.internal_graph = {
        nodes: [{ id: 'node_dentro', type: 'alimentatore', label: 'Alimentatore interno', width: 160, height: 60, position: { x: 300, y: 100 }, internal_graph: { nodes: [], edges: [] } }],
        edges: [{ id: 'edge_der', source: 'node_c', sourceHandle: 'cen_002', sourceType: 'parent', target: 'node_dentro', targetHandle: 'ali_002', targetType: 'node', waypoints: [] }],
        parentReqPositions: {}
    };
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progetto }, ultimo: 'sistema' });
    const dialoghi = registraDialoghi(pagina);
    type ConInterno = { versione: string; library: Record<string, { interno?: { nodes: Array<{ type: string }>; edges: unknown[] } }> };
    type Voci = { voci: Array<{ versione: string; modifiche: Array<{ blocco: string; campiBlocco: string[] }> }> };
    type Nodi = { workspace: { nodes: Array<{ id: string; type: string; internal_graph: { nodes: Array<{ type: string }>; edges: Array<{ source: string; sourceType: string }> } }> } };
    const fileLibreria = path.join(cartella, 'shared', 'libreria.json');
    try {
        await pronta(pagina);
        // Senza interno l'istanza dell'alimentatore non può salvarlo
        await pagina.locator('#nodesLayer > g').filter({ has: pagina.locator('text.node-text', { hasText: /^Alimentatore$/ }) }).locator('rect.node-rect').click({ position: { x: 120, y: 10 } });
        await expect(pagina.locator('#btnSalvaInterno')).toBeDisabled();

        await pagina.locator('#nodesLayer > g', { hasText: 'Centralina' }).locator('rect.node-rect').click({ position: { x: 120, y: 10 } });
        await pagina.locator('#btnSalvaInterno').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Interno standard salvato. Libreria v1.0.1 (patch).');
        expect(dialoghi.at(-2)).toContain('(1 blocco, 1 filo)');
        const lib = leggiJson<ConInterno>(fileLibreria);
        expect(lib.library.centralina?.interno?.nodes.map((n) => n.type)).toEqual(['alimentatore']);
        const changelog = leggiJson<Voci>(path.join(cartella, 'shared', 'libreria.changelog.json'));
        expect(changelog.voci.at(-1)?.modifiche[0]).toMatchObject({ blocco: 'centralina', campiBlocco: ['interno'] });
        await expect(pagina.locator('#infoInterno')).toHaveText('Interno standard in libreria: 1 blocco, 1 filo');
        await expect(pagina.locator('#libraryContent .lib-item', { hasText: 'Centralina' }).locator('.lib-item-interno')).toHaveCount(1);

        // Una modifica normale del blocco dall'Ispettore conserva l'interno
        await pagina.locator('#edtBlockDescrizione').fill('Controlla il sistema e la pompa');
        await pagina.locator('#btnSaveBlockToLib').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Blocco salvato. Libreria v1.0.2 (patch).');
        expect(leggiJson<ConInterno>(fileLibreria).library.centralina?.interno?.nodes).toHaveLength(1);

        // Una nuova centralina trascinata dalla libreria nasce con l'alimentatore dentro e la derivazione verso di lei
        await pagina.dragAndDrop('#libraryContent >> text=Centralina', '#workspaceSvg', { targetPosition: { x: 300, y: 400 } });
        const file = path.join(cartella, 'progetti', 'sistema.json');
        const nuova = () => leggiJson<Nodi>(file).workspace.nodes.find((n) => n.type === 'centralina' && n.id !== 'node_c');
        await expect.poll(() => nuova()?.internal_graph.nodes.map((n) => n.type)).toEqual(['alimentatore']);
        expect(nuova()?.internal_graph.edges[0]).toMatchObject({ source: nuova()?.id, sourceType: 'parent' });
        // La centralina che c'era già non cambia
        expect(leggiJson<Nodi>(file).workspace.nodes.find((n) => n.id === 'node_c')?.internal_graph.edges[0]).toMatchObject({ source: 'node_c' });

        // Togli l'interno: la libreria torna senza
        await pagina.locator('#btnTogliInterno').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Interno standard tolto. Libreria v1.0.3 (patch).');
        expect(leggiJson<ConInterno>(fileLibreria).library.centralina).not.toHaveProperty('interno');
    } finally {
        await chiudi();
    }
});

test('un blocco che contiene se stesso non si salva come interno standard (spec 0034)', async () => {
    const progetto = progettoCollegato() as { workspace: { nodes: Array<Record<string, unknown>> } };
    progetto.workspace.nodes[0]!.internal_graph = {
        nodes: [{ id: 'node_x', type: 'alimentatore', label: 'Di nuovo alimentatore', width: 160, height: 60, position: { x: 300, y: 100 }, internal_graph: { nodes: [], edges: [] } }],
        edges: []
    };
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA, progetti: { sistema: progetto }, ultimo: 'sistema' });
    const dialoghi = registraDialoghi(pagina);
    try {
        await pronta(pagina);
        await pagina.locator('#nodesLayer > g').filter({ has: pagina.locator('text.node-text', { hasText: /^Alimentatore$/ }) }).locator('rect.node-rect').click({ position: { x: 120, y: 10 } });
        await pagina.locator('#btnSalvaInterno').click();
        await expect.poll(() => dialoghi.at(-1)).toContain('Un blocco non può contenere se stesso');
        expect(leggiJson<{ versione: string }>(path.join(cartella, 'shared', 'libreria.json')).versione).toBe('1.0.0');
    } finally {
        await chiudi();
    }
});
