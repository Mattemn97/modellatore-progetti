/* --- ESPORTAZIONE MULTIFILE E IMPORTAZIONE --- */

import { appState, pathStack, setActiveNodeId } from './state.js';
import { impostaLibreria } from './builder.js';
import { render } from './renderer.js';

function downloadJsonFile(dataObj, filename) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj, null, 2));
    const a = document.createElement('a');
    a.href = dataStr; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
}

export function exportAllFormats() {
    downloadJsonFile({ workspace: pathStack[0].graph }, "modello.json");
    setTimeout(() => downloadJsonFile({ library: appState.library }, "libreria.json"), 300);
    setTimeout(() => downloadJsonFile({ library: appState.library, workspace: pathStack[0].graph }, "standalone.json"), 600);
}

// Legge un file JSON scelto dall'utente; gli errori di lettura diventano un messaggio
function leggiFileJson(event, onDati) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            onDati(JSON.parse(e.target.result));
        } catch (err) {
            alert(`Impossibile caricare "${file.name}": ${err.message}`);
        }
        // Permette di ricaricare lo stesso file subito dopo
        event.target.value = '';
    };
    reader.readAsText(file);
}

export function importProjectJson(event) {
    leggiFileJson(event, (data) => {
        if (!data.library || !data.workspace) {
            throw new Error('un progetto standalone deve contenere sia "library" sia "workspace".');
        }
        impostaLibreria(data.library);
        pathStack.length = 0;
        pathStack.push({ id: 'root', label: 'Progetto Intero (Root)', graph: data.workspace, parentNode: null });
        setActiveNodeId(null);
        render();
    });
}

export function importLibraryJson(event) {
    leggiFileJson(event, (data) => {
        impostaLibreria(data);
        render();
    });
}
