/* --- FINESTRA DI RICHIESTA DI UN TESTO (al posto di window.prompt) --- */
// La pagina resta ferma su ipcRenderer.sendSync finché qui non si imposta event.returnValue
import { BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { CANALI } from './canali.js';

const MAX_TESTO = 10_000;

function escape(testo: string): string {
    return testo.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function paginaRichiesta(messaggio: string, predefinito: string): string {
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Modellatore MBSE</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
body { font-family: "Segoe UI", sans-serif; font-size: 13px; margin: 0; padding: 16px; background: #fff; color: #2c3e50; }
label { display: block; margin-bottom: 8px; white-space: pre-wrap; }
input { width: 100%; box-sizing: border-box; padding: 6px; font-size: 13px; border: 1px solid #aaa; border-radius: 3px; }
.pulsanti { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
button { padding: 5px 16px; font-size: 13px; border-radius: 3px; border: 1px solid #aaa; background: #f4f6f8; cursor: pointer; }
#ok { background: #0078d4; color: #fff; border-color: #0078d4; }
</style></head><body>
<label for="testo">${escape(messaggio)}</label>
<input id="testo" value="${escape(predefinito)}" autofocus>
<div class="pulsanti"><button id="ok">OK</button><button id="annulla">Annulla</button></div>
<script>
const campo = document.getElementById('testo');
campo.select();
const rispondi = (v) => window.desktop.rispondiTesto(v);
document.getElementById('ok').onclick = () => rispondi(campo.value);
document.getElementById('annulla').onclick = () => rispondi(null);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') rispondi(campo.value);
    if (e.key === 'Escape') rispondi(null);
});
</script></body></html>`;
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

export function installaRichiestaTesto(cartellaOut: string): void {
    // Finestra di richiesta aperta (id dei suoi webContents) → risposta alla pagina che aspetta
    const inAttesa = new Map<number, (valore: string | null) => void>();

    ipcMain.on(CANALI.chiediTesto, (evento, dati: { messaggio?: unknown; predefinito?: unknown }) => {
        const genitore = BrowserWindow.fromWebContents(evento.sender);
        const messaggio = String(dati?.messaggio ?? '').slice(0, MAX_TESTO);
        const predefinito = String(dati?.predefinito ?? '').slice(0, MAX_TESTO);
        const finestra = new BrowserWindow({
            parent: genitore ?? undefined,
            modal: true,
            width: 460,
            height: 170,
            resizable: false,
            minimizable: false,
            maximizable: false,
            title: 'Modellatore MBSE',
            show: false,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(cartellaOut, 'preload', 'index.cjs'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });
        finestra.removeMenu();
        const id = finestra.webContents.id;
        let risposto = false;
        const rispondi = (valore: string | null) => {
            if (risposto) return;
            risposto = true;
            inAttesa.delete(id);
            evento.returnValue = valore;
            if (!finestra.isDestroyed()) finestra.close();
        };
        inAttesa.set(id, rispondi);
        finestra.webContents.on('will-navigate', (e) => e.preventDefault());
        finestra.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        // Chiusa con la X: come Annulla
        finestra.on('closed', () => rispondi(null));
        finestra.once('ready-to-show', () => finestra.show());
        void finestra.loadURL(paginaRichiesta(messaggio, predefinito));
    });

    ipcMain.on(CANALI.rispostaTesto, (evento, valore: unknown) => {
        // Solo una finestra di richiesta aperta da qui può rispondere
        inAttesa.get(evento.sender.id)?.(typeof valore === 'string' ? valore.slice(0, MAX_TESTO) : null);
    });
}
