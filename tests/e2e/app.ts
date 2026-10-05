/* --- AVVIO DELL'APP PER I TEST END TO END (copia isolata) --- */
// Ogni test lavora su una copia dell'app in una cartella temporanea: mai sui progetti e le librerie veri
import { _electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RADICE = path.resolve(__dirname, '..', '..');
const FILE_APP = ['package.json', 'out', 'index.html', 'style.css', 'settings.json', 'js', 'start.py'];

export interface Copia {
    cartella: string;
    datiUtente: string;
}

export interface AppDiProva extends Copia {
    app: ElectronApplication;
    pagina: Page;
    chiudi: () => Promise<void>;
}

export function eseguibileElectron(): string {
    return path.join(RADICE, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
}

export function preparaCopia(): Copia {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'modellatore-e2e-'));
    const cartella = path.join(base, 'app');
    for (const voce of FILE_APP) fs.cpSync(path.join(RADICE, voce), path.join(cartella, voce), { recursive: true });
    fs.mkdirSync(path.join(cartella, 'progetti'), { recursive: true });
    fs.mkdirSync(path.join(cartella, 'shared'), { recursive: true });
    return { cartella, datiUtente: path.join(base, 'dati-utente') };
}

export function ambienteElectron(datiUtente: string, extra: Record<string, string> = {}): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
    // Il terminale di VS Code lo imposta e farebbe partire Electron come semplice Node
    delete env.ELECTRON_RUN_AS_NODE;
    return { ...env, MODELLATORE_DATI_UTENTE: datiUtente, ...extra };
}

export async function apriApp(opzioni: { env?: Record<string, string>; copia?: Copia } = {}): Promise<AppDiProva> {
    const copia = opzioni.copia ?? preparaCopia();
    const app = await _electron.launch({
        executablePath: eseguibileElectron(),
        args: [copia.cartella],
        env: ambienteElectron(copia.datiUtente, opzioni.env)
    });
    const pagina = await app.firstWindow();
    await pagina.waitForLoadState('domcontentloaded');
    return {
        ...copia,
        app,
        pagina,
        chiudi: async () => {
            await app.close().catch(() => {});
            // Solo la cartella creata da preparaCopia (mkdtemp), mai altro
            const base = path.dirname(copia.cartella);
            if (path.basename(base).startsWith('modellatore-e2e-')) {
                fs.rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
            }
        }
    };
}

// Chiude il tour del primo avvio se è aperto
export async function chiudiTour(pagina: Page): Promise<void> {
    const salta = pagina.getByText('Salta il tour');
    if (await salta.isVisible().catch(() => false)) await salta.click();
}
