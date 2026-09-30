/* --- ESPORTAZIONE MULTIFILE E IMPORTAZIONE --- */

import { appState, pathStack } from './state.js';
import { initLibrary } from './builder.js';
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

export function importProjectJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        if (data.library && data.workspace) {
            appState.library = data.library;
            pathStack.length = 0;
            pathStack.push({ id: 'root', label: 'Progetto Intero (Root)', graph: data.workspace, parentNode: null });
            initLibrary();
            render();
        }
    };
    reader.readAsText(file);
}

export function importLibraryJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        appState.library = data.library || data;
        initLibrary();
    };
    reader.readAsText(file);
}