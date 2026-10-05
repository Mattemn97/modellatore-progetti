/* --- E2E DEL PROGRAMMA INSTALLATO DAL SETUP (spec 0024): GIRA SOLO NEL JOB setup DELLA CI --- */
import { _electron, expect, test } from '@playwright/test';
import { ambienteElectron, preparaCopia, pronta } from './app';
import { LIBRERIA_PROVA } from './dati/libreria';

const eseguibile = process.env.MODELLATORE_ESEGUIBILE_INSTALLATO;

test.skip(!eseguibile, 'serve il percorso del programma installato (MODELLATORE_ESEGUIBILE_INSTALLATO)');

test('il programma installato parte con interfaccia, libreria e pannelli', async () => {
    const copia = preparaCopia({ libreria: LIBRERIA_PROVA });
    const app = await _electron.launch({ executablePath: eseguibile, args: [], env: ambienteElectron(copia) });
    try {
        const pagina = await app.firstWindow();
        await pronta(pagina);
        expect(pagina.url()).toBe('app://modellatore/index.html');
        await expect(pagina.locator('#libraryContent')).toContainText('Centralina');
        await expect(pagina.locator('.dv-tab[data-tab-panel-id="canvas"]')).toHaveCount(1);
    } finally {
        await app.close();
    }
});
