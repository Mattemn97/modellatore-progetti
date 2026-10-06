/* --- E2E INTERFACCIA: DOCUMENTI AMMESSI PER CLASSE DEL REQUISITO (funzionalità 31, spec 0027) --- */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { apriApp, pronta, registraDialoghi } from '../app';
import { LIBRERIA_PROVA } from '../dati/libreria';

test('Ispettore: menu per classe, cambio di tipologia con avviso, salvataggio rifiutato e poi riuscito', async () => {
    const { pagina, cartella, chiudi } = await apriApp({ libreria: LIBRERIA_PROVA });
    const dialoghi = registraDialoghi(pagina);
    try {
        await pronta(pagina);
        await pagina.locator('#libraryContent').getByText('Centralina', { exact: true }).click();
        // cen_002 è di capacità con un testo SSS
        const documento = pagina.locator('select[data-idx="1"][data-campo="documento"]');
        await expect(documento.locator('option')).toHaveText(['Documento...', 'SSS', 'SSDD', 'SRS', 'SDD']);

        await pagina.locator('select[data-idx="1"][data-campo="tipologia"]').selectOption('Elettrica');
        await expect(documento.locator('option')).toHaveText(['Documento...', 'IRS', 'IDD', 'SSS (non ammesso)']);
        await expect(documento).toHaveValue('SSS');
        await expect(documento).toHaveClass(/documento-non-ammesso/);
        await expect(pagina.locator('.motivo-non-ammesso')).toHaveText('Documento non ammesso: un requisito di interfaccia va solo in IRS, IDD');

        const file = path.join(cartella, 'shared', 'libreria.json');
        const prima = fs.readFileSync(file, 'utf-8');
        await pagina.locator('#btnSaveBlockToLib').click();
        await expect.poll(() => dialoghi.at(-1)).toBe('Nel requisito "cen_002" il testo per SSS non è ammesso: un requisito di interfaccia va solo in IRS, IDD.');
        expect(fs.readFileSync(file, 'utf-8')).toBe(prima);

        await documento.selectOption('IRS');
        await expect(pagina.locator('.motivo-non-ammesso')).toHaveCount(0);
        await pagina.locator('#btnSaveBlockToLib').click();
        await expect.poll(() => dialoghi.at(-1)).toMatch(/^Blocco salvato\./);
    } finally {
        await chiudi();
    }
});

test('libreria con abbinamenti sbagliati: si apre, segno nell\'albero, elenco nei Documenti che apre il blocco', async () => {
    const libreria = JSON.parse(JSON.stringify(LIBRERIA_PROVA)) as typeof LIBRERIA_PROVA;
    libreria.alimentatore.requisiti[0]!.testiExport[0]!.documento = 'SSS';
    libreria.sensore.requisiti[0]!.testiExport[0]!.documento = 'XYZ';
    const { pagina, chiudi } = await apriApp({ libreria });
    registraDialoghi(pagina);
    try {
        await pronta(pagina);
        const albero = pagina.locator('#libraryContent');
        await expect(albero.locator('.lib-item-avviso')).toHaveCount(2);
        await expect(albero.locator('.lib-item', { hasText: 'Sensore' }).locator('.lib-item-avviso'))
            .toHaveAttribute('data-titolo-nativo', '1 testo su un documento non ammesso');

        await pagina.locator('#btnDocumenti').click();
        const elenco = pagina.locator('#elencoNonAmmessi');
        await expect(elenco).toBeVisible();
        await expect(elenco).not.toHaveAttribute('open');
        await expect(pagina.locator('#conteggioNonAmmessi')).toHaveText('2');
        await expect(pagina.locator('#documentiScelta option')).not.toContainText(['XYZ']);
        await elenco.locator('summary').click();
        const righe = pagina.locator('#righeNonAmmessi a');
        await expect(righe).toHaveText([
            'ali_001 · Alimentatore · SSS · un requisito di interfaccia va solo in IRS, IDD',
            'sen_001 · Sensore · XYZ · "XYZ" non è in documentiPerClasse di settings.json'
        ]);
        await righe.nth(1).click();
        await expect(pagina.locator('#edtBlockTitolo')).toHaveValue('Sensore');
        await expect(pagina.locator('select[data-campo="documento"]')).toHaveValue('XYZ');
    } finally {
        await chiudi();
    }
});
