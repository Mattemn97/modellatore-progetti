/* --- PRELOAD: PONTE TRA PAGINA E PROCESSO PRINCIPALE --- */
// I dati passano dal protocollo app:// (rotte /api); qui solo ciò che non è una richiesta di dati.
import { contextBridge, ipcRenderer } from 'electron';
import { CANALI } from '../main/canali';

contextBridge.exposeInMainWorld('desktop', {
    // Electron non ha window.prompt(): una finestra del programma, sincrona come prompt
    chiediTesto: (messaggio: string, predefinito: string): string | null =>
        ipcRenderer.sendSync(CANALI.chiediTesto, { messaggio: String(messaggio), predefinito: String(predefinito) }) as string | null,
    // Usato solo dalla finestra di richiesta del testo
    rispondiTesto: (valore: string | null): void => ipcRenderer.send(CANALI.rispostaTesto, valore === null ? null : String(valore))
});
