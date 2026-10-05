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
        await expect(pagina.locator('#reportModal')).toBeVisible();
        await expect(pagina.locator('#modalContent')).toContainText('Nome più chiaro');
        await expect(pagina.locator('#modalContent')).toContainText('1.0.1');
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
