/* --- PRELOAD: PONTE TRA PAGINA E PROCESSO PRINCIPALE --- */
// I dati passano dal protocollo app:// (rotte /api); qui solo ciò che non è una richiesta di dati.
import { contextBridge, ipcRenderer } from 'electron';
import { CANALI } from '../main/canali';

contextBridge.exposeInMainWorld('desktop', {
    // Electron non ha window.prompt(): una finestra del programma, sincrona come prompt
    chiediTesto: (messaggio: string, predefinito: string): string | null =>
        ipcRenderer.sendSync(CANALI.chiediTesto, { messaggio: String(messaggio), predefinito: String(predefinito) }) as string | null,
    // Usato solo dalla finestra di richiesta del testo
    rispondiTesto: (valore: string | null): void => ipcRenderer.send(CANALI.rispostaTesto, valore === null ? null : String(valore)),
    // Cartella di lavoro e cartella delle librerie (spec 0019)
    cartelle: {
        stato: () => ipcRenderer.invoke(CANALI.cartelleStato),
        scegli: (titolo: string, iniziale: string) => ipcRenderer.invoke(CANALI.cartelleScegli, String(titolo), String(iniziale ?? '')),
        applica: (cartelle: { lavoro: string; librerie: string | null }, crea: boolean) =>
            ipcRenderer.invoke(CANALI.cartelleApplica, { lavoro: String(cartelle?.lavoro ?? ''), librerie: cartelle?.librerie ? String(cartelle.librerie) : null }, crea === true),
        apri: (percorso: string) => ipcRenderer.invoke(CANALI.apriPercorso, String(percorso)),
        // Import dei dati di una installazione 1.x (voce 22)
        analizzaV1: (cartella: string) => ipcRenderer.invoke(CANALI.importaV1Analizza, String(cartella)),
        importaV1: (cartella: string, sovrascrivi: boolean) => ipcRenderer.invoke(CANALI.importaV1Esegui, String(cartella), sovrascrivi === true)
    }
});
