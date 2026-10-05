/* --- CONTROLLER PRINCIPALE E INIZIALIZZAZIONE --- */

import { loadSettings, pathStack, getCurrentLevel, appState, setActiveNodeId, appSettings } from './state.js';
import { render, cleanupEdgeDrawing, isDrawingEdge, resetView, getCanvasCoords, puntoCanvas, evidenziaCliente } from './renderer.js';
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
import { initAiuto, avviaTourPrimoAvvio } from './aiuto.js';
import { avviaAggiornamenti } from './aggiornamento.js';
import { initImpostazioni } from './impostazioni.js';
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

/* --- AIUTO DEL CANVAS E SHIFT SULLE PORTE (spec 0011) --- */

const CHIAVE_AIUTO = 'modellatore.aiutoCanvasNascosto';

function initAiutoCanvas() {
    const aiuto = document.getElementById('aiutoCanvas');
    let nascosto = false;
    try {
        nascosto = localStorage.getItem(CHIAVE_AIUTO) === '1';
    } catch {
        nascosto = false;
    }
    if (aiuto) aiuto.hidden = nascosto;
    document.getElementById('btnChiudiAiuto')?.addEventListener('click', () => {
        aiuto.hidden = true;
        try {
            localStorage.setItem(CHIAVE_AIUTO, '1');
        } catch {
            // Senza localStorage la riga resta nascosta solo fino al ricaricamento
        }
    });

    // Shift premuto: cursore di spostamento sulle porte
    const impostaShift = (premuto) => document.body.classList.toggle('shift-premuto', premuto);
    window.addEventListener('keydown', (e) => { if (e.key === 'Shift') impostaShift(true); });
    window.addEventListener('keyup', (e) => { if (e.key === 'Shift') impostaShift(false); });
    window.addEventListener('blur', () => impostaShift(false));
}

async function initApp() {
    await loadSettings();
    initFiltri();
    initAiutoCanvas();
    initSchedaCliente();
    initCoerenza();
    initGerarchia();
    initMatrice();
    initDocumenti();
    initAiuto();
    initImpostazioni();

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
            const gridSize = appSettings.grid.size;
            const larghezza = appSettings.node.width;
            const altezza = appSettings.node.height;
            // Centrato sotto il cursore a qualsiasi zoom e pan, angolo agganciato alla griglia (spec 0011, AC-1)
            const punto = puntoCanvas(e);

            const newNode = {
                id: generaId('node'),
                type: typeId,
                label: blockDef.titolo,
                width: larghezza,
                height: altezza,
                position: {
                    x: Math.round((punto.x - larghezza / 2) / gridSize) * gridSize,
                    y: Math.round((punto.y - altezza / 2) / gridSize) * gridSize
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
    // Il tour parte da solo la prima volta (spec 0012, AC-2)
    avviaTourPrimoAvvio();
    // Versione nuova su GitHub: banner sotto l'header (spec 0015)
    avviaAggiornamenti();
}

initApp();