/* --- CONTROLLER PRINCIPALE E INIZIALIZZAZIONE --- */

import { loadSettings, pathStack, getCurrentLevel, appState, setActiveNodeId, appSettings } from './state.js';
import {
    render, cleanupEdgeDrawing, isDrawingEdge, resetView, getCanvasCoords, puntoCanvas, evidenziaCliente, reinstradaLivello,
    adattaVista, zoomaDi, zoomState, commutaVista, impostaStrato, trovaBlocco
} from './renderer.js';
import { formaBlocco } from './blocco.js';
import { initTabelle } from './tabelle.js';
import { initLibrary, loadLibraryFromPath } from './builder.js';
import { renderNewBlockForm } from './inspector.js';
import { avviaProgetti, aggiornaPercorsoLibreria } from './progetto.js';
import { mostraChangelog, initChangelog } from './libreria.js';
import { initSchedaCliente, posizionaRequisitoCliente, impostaSelezioneCliente } from './cliente.js';
import { initCoerenza } from './coerenza.js';
import { initGerarchia } from './gerarchia.js';
import { initMatrice } from './matrice.js';
import { initDocumenti } from './documenti.js';
import { initDiagrammi } from './diagramma.js';
import { initFiltri } from './filtri.js';
import { initAiuto, avviaTourPrimoAvvio } from './aiuto.js';
import { avviaAggiornamenti } from './aggiornamento.js';
import { initImpostazioni } from './impostazioni.js';
import { generaId } from './utils.js';
import { istanziaInterno } from './matrioska.js';
import { avviaPannelli, commutaPannello, mostraPannello } from './pannelli.js';
import type { Nodo } from './tipi.js';

const svg = document.getElementById('workspaceSvg');
const canvasContainer = document.getElementById('canvasContainer');

export function renderUI(): void {
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

    backBtn.style.display = pathStack.length > 1 ? 'inline-flex' : 'none';
    backBtn.onclick = () => { 
        pathStack.pop(); 
        renderUI(); 
        render(); 
    };
}

/* --- AIUTO DEL CANVAS E SHIFT SULLE PORTE (spec 0011) --- */

const CHIAVE_AIUTO = 'modellatore.aiutoCanvasNascosto';

function initAiutoCanvas(): void {
    const aiuto = document.getElementById('aiutoCanvas');
    let nascosto: boolean;
    try {
        nascosto = localStorage.getItem(CHIAVE_AIUTO) === '1';
    } catch {
        nascosto = false;
    }
    if (aiuto) aiuto.hidden = nascosto;
    document.getElementById('btnChiudiAiuto')?.addEventListener('click', () => {
        if (aiuto) aiuto.hidden = true;
        try {
            localStorage.setItem(CHIAVE_AIUTO, '1');
        } catch {
            // Senza localStorage la riga resta nascosta solo fino al ricaricamento
        }
    });

    // Shift premuto: cursore di spostamento sulle porte
    const impostaShift = (premuto: boolean) => document.body.classList.toggle('shift-premuto', premuto);
    window.addEventListener('keydown', (e) => { if (e.key === 'Shift') impostaShift(true); });
    window.addEventListener('keyup', (e) => { if (e.key === 'Shift') impostaShift(false); });
    window.addEventListener('blur', () => impostaShift(false));
}

/* --- STRUMENTI DELLA LAVAGNA E TESTATA IN STILE IDV (spec 0035) --- */

function initStrumentiLavagna(): void {
    const su = (id: string, azione: () => void) => document.getElementById(id)?.addEventListener('click', azione);
    su('btnAdatta', adattaVista);
    su('btnZoomMeno', () => zoomaDi(1 / 1.2));
    su('btnZoomPiu', () => zoomaDi(1.2));
    // Clic sulla percentuale: torna al 100% intorno al centro
    su('etichettaZoom', () => zoomaDi(1 / zoomState.scale));
    su('btnMostraEtichette', () => commutaVista('etichette'));
    su('btnMostraLegenda', () => commutaVista('legenda'));
    su('btnStratoInterfacce', () => impostaStrato(false));
    su('btnStratoCavi', () => impostaStrato(true));
    su('btnNuovoBloccoBarra', () => {
        renderNewBlockForm();
        mostraPannello('ispettore');
    });
    // Nome del progetto sotto il marchio: apre la finestra Apri progetto, come il menu
    su('nomeProgettoTestata', () => document.querySelector<HTMLElement>('#menuProgetto [data-azione="apri"]')?.click());

    const cerca = document.getElementById('cercaBlocco') as HTMLInputElement | null;
    if (cerca) {
        const vai = () => {
            if (!cerca.value.trim()) return;
            if (trovaBlocco(cerca.value)) cerca.value = '';
            else cerca.setCustomValidity('Nessun blocco con questo nome nel livello aperto');
            cerca.reportValidity();
        };
        cerca.addEventListener('input', () => cerca.setCustomValidity(''));
        cerca.addEventListener('change', vai);
        cerca.addEventListener('keydown', (e) => { if (e.key === 'Enter') vai(); });
    }

    // Stato dell'app in testata: Attiva, oppure l'ultimo errore JavaScript (clic: dettagli)
    const stato = document.getElementById('statoApp');
    const errori: string[] = [];
    const segna = (messaggio: string) => {
        errori.push(`${new Date().toLocaleTimeString('it-IT')} · ${messaggio}`);
        if (!stato) return;
        stato.className = 'app-status err';
        const testo = stato.querySelector('.st-text');
        if (testo) testo.textContent = 'Errore';
        stato.dataset.titoloNativo = `${errori.length} ${errori.length === 1 ? 'errore' : 'errori'} JavaScript: clic per i dettagli`;
    };
    window.addEventListener('error', (e) => { if (e.message) segna(e.message); });
    window.addEventListener('unhandledrejection', (e) => segna(`Promise non gestita: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`));
    stato?.addEventListener('click', () => { if (errori.length) alert(`Errori di questa sessione:\n\n${errori.slice(-10).join('\n')}`); });
}

export async function initApp(): Promise<void> {
    await loadSettings();
    // Prima di tutto il resto: i pannelli mettono i contenitori nella pagina (spec 0021)
    avviaPannelli();
    initFiltri();
    initAiutoCanvas();
    initSchedaCliente();
    initCoerenza();
    initGerarchia();
    initMatrice();
    initDocumenti();
    initDiagrammi();
    initChangelog();
    initAiuto();
    initImpostazioni();
    initTabelle();
    initStrumentiLavagna();

    // Evento ricarica manuale da path: richiama sempre l'API, anche con lo stesso percorso (riallinea impronta e versione).
    // Se riesce, diventa la libreria del progetto; se fallisce restano libreria e stato precedenti
    document.getElementById('btnLoadFromPath')?.addEventListener('click', async () => {
        const path = (document.getElementById('libPathInput') as HTMLInputElement).value.trim();
        const esito = await loadLibraryFromPath(path);
        if (esito.ok) {
            aggiornaPercorsoLibreria(path);
            alert(`Libreria ricaricata con successo da: ${path}`);
        } else {
            alert(`Impossibile caricare la libreria: ${esito.messaggio ?? ''}`);
        }
    });

    document.getElementById('btnChangelog')?.addEventListener('click', () => { void mostraChangelog(); });

    document.getElementById('btnNewBlockFromScratch')?.addEventListener('click', renderNewBlockForm);
    document.getElementById('btnResetView')?.addEventListener('click', resetView);
    document.getElementById('btnReinstrada')?.addEventListener('click', reinstradaLivello);

    document.getElementById('libSearchInput')?.addEventListener('input', (e) => {
        appState.librarySearchQuery = (e.target as HTMLInputElement).value;
        initLibrary();
    });

    document.getElementById('toggleLeftBtn')?.addEventListener('click', () => commutaPannello('libreria'));
    document.getElementById('toggleRightBtn')?.addEventListener('click', () => commutaPannello('ispettore'));

    canvasContainer?.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer?.addEventListener('drop', (e) => {
        e.preventDefault();
        const typeId = e.dataTransfer?.getData('blockType') ?? '';
        const blockDef = typeId ? appState.library[typeId] : undefined;
        if (blockDef) {
            const gridSize = appSettings.grid.size;
            // Centrato sotto il cursore a qualsiasi zoom e pan, angolo agganciato alla griglia (spec 0011, AC-1)
            const punto = puntoCanvas(e);

            const newNode: Nodo = {
                id: generaId('node'),
                type: typeId,
                label: blockDef.titolo,
                width: appSettings.node.width,
                height: appSettings.node.height,
                position: { x: 0, y: 0 },
                internal_graph: { nodes: [], edges: [] }
            };
            // Blocco matrioska (spec 0034): nasce con una copia dell'interno standard della libreria
            const avvisi: string[] = [];
            if (blockDef.interno) {
                const { grafo, mancanti, filiTolti } = istanziaInterno(typeId, newNode.id, appState.library);
                newNode.internal_graph = grafo;
                if (mancanti.length) avvisi.push(`questi blocchi non sono nella libreria e sono stati saltati: ${mancanti.join(', ')}`);
                if (filiTolti) avvisi.push(`${filiTolti === 1 ? '1 filo non più valido è stato tolto' : `${filiTolti} fili non più validi sono stati tolti`}`);
            }
            // La forma IDV (righe dei requisiti e porte propagate dell'interno) decide le misure da centrare
            const forma = formaBlocco(newNode, blockDef, appState.library, appSettings);
            newNode.position = {
                x: Math.round((punto.x - forma.larghezza / 2) / gridSize) * gridSize,
                y: Math.round((punto.y - forma.altezza / 2) / gridSize) * gridSize
            };

            getCurrentLevel().graph.nodes.push(newNode);
            render();
            if (avvisi.length) alert(`Interno standard di "${blockDef.titolo}": ${avvisi.join('; ')}. Per sistemarlo, correggi l'interno di questa istanza e salvalo di nuovo in libreria.`);
            return;
        }
        // Una riga della scheda Cliente: diventa un blocco tondo della radice, centrato sul punto di griglia più vicino
        const idCliente = e.dataTransfer?.getData('requisitoCliente');
        if (idCliente) posizionaRequisitoCliente(idCliente, getCanvasCoords(e));
    });

    svg?.addEventListener('click', () => {
        setActiveNodeId(null);
        impostaSelezioneCliente(null);
        evidenziaCliente(null);
        const propsContent = document.getElementById('propsContent');
        if (propsContent) propsContent.innerHTML = '<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>';
        render();
    });

    svg?.addEventListener('mouseup', () => { if (isDrawingEdge) cleanupEdgeDrawing(); });

    // Apre l'ultimo progetto (o lo crea) e ne carica la libreria; da qui parte il salvataggio automatico
    await avviaProgetti();
    // Il tour parte da solo la prima volta (spec 0012, AC-2)
    avviaTourPrimoAvvio();
    // Versione nuova su GitHub: banner sotto l'header (spec 0015)
    void avviaAggiornamenti();
}
