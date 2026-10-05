/* --- AVVIO DELL'APP PER I TEST END TO END (copia isolata) --- */
// Ogni test lavora su una copia dell'app in una cartella temporanea: mai sui progetti e le librerie veri
import { _electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RADICE = path.resolve(__dirname, '..', '..');
const FILE_APP = ['package.json', 'out', 'index.html', 'style.css', 'settings.json', 'js'];

type Oggetto = Record<string, unknown>;

export interface Copia {
    cartella: string;
    datiUtente: string;
}

export interface OpzioniCopia {
    // Mappa dei blocchi: diventa shared/libreria.json in formato 1, versione 1.0.0
    libreria?: Oggetto;
    // File di progetti/ per slug (il contenuto completo del file)
    progetti?: Record<string, Oggetto>;
    // Progetto da riaprire all'avvio (progetti/_ultimo.json)
    ultimo?: string;
    // Fuse dentro settings.json della copia (un livello di profondità)
    impostazioni?: Oggetto;
}

export interface AppDiProva extends Copia {
    app: ElectronApplication;
    pagina: Page;
    chiudi: () => Promise<void>;
}

export function eseguibileElectron(): string {
    return path.join(RADICE, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
}

function scriviJson(file: string, dati: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(dati, null, 2), 'utf-8');
}

export function preparaCopia(opzioni: OpzioniCopia = {}): Copia {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'modellatore-e2e-'));
    const cartella = path.join(base, 'app');
    for (const voce of FILE_APP) fs.cpSync(path.join(RADICE, voce), path.join(cartella, voce), { recursive: true });
    fs.mkdirSync(path.join(cartella, 'progetti'), { recursive: true });
    fs.mkdirSync(path.join(cartella, 'shared'), { recursive: true });

    // Salvataggio rapido: i test non aspettano il secondo di debounce
    const fileImpostazioni = path.join(cartella, 'settings.json');
    const impostazioni = JSON.parse(fs.readFileSync(fileImpostazioni, 'utf-8')) as Oggetto;
    const extra: Oggetto = { progetti: { debounceMs: 150 }, ...opzioni.impostazioni };
    for (const [chiave, valore] of Object.entries(extra)) {
        const attuale = impostazioni[chiave];
        impostazioni[chiave] = attuale && typeof attuale === 'object' && valore && typeof valore === 'object' && !Array.isArray(valore)
            ? { ...(attuale as Oggetto), ...(valore as Oggetto) }
            : valore;
    }
    scriviJson(fileImpostazioni, impostazioni);

    if (opzioni.libreria) {
        scriviJson(path.join(cartella, 'shared', 'libreria.json'), { formatVersion: 1, versione: '1.0.0', library: opzioni.libreria });
    }
    for (const [slug, progetto] of Object.entries(opzioni.progetti ?? {})) {
        scriviJson(path.join(cartella, 'progetti', `${slug}.json`), progetto);
    }
    if (opzioni.ultimo) scriviJson(path.join(cartella, 'progetti', '_ultimo.json'), { progetto: opzioni.ultimo });
    return { cartella, datiUtente: path.join(base, 'dati-utente') };
}

export function ambienteElectron(datiUtente: string, extra: Record<string, string> = {}): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
    // Il terminale di VS Code lo imposta e farebbe partire Electron come semplice Node
    delete env.ELECTRON_RUN_AS_NODE;
    return { ...env, MODELLATORE_DATI_UTENTE: datiUtente, ...extra };
}

export async function apriApp(opzioni: OpzioniCopia & { env?: Record<string, string>; copia?: Copia } = {}): Promise<AppDiProva> {
    const copia = opzioni.copia ?? preparaCopia(opzioni);
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
            // Una modifica ancora in volo farebbe partire il beforeunload: destroy() lo salta, nei test si chiude e basta
            await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) w.destroy(); }).catch(() => {});
            await app.close().catch(() => {});
            // Solo la cartella creata da preparaCopia (mkdtemp), mai altro
            const base = path.dirname(copia.cartella);
            if (path.basename(base).startsWith('modellatore-e2e-')) {
                fs.rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
            }
        }
    };
}

// Aspetta che l'editor sia pronto (badge del progetto) e chiude il tour del primo avvio
export async function pronta(pagina: Page): Promise<void> {
    await expect(pagina.locator('text=Salvato').first()).toBeVisible({ timeout: 20_000 });
    await chiudiTour(pagina);
}

export async function chiudiTour(pagina: Page): Promise<void> {
    const salta = pagina.getByText('Salta il tour');
    if (await salta.isVisible().catch(() => false)) await salta.click();
}

export function leggiJson<T = Oggetto>(file: string): T {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

// Accetta alert e confirm (OK) e ne raccoglie i testi, nell'ordine
export function registraDialoghi(pagina: Page, risposta: (messaggio: string) => boolean = () => true): string[] {
    const messaggi: string[] = [];
    pagina.on('dialog', (d) => {
        messaggi.push(d.message());
        // Durante la chiusura il dialogo può sparire con la pagina
        void (risposta(d.message()) ? d.accept() : d.dismiss()).catch(() => {});
    });
    return messaggi;
}

// Risponde alla finestra di richiesta di un testo aperta da `azione` (chiediTesto, al posto di prompt)
export async function rispondiRichiesta(app: ElectronApplication, azione: () => Promise<unknown>, testo: string | null): Promise<string> {
    const finestra = app.waitForEvent('window');
    const fatto = azione();
    const richiesta = await finestra;
    await expect(richiesta.locator('#testo')).toBeVisible();
    const domanda = (await richiesta.locator('label').textContent()) ?? '';
    if (testo === null) {
        await richiesta.locator('#annulla').click().catch(() => {});
    } else {
        await richiesta.locator('#testo').fill(testo);
        await richiesta.locator('#ok').click().catch(() => {});
    }
    await fatto;
    return domanda;
}

// I download vanno in `cartella` senza la finestra Salva con nome; restituisce i nomi dei file scaricati
export async function intercettaDownload(app: ElectronApplication, cartella: string): Promise<() => Promise<string[]>> {
    await app.evaluate(({ session }, dest) => {
        const g = globalThis as unknown as { __scaricati: string[] };
        g.__scaricati = [];
        session.defaultSession.on('will-download', (_e, item) => {
            g.__scaricati.push(item.getFilename());
            item.setSavePath(`${dest}/${item.getFilename()}`);
        });
    }, cartella);
    return () => app.evaluate(() => (globalThis as unknown as { __scaricati: string[] }).__scaricati);
}
