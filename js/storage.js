/* --- LETTURA DI FILE JSON SCELTI DALL'UTENTE E DOWNLOAD --- */

export function downloadJsonFile(dataObj, filename) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj, null, 2));
    const a = document.createElement('a');
    a.href = dataStr; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
}

// Download di un testo lungo (es. la matrice in Markdown): un Blob al posto di un URL data:, che i browser troncano
export function scaricaFileTesto(testo, nomeFile, tipo) {
    const url = URL.createObjectURL(new Blob([testo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url; a.download = nomeFile;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Legge un file JSON scelto dall'utente; gli errori di lettura diventano un messaggio
export function leggiFileJson(event, onDati) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            onDati(JSON.parse(e.target.result), file);
        } catch (err) {
            alert(`Impossibile caricare "${file.name}": ${err.message}`);
        }
        // Permette di ricaricare lo stesso file subito dopo
        event.target.value = '';
    };
    reader.readAsText(file);
}
