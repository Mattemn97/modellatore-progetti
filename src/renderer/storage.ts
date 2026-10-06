/* --- LETTURA DI FILE JSON SCELTI DALL'UTENTE E DOWNLOAD --- */

import { messaggioDi } from './utils.js';

export function downloadJsonFile(dataObj: unknown, filename: string): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataObj, null, 2));
    const a = document.createElement('a');
    a.href = dataStr; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
}

// Download di un testo lungo (es. la matrice in Markdown) o di byte (Word, PDF, PNG): un Blob al posto di un URL
// data:, che i browser troncano
export function scaricaFileTesto(testo: BlobPart, nomeFile: string, tipo: string): void {
    const url = URL.createObjectURL(new Blob([testo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url; a.download = nomeFile;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Legge un file JSON scelto dall'utente; gli errori di lettura diventano un messaggio
export function leggiFileJson(event: Event, onDati: (dati: unknown, file: File) => void): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            onDati(JSON.parse(String(reader.result)), file);
        } catch (err) {
            alert(`Impossibile caricare "${file.name}": ${messaggioDi(err)}`);
        }
        // Permette di ricaricare lo stesso file subito dopo
        input.value = '';
    };
    reader.readAsText(file);
}
