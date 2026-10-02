/* --- CONTROLLER PRINCIPALE E INIZIALIZZAZIONE --- */

import { loadSettings, pathStack, getCurrentLevel, appState, setActiveNodeId, appSettings } from './state.js';
import { render, cleanupEdgeDrawing, isDrawingEdge, resetView, getCanvasCoords, evidenziaCliente } from './renderer.js';
import { initLibrary, loadLibraryFromPath } from './builder.js';
import { renderNewBlockForm } from './inspector.js';
import { avviaProgetti, aggiornaPercorsoLibreria } from './progetto.js';
import { mostraChangelog } from './libreria.js';
import { initSchedaCliente, posizionaRequisitoCliente, impostaSelezioneCliente } from './cliente.js';
import { initCoerenza } from './coerenza.js';
import { initGerarchia } from './gerarchia.js';
import { initMatrice } from './matrice.js';
import { initDocumenti } from './documenti.js';
import { initFiltri } from './filtri.js';
import { generaId } from './utils.js';

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

async function initApp() {
    await loadSettings();
    initFiltri();
    initSchedaCliente();
    initCoerenza();
    initGerarchia();
    initMatrice();
    initDocumenti();

    // Evento ricarica manuale da path: richiama sempre l'API, anche con lo stesso percorso (riallinea impronta e versione).
    // Se riesce, diventa la libreria del progetto; se fallisce restano libreria e stato precedenti
    document.getElementById('btnLoadFromPath')?.addEventListener('click', async () => {
        const path = document.getElementById('libPathInput').value.trim();
        const esito = await loadLibraryFromPath(path);
        if (esito.ok) {
            aggiornaPercorsoLibreria(path);
            alert(`Libreria ricaricata con successo da: ${path}`);
        } else {
            alert(`Impossibile caricare la libreria: ${esito.messaggio}`);
        }
    });

    document.getElementById('btnChangelog')?.addEventListener('click', () => mostraChangelog());

    document.getElementById('btnNewBlockFromScratch')?.addEventListener('click', renderNewBlockForm);
    document.getElementById('btnResetView')?.addEventListener('click', resetView);

    document.getElementById('libSearchInput')?.addEventListener('input', (e) => {
        appState.librarySearchQuery = e.target.value;
        initLibrary();
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
            return;
        }
        // Una riga della scheda Cliente: diventa un blocco tondo della radice, centrato sul punto di griglia più vicino
        const idCliente = e.dataTransfer.getData('requisitoCliente');
        if (idCliente) posizionaRequisitoCliente(idCliente, getCanvasCoords(e));
    });

    svg?.addEventListener('click', () => {
        setActiveNodeId(null);
        impostaSelezioneCliente(null);
        evidenziaCliente(null);
        const propsContent = document.getElementById('propsContent');
        if (propsContent) propsContent.innerHTML = `<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>`;
        render();
    });

    svg?.addEventListener('mouseup', () => { if (isDrawingEdge) cleanupEdgeDrawing(); });

    // Apre l'ultimo progetto (o lo crea) e ne carica la libreria; da qui parte il salvataggio automatico
    await avviaProgetti();
}

initApp();