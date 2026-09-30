/* --- GESTIONE LIBRERIA GERARCHICA E CARICAMENTO DA PATH --- */

import { appState } from './state.js';
import { render } from './renderer.js';

export async function loadLibraryFromPath(path) {
    if (!path) return false;
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        
        const data = await response.json();
        const targetLibrary = data.library || data;

        if (targetLibrary && typeof targetLibrary === 'object') {
            appState.library = targetLibrary;
            initLibrary();
            render();
            return true;
        }
    } catch (err) {
        console.warn(`Impossibile caricare la libreria da path '${path}':`, err);
    }
    return false;
}

export function initLibrary() {
    const libraryContent = document.getElementById('libraryContent');
    if (!libraryContent) return;
    
    const query = appState.librarySearchQuery.toLowerCase();
    libraryContent.innerHTML = '';

    const categories = {};

    Object.entries(appState.library).forEach(([typeId, blockDef]) => {
        if (query && !blockDef.name.toLowerCase().includes(query) && !typeId.toLowerCase().includes(query)) {
            return;
        }

        const cat = blockDef.category || "Generali";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({ typeId, blockDef });
    });

    Object.entries(categories).forEach(([catName, items]) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'tree-category';
        catDiv.textContent = `📁 ${catName}`;
        libraryContent.appendChild(catDiv);

        const treeGroup = document.createElement('div');
        treeGroup.className = 'tree-node';

        items.forEach(({ typeId, blockDef }) => {
            const div = document.createElement('div');
            div.className = 'lib-item';
            div.draggable = true;
            div.innerHTML = `<span>${blockDef.name}</span>`;
            
            div.addEventListener('dragstart', (e) => e.dataTransfer.setData('blockType', typeId));
            treeGroup.appendChild(div);
        });

        libraryContent.appendChild(treeGroup);
    });
}