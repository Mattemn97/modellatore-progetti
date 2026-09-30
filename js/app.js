/* --- CONTROLLER PRINCIPALE E INIZIALIZZAZIONE --- */

import { loadSettings, pathStack, getCurrentLevel, appState, setActiveNodeId, appSettings } from './state.js';
import { render, cleanupEdgeDrawing, isDrawingEdge, resetView } from './renderer.js';
import { initLibrary, loadLibraryFromPath } from './builder.js';
import { renderNewBlockForm } from './inspector.js';
import { exportAllFormats, importProjectJson, importLibraryJson } from './storage.js';
import { CAPACITA, getTipologie } from './model.js';
import { escapeHtml, generaId } from './utils.js';

const svg = document.getElementById('workspaceSvg');
const canvasContainer = document.getElementById('canvasContainer');

export function renderUI() {
    const breadcrumb = document.getElementById('breadcrumb');
    const backBtn = document.getElementById('backBtn');
    if (!breadcrumb || !backBtn) return;

    breadcrumb.innerHTML = '';

    pathStack.forEach((level, index) => {
        const span = document.createElement('span');
        span.textContent = level.label;
        if (index === pathStack.length - 1) {
            span.className = 'active';
        } else {
            span.onclick = () => { 
                pathStack.splice(index + 1); 
                renderUI(); 
                render(); 
            };
        }
        breadcrumb.appendChild(span);

        if (index < pathStack.length - 1) {
            const sep = document.createElement('span');
            sep.textContent = ' / '; 
            sep.className = 'separator';
            breadcrumb.appendChild(sep);
        }
    });

    backBtn.style.display = pathStack.length > 1 ? 'block' : 'none';
    backBtn.onclick = () => { 
        pathStack.pop(); 
        renderUI(); 
        render(); 
    };
}

// Opzioni del filtro: tutti, capacità e ogni tipologia di interfaccia da settings.json
function popolaFiltroTipologia() {
    const select = document.getElementById('filterTypeSelect');
    if (!select) return;
    const voci = [['Tutti', 'Tutti i Requisiti'], [CAPACITA, 'Capacità'], ...getTipologie().map(t => [t, `Interfaccia: ${t}`])];
    select.innerHTML = voci.map(([valore, etichetta]) =>
        `<option value="${escapeHtml(valore)}">${escapeHtml(etichetta)}</option>`).join('');
    select.value = appState.activeTypeFilter;
}

async function initApp() {
    await loadSettings();
    popolaFiltroTipologia();

    // Imposta il path predefinito nel campo UI
    const libPathInput = document.getElementById('libPathInput');
    const defaultPath = appSettings.libraryPath || "shared/libreria.json";
    if (libPathInput) libPathInput.value = defaultPath;

    // Prova a caricare la libreria dal path di rete/locale
    const loadedFromPath = await loadLibraryFromPath(defaultPath);
    if (!loadedFromPath) {
        initLibrary(); // Fallback sui dati di default in state.js
    }

    renderUI();
    render();

    // Evento ricarica manuale da path
    document.getElementById('btnLoadFromPath')?.addEventListener('click', async () => {
        const path = document.getElementById('libPathInput').value.trim();
        const success = await loadLibraryFromPath(path);
        if (success) {
            alert(`Libreria ricaricata con successo da: ${path}`);
        } else {
            alert(`Impossibile caricare la libreria dal percorso specificato.`);
        }
    });

    document.getElementById('btnNewBlockFromScratch')?.addEventListener('click', renderNewBlockForm);
    document.getElementById('btnResetView')?.addEventListener('click', resetView);

    // Eventi Storage
    document.getElementById('btnExportAll')?.addEventListener('click', exportAllFormats);
    document.getElementById('btnImportLib')?.addEventListener('click', () => document.getElementById('importLibraryFile').click());
    document.getElementById('btnImportProj')?.addEventListener('click', () => document.getElementById('importProjectFile').click());
    document.getElementById('importLibraryFile')?.addEventListener('change', importLibraryJson);
    document.getElementById('importProjectFile')?.addEventListener('change', importProjectJson);

    document.getElementById('libSearchInput')?.addEventListener('input', (e) => {
        appState.librarySearchQuery = e.target.value;
        initLibrary();
    });

    document.getElementById('filterTypeSelect')?.addEventListener('change', (e) => {
        appState.activeTypeFilter = e.target.value;
        render();
    });

    document.getElementById('chkOmitUninvolved')?.addEventListener('change', (e) => {
        appState.omitUninvolved = e.target.checked;
        render();
    });

    document.getElementById('toggleLeftBtn')?.addEventListener('click', () => document.getElementById('libraryPanel').classList.toggle('collapsed'));
    document.getElementById('toggleRightBtn')?.addEventListener('click', () => document.getElementById('propertiesPanel').classList.toggle('collapsed'));

    canvasContainer?.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer?.addEventListener('drop', (e) => {
        e.preventDefault();
        const typeId = e.dataTransfer.getData('blockType');
        if (typeId && appState.library[typeId]) {
            const blockDef = appState.library[typeId];
            const rect = svg.getBoundingClientRect();
            const gridSize = appSettings.grid.size;

            const newNode = {
                id: generaId('node'),
                type: typeId,
                label: blockDef.titolo,
                width: appSettings.node.width,
                height: appSettings.node.height,
                position: {
                    x: Math.round((e.clientX - rect.left - 80) / gridSize) * gridSize,
                    y: Math.round((e.clientY - rect.top - 30) / gridSize) * gridSize
                },
                internal_graph: { nodes: [], edges: [] }
            };

            getCurrentLevel().graph.nodes.push(newNode);
            render();
        }
    });

    svg?.addEventListener('click', () => {
        setActiveNodeId(null);
        const propsContent = document.getElementById('propsContent');
        if (propsContent) propsContent.innerHTML = `<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>`;
        render();
    });

    svg?.addEventListener('mouseup', () => { if (isDrawingEdge) cleanupEdgeDrawing(); });
}

initApp();