/* --- GESTIONE LIBRERIA GERARCHICA E CARICAMENTO DA PATH --- */

import { appState } from './state.js';
import { render } from './renderer.js';
import { openLibraryBlock } from './inspector.js';
import { normalizzaLibreria, trovaIdRequisitiDuplicati } from './model.js';
import { escapeHtml } from './utils.js';
import { apriLibreria } from './libreria.js';
import { riallineaFiltri } from './filtri.js';

// Sostituisce la libreria corrente convertendola al formato attuale; segnala gli id requisito duplicati
export function impostaLibreria(dati) {
    appState.library = normalizzaLibreria(dati);
    const duplicati = trovaIdRequisitiDuplicati(appState.library);
    if (duplicati.length > 0) {
        alert(`Attenzione: alcuni ID requisito sono usati da più blocchi e vanno resi univoci:\n${duplicati.join('\n')}`);
    }
    initLibrary();
}

// Passa per l'API delle librerie (js/libreria.js); restituisce { ok, messaggio }
export async function loadLibraryFromPath(path) {
    const esito = await apriLibreria(path);
    if (esito.ok) render();
    else console.warn(`Impossibile caricare la libreria da path '${path}': ${esito.messaggio}`);
    return esito;
}

function corrispondeRicerca(typeId, blockDef, query) {
    if (!query) return true;
    return [typeId, blockDef.titolo, blockDef.descrizione, blockDef.categoria, blockDef.sottocategoria]
        .some(v => (v || '').toLowerCase().includes(query));
}

export function initLibrary() {
    const libraryContent = document.getElementById('libraryContent');
    if (!libraryContent) return;

    const query = appState.librarySearchQuery.toLowerCase();
    libraryContent.innerHTML = '';

    // categoria → sottocategoria → blocchi
    const albero = {};
    Object.entries(appState.library).forEach(([typeId, blockDef]) => {
        if (!corrispondeRicerca(typeId, blockDef, query)) return;
        const cat = blockDef.categoria || "Generali";
        const sub = blockDef.sottocategoria || "";
        albero[cat] ??= {};
        albero[cat][sub] ??= [];
        albero[cat][sub].push({ typeId, blockDef });
    });

    const ordina = (a, b) => a.localeCompare(b, 'it');

    Object.keys(albero).sort(ordina).forEach(catName => {
        const catDiv = document.createElement('div');
        catDiv.className = 'tree-category';
        catDiv.textContent = `📁 ${catName}`;
        libraryContent.appendChild(catDiv);

        const catGroup = document.createElement('div');
        catGroup.className = 'tree-node';

        Object.keys(albero[catName]).sort(ordina).forEach(subName => {
            let destinazione = catGroup;
            if (subName) {
                const subDiv = document.createElement('div');
                subDiv.className = 'tree-subcategory';
                subDiv.textContent = `📂 ${subName}`;
                catGroup.appendChild(subDiv);

                destinazione = document.createElement('div');
                destinazione.className = 'tree-node';
                catGroup.appendChild(destinazione);
            }

            albero[catName][subName]
                .sort((a, b) => ordina(a.blockDef.titolo, b.blockDef.titolo))
                .forEach(({ typeId, blockDef }) => {
                    const div = document.createElement('div');
                    div.className = 'lib-item';
                    div.draggable = true;
                    div.title = blockDef.descrizione || blockDef.titolo;
                    div.innerHTML = `<span>${escapeHtml(blockDef.titolo)}</span><span class="lib-item-count">${blockDef.requisiti.length}</span>`;

                    div.addEventListener('dragstart', (e) => e.dataTransfer.setData('blockType', typeId));
                    div.addEventListener('click', () => openLibraryBlock(typeId));
                    destinazione.appendChild(div);
                });
        });

        libraryContent.appendChild(catGroup);
    });

    // Le voci dei filtri seguono la libreria: una scelta sparita si toglie (spec 0008, AC-9)
    riallineaFiltri();
}
