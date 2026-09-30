/* --- MOTORE DI RENDERING, ZOOM/PAN, BLOCCHI TONDI DEL PADRE E COLLEGAMENTI --- */

import { appState, pathStack, getCurrentLevel, activeNodeId, setActiveNodeId, appSettings } from './state.js';
import { selectNode, mostraDettaglioCliente } from './inspector.js';
import { renderUI } from './app.js';
import { pianificaSalvataggio } from './progetto.js';
import { segnaSchedaClienteDaAggiornare } from './cliente.js';
import {
    isInterfaccia, getClasseRequisito, getColoreRequisito, descriviRequisito,
    verificaCollegamento, isDerivazione, requisitoPadre, requisitiPadre, titoloRequisito, ID_CLIENTE
} from './model.js';
import { generaId } from './utils.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('workspaceSvg');
const viewport = document.getElementById('viewport');
const nodesLayer = document.getElementById('nodesLayer');
const edgesLayer = document.getElementById('edgesLayer');
const parentLayer = document.getElementById('parentLayer');

// Distanza dal bordo inferiore interno a cui stanno i pin di capacità di un blocco
const MARGINE_PIN_CAPACITA = 12;

export let isDrawingEdge = false;
export let edgeStartData = null;
let tempEdgePath = null;

// Gestione Zoom e Pan
export let zoomState = { scale: 1, x: 0, y: 0 };
let isPanning = false;
let startPan = { x: 0, y: 0 };

// Requisito cliente evidenziato sul canvas dal dettaglio nell'ispettore
let idClienteEvidenziato = null;

export function evidenziaCliente(id) {
    idClienteEvidenziato = id;
}

// Sposta la vista (zoom invariato) per mettere al centro il punto x, y del canvas
export function centraVista(x, y) {
    const rect = svg.getBoundingClientRect();
    zoomState.x = rect.width / 2 - x * zoomState.scale;
    zoomState.y = rect.height / 2 - y * zoomState.scale;
    updateViewportTransform();
}

export function resetView() {
    zoomState = { scale: 1, x: 0, y: 0 };
    updateViewportTransform();
}

function updateViewportTransform() {
    viewport.setAttribute('transform', `translate(${zoomState.x}, ${zoomState.y}) scale(${zoomState.scale})`);
}

function creaSvg(tag, attributi = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attributi).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

function aggiungiTooltip(el, testo) {
    const title = creaSvg('title');
    title.textContent = testo;
    el.appendChild(title);
}

// Eventi Zoom con Rotella e Pan con Click Centrale / Trascinamento Canvas
svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(0.3, zoomState.scale * zoomFactor), 3);

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    zoomState.x = mouseX - (mouseX - zoomState.x) * (newScale / zoomState.scale);
    zoomState.y = mouseY - (mouseY - zoomState.y) * (newScale / zoomState.scale);
    zoomState.scale = newScale;

    updateViewportTransform();
});

svg.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.target === svg || e.target.id === 'gridBackground') { // Tasto centrale o sfondo
        isPanning = true;
        startPan = { x: e.clientX - zoomState.x, y: e.clientY - zoomState.y };
        svg.style.cursor = 'grabbing';
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        zoomState.x = e.clientX - startPan.x;
        zoomState.y = e.clientY - startPan.y;
        updateViewportTransform();
    }
});

window.addEventListener('mouseup', () => {
    isPanning = false;
    svg.style.cursor = 'default';
});

/* --- RICERCA DEI REQUISITI NEL LIVELLO CORRENTE --- */

function getBlockDef(type) {
    return appState.library[type] || null;
}

// Tipo del padre del livello corrente: null alla radice, dove il padre sono i requisiti cliente
function tipoPadreCorrente() {
    return getCurrentLevel().parentNode?.type ?? null;
}

// Requisito di un estremo: ownerType 'parent' = requisito del blocco che contiene il livello corrente
function trovaRequisito(ownerId, reqId, ownerType) {
    if (ownerType === 'parent') return requisitoPadre(tipoPadreCorrente(), reqId);
    const tipo = getCurrentLevel().graph.nodes.find(n => n.id === ownerId)?.type;
    return getBlockDef(tipo)?.requisiti.find(r => r.id === reqId) || null;
}

function passaFiltro(req) {
    const filtro = appState.activeTypeFilter;
    return filtro === 'Tutti' || getClasseRequisito(req) === filtro;
}

export function render() {
    if (!appSettings) return;
    // Ogni mutazione del modello passa di qui: parte (o riparte) l'attesa del salvataggio automatico
    pianificaSalvataggio();

    updateViewportTransform();

    const currentLevel = getCurrentLevel();
    const currentGraph = currentLevel.graph;

    nodesLayer.innerHTML = '';
    edgesLayer.innerHTML = '';
    parentLayer.innerHTML = '';

    const filtroAttivo = appState.activeTypeFilter !== 'Tutti';

    if (currentLevel.parentNode) {
        renderParentBlocks(currentLevel.parentNode, currentGraph);
    } else {
        renderBlocchiCliente(currentGraph);
    }

    // RENDER FILI (EDGES)
    const activeEdges = currentGraph.edges.filter(edge => {
        const req = trovaRequisito(edge.source, edge.sourceHandle, edge.sourceType);
        return req && passaFiltro(req);
    });

    activeEdges.forEach(edge => renderEdge(edge, currentGraph));

    // RENDER NODI
    currentGraph.nodes.forEach(node => {
        const blockDef = getBlockDef(node.type);
        if (!blockDef) return;

        if (filtroAttivo && appState.omitUninvolved) {
            const hasReqType = blockDef.requisiti.some(passaFiltro);
            const isConnectedInFilter = activeEdges.some(e => e.source === node.id || e.target === node.id);
            if (!hasReqType && !isConnectedInFilter) return;
        }

        renderNode(node, blockDef);
    });

    renderUI();
    // La scheda Cliente si aggiorna al massimo una volta per fotogramma, mai qui dentro
    segnaSchedaClienteDaAggiornare();
}

function renderEdge(edge, currentGraph) {
    const startCoords = getEstremoCoords(edge.source, edge.sourceHandle, edge.sourceType, currentGraph);
    const endCoords = getEstremoCoords(edge.target, edge.targetHandle, edge.targetType, currentGraph);
    if (!startCoords || !endCoords) return;

    const srcReq = trovaRequisito(edge.source, edge.sourceHandle, edge.sourceType);
    const tgtReq = trovaRequisito(edge.target, edge.targetHandle, edge.targetType);
    const edgeColor = getColoreRequisito(srcReq);
    const derivazione = isDerivazione(edge);

    if (!edge.waypoints) edge.waypoints = [];
    const points = [startCoords, ...edge.waypoints, endCoords];
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const path = creaSvg('path', {
        class: derivazione ? 'edge-path edge-derivazione' : 'edge-path',
        d: pathData,
        stroke: edgeColor
    });

    const relazione = derivazione ? 'Derivazione padre → figlio' : 'Collegamento tra blocchi';
    aggiungiTooltip(path,
        `${relazione} [${getClasseRequisito(srcReq)}]\n` +
        `${srcReq.id} ${titoloRequisito(srcReq)} → ${tgtReq?.id ?? edge.targetHandle} ${titoloRequisito(tgtReq)}\n` +
        `Doppio clic: aggiungi snodo · Clic destro: elimina`);

    // Aggiungi Snodo con Doppio Clic
    path.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const coords = getCanvasCoords(e);
        edge.waypoints.push({ x: coords.x, y: coords.y });
        render();
    });

    // ELIMINAZIONE CAVO: Click Destro
    path.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Vuoi eliminare questo collegamento?")) {
            currentGraph.edges = currentGraph.edges.filter(eItem => eItem.id !== edge.id);
            render();
        }
    });

    edgesLayer.appendChild(path);

    edge.waypoints.forEach((wp, idx) => {
        const handle = creaSvg('circle', {
            cx: wp.x, cy: wp.y, r: 5, fill: edgeColor, stroke: '#ffffff', 'stroke-width': '1.5'
        });
        handle.style.cursor = 'move';
        handle.addEventListener('mousedown', (e) => startWaypointDrag(e, wp));
        handle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            edge.waypoints.splice(idx, 1);
            render();
        });
        edgesLayer.appendChild(handle);
    });
}

function renderNode(node, blockDef) {
    const nodeW = node.width || appSettings.node.width;
    const nodeH = node.height || appSettings.node.height;

    const g = creaSvg('g', { transform: `translate(${node.position.x}, ${node.position.y})` });

    const rect = creaSvg('rect', { width: nodeW, height: nodeH, class: 'node-rect' });
    if (activeNodeId === node.id) {
        rect.style.stroke = appSettings.node.selectedBorderColor;
        rect.style.strokeWidth = '3px';
    }
    if (blockDef.descrizione) aggiungiTooltip(rect, blockDef.descrizione);

    const labelText = creaSvg('text', {
        x: nodeW / 2, y: nodeH / 2 + 5, 'text-anchor': 'middle', class: 'node-text'
    });
    labelText.textContent = node.label || blockDef.titolo || node.id;

    g.appendChild(rect);
    g.appendChild(labelText);

    const resizeHandle = creaSvg('rect', {
        x: nodeW - 10, y: nodeH - 10, width: 10, height: 10, class: 'node-resize-handle'
    });
    resizeHandle.addEventListener('mousedown', (e) => startResizeDrag(e, node));
    g.appendChild(resizeHandle);

    // Interfaccia: porte sul bordo, spostabili con Shift+trascina
    const interfacce = blockDef.requisiti.filter(isInterfaccia);
    interfacce.forEach((req, idx) => {
        const pos = getReqPerimeterPos(node, req.id, idx, interfacce.length);
        const pin = createReqPin(pos.x, pos.y, req, { ownerId: node.id, ownerType: 'node' }, 'cerchio');
        pin.addEventListener('mousedown', (e) => {
            if (e.shiftKey) {
                e.stopPropagation();
                startPinPerimeterDrag(e, node, req.id);
            }
        });
        g.appendChild(pin);
    });

    // Capacità: pin quadrati all'interno del blocco, lungo il bordo inferiore
    const capacita = blockDef.requisiti.filter(r => !isInterfaccia(r));
    capacita.forEach((req, idx) => {
        const pos = getCapacitaPos(node, idx, capacita.length);
        g.appendChild(createReqPin(pos.x, pos.y, req, { ownerId: node.id, ownerType: 'node' }, 'quadrato'));
    });

    g.addEventListener('mousedown', (e) => startDrag(e, node));
    g.addEventListener('dblclick', () => enterNode(node));
    g.addEventListener('click', (e) => { e.stopPropagation(); selectNode(node); });

    nodesLayer.appendChild(g);
}

/* --- BLOCCHI TONDI: I REQUISITI DEL BLOCCO PADRE VISTI DALL'INTERNO --- */

// Posizione del centro del blocco tondo; salvata in graph.parentReqPositions quando lo sposti
function getParentBlockCenter(graph, reqId, idx) {
    return graph.parentReqPositions?.[reqId] || posizioneInColonna(idx);
}

// Posto idx della colonna a sinistra in cui stanno i blocchi tondi non ancora spostati
export function posizioneInColonna(idx) {
    const passo = appSettings.parentBlock.radius * 2 + appSettings.grid.size * 2;
    return { x: 60, y: 60 + idx * passo };
}

function getParentReqPinPos(graph, reqId, idx) {
    const centro = getParentBlockCenter(graph, reqId, idx);
    return { x: centro.x + appSettings.parentBlock.radius, y: centro.y };
}

function renderParentBlocks(parentNode, graph) {
    const parentDef = getBlockDef(parentNode.type);
    if (!parentDef) return;
    const intestazione = `Requisito del blocco padre [${parentNode.label || parentDef.titolo}]`;
    parentDef.requisiti.forEach((req, idx) => {
        disegnaBloccoTondo(graph, req, idx, parentNode.id, {
            etichetta: req.id,
            sottotitolo: req.titolo,
            tooltip: `${intestazione}\n${descriviRequisito(req)}\n\nTrascina per spostare`
        });
    });
}

// Alla radice: i requisiti cliente che hanno una posizione salvata (sono "sul canvas")
function renderBlocchiCliente(graph) {
    const posizioni = graph.parentReqPositions || {};
    requisitiPadre(null).forEach((req, idx) => {
        if (!posizioni[req.id]) return;
        disegnaBloccoTondo(graph, req, idx, ID_CLIENTE, {
            etichetta: req.idCliente,
            sottotitolo: titoloRequisito(req),
            tooltip: `Requisito cliente\n${descriviRequisito(req)}\n\nClic: dettaglio · Trascina per spostare`,
            ritirato: req.stato === 'ritirato',
            modificato: req.modificato,
            evidenziato: req.id === idClienteEvidenziato,
            alClic: () => mostraDettaglioCliente(req.id)
        });
    });
}

function disegnaBloccoTondo(graph, req, idx, ownerId, opzioni) {
    const raggio = appSettings.parentBlock.radius;
    const centro = getParentBlockCenter(graph, req.id, idx);
    const colore = opzioni.ritirato ? '#9e9e9e' : getColoreRequisito(req);
    const g = creaSvg('g', { class: 'parent-block' });
    if (!passaFiltro(req)) g.style.opacity = '0.25';

    let classe = 'parent-block-circle';
    if (opzioni.ritirato) classe += ' parent-block-ritirato';
    if (opzioni.evidenziato) classe += ' parent-block-evidenziato';
    const cerchio = creaSvg('circle', { cx: centro.x, cy: centro.y, r: raggio, class: classe, stroke: colore });
    aggiungiTooltip(cerchio, opzioni.tooltip);
    cerchio.addEventListener('mousedown', (e) => startParentBlockDrag(e, graph, req.id, idx));
    if (opzioni.alClic) {
        cerchio.addEventListener('click', (e) => { e.stopPropagation(); opzioni.alClic(); });
    }
    g.appendChild(cerchio);

    if (opzioni.modificato) {
        const segno = creaSvg('circle', {
            cx: centro.x + raggio * 0.7, cy: centro.y - raggio * 0.7, r: 5, class: 'segno-modificato'
        });
        aggiungiTooltip(segno, "Modificato dall'ultimo import: apri il dettaglio e segnalo come visto");
        g.appendChild(segno);
    }

    const idText = creaSvg('text', {
        x: centro.x, y: centro.y + raggio + 14, 'text-anchor': 'middle', class: 'parent-block-id'
    });
    idText.textContent = opzioni.etichetta;
    g.appendChild(idText);

    const titoloText = creaSvg('text', {
        x: centro.x, y: centro.y + raggio + 27, 'text-anchor': 'middle', class: 'parent-block-title'
    });
    titoloText.textContent = opzioni.sottotitolo || '';
    g.appendChild(titoloText);

    const pinPos = getParentReqPinPos(graph, req.id, idx);
    g.appendChild(createReqPin(pinPos.x, pinPos.y, req, { ownerId, ownerType: 'parent' }, isInterfaccia(req) ? 'cerchio' : 'quadrato'));

    parentLayer.appendChild(g);
}

function startParentBlockDrag(e, graph, reqId, idx) {
    e.stopPropagation();
    const centro = getParentBlockCenter(graph, reqId, idx);
    const startCoords = getCanvasCoords(e);
    const offset = { x: startCoords.x - centro.x, y: startCoords.y - centro.y };

    function drag(ev) {
        const coords = getCanvasCoords(ev);
        if (!graph.parentReqPositions) graph.parentReqPositions = {};
        graph.parentReqPositions[reqId] = { x: coords.x - offset.x, y: coords.y - offset.y };
        render();
    }
    function endDrag() {
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
    }
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
}

/* --- COORDINATE --- */

export function getCanvasCoords(e) {
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const gridSize = appSettings.grid.size;

    return {
        x: Math.round(((mouseX - zoomState.x) / zoomState.scale) / gridSize) * gridSize,
        y: Math.round(((mouseY - zoomState.y) / zoomState.scale) / gridSize) * gridSize
    };
}

function getReqPerimeterPos(node, reqId, idx, totalReqs) {
    const nodeW = node.width || appSettings.node.width;
    const nodeH = node.height || appSettings.node.height;

    if (!node.pinPositions) node.pinPositions = {};
    const pin = node.pinPositions[reqId];
    if (pin) {
        switch (pin.side) {
            case 'top': return { x: pin.ratio * nodeW, y: 0 };
            case 'bottom': return { x: pin.ratio * nodeW, y: nodeH };
            case 'left': return { x: 0, y: pin.ratio * nodeH };
            case 'right': return { x: nodeW, y: pin.ratio * nodeH };
        }
    }

    const isRight = idx % 2 === 1;
    return {
        x: isRight ? nodeW : 0,
        y: (nodeH / (Math.ceil(totalReqs / 2) + 1)) * (Math.floor(idx / 2) + 1)
    };
}

function getCapacitaPos(node, idx, totalReqs) {
    const nodeW = node.width || appSettings.node.width;
    const nodeH = node.height || appSettings.node.height;
    return { x: (nodeW / (totalReqs + 1)) * (idx + 1), y: nodeH - MARGINE_PIN_CAPACITA };
}

// Coordinate assolute del pin di un requisito di un nodo (bordo per l'interfaccia, interno per la capacità)
export function getReqCoordinates(node, reqId) {
    const blockDef = getBlockDef(node.type);
    const req = blockDef?.requisiti.find(r => r.id === reqId);
    if (!req) return null;

    const gruppo = blockDef.requisiti.filter(r => isInterfaccia(r) === isInterfaccia(req));
    const idx = gruppo.indexOf(req);
    const relPos = isInterfaccia(req)
        ? getReqPerimeterPos(node, reqId, idx, gruppo.length)
        : getCapacitaPos(node, idx, gruppo.length);
    return { x: node.position.x + relPos.x, y: node.position.y + relPos.y };
}

function getEstremoCoords(ownerId, reqId, ownerType, graph) {
    if (ownerType === 'parent') {
        const tipoPadre = tipoPadreCorrente();
        // Un requisito cliente si disegna solo se ha una posizione salvata
        if (tipoPadre === null && !graph.parentReqPositions?.[reqId]) return null;
        const idx = requisitiPadre(tipoPadre).findIndex(r => r.id === reqId);
        return idx >= 0 ? getParentReqPinPos(graph, reqId, idx) : null;
    }
    const node = graph.nodes.find(n => n.id === ownerId);
    return node ? getReqCoordinates(node, reqId) : null;
}

/* --- PIN E DISEGNO DEI COLLEGAMENTI --- */

function createReqPin(cx, cy, req, owner, forma) {
    const raggio = appSettings.requirements.radius;
    const colore = getColoreRequisito(req);
    const pin = forma === 'quadrato'
        ? creaSvg('rect', { x: cx - raggio, y: cy - raggio, width: raggio * 2, height: raggio * 2 })
        : creaSvg('circle', { cx, cy, r: raggio });
    pin.setAttribute('class', 'node-req-pin');
    pin.setAttribute('fill', colore);
    if (!passaFiltro(req)) pin.style.opacity = '0.25';

    const suggerimento = owner.ownerType === 'node' && isInterfaccia(req) ? '\n[Shift+trascina per spostare la porta]' : '';
    aggiungiTooltip(pin, descriviRequisito(req) + suggerimento);

    pin.addEventListener('mousedown', (e) => {
        if (e.shiftKey) return;
        e.stopPropagation();
        isDrawingEdge = true;
        edgeStartData = { ownerId: owner.ownerId, reqId: req.id, ownerType: owner.ownerType, x: cx, y: cy };

        tempEdgePath = creaSvg('path', { class: 'edge-path', stroke: colore });
        tempEdgePath.style.strokeDasharray = '4,4';
        // La linea segue il mouse: non deve intercettare il rilascio sul pin di destinazione
        tempEdgePath.style.pointerEvents = 'none';
        edgesLayer.appendChild(tempEdgePath);
    });

    pin.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        const stessoPin = edgeStartData && edgeStartData.ownerId === owner.ownerId &&
            edgeStartData.ownerType === owner.ownerType && edgeStartData.reqId === req.id;
        if (isDrawingEdge && edgeStartData && !stessoPin) {
            const graph = getCurrentLevel().graph;
            const a = { ...edgeStartData, req: trovaRequisito(edgeStartData.ownerId, edgeStartData.reqId, edgeStartData.ownerType) };
            const b = { ownerId: owner.ownerId, reqId: req.id, ownerType: owner.ownerType, req };

            const errore = verificaCollegamento(a, b, graph.edges);
            if (errore) {
                alert(`Impossibile collegare: ${errore}`);
            } else {
                // Una derivazione parte sempre dal requisito del padre
                const [sorgente, destinazione] = b.ownerType === 'parent' ? [b, a] : [a, b];
                graph.edges.push({
                    id: generaId('edge'),
                    source: sorgente.ownerId,
                    sourceHandle: sorgente.reqId,
                    sourceType: sorgente.ownerType,
                    target: destinazione.ownerId,
                    targetHandle: destinazione.reqId,
                    targetType: destinazione.ownerType,
                    waypoints: []
                });
            }
        }
        cleanupEdgeDrawing();
        render();
    });

    return pin;
}

// Linea tratteggiata che segue il mouse mentre disegni un collegamento
window.addEventListener('mousemove', (e) => {
    if (!isDrawingEdge || !tempEdgePath || !edgeStartData) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - zoomState.x) / zoomState.scale;
    const y = (e.clientY - rect.top - zoomState.y) / zoomState.scale;
    const start = getEstremoCoords(edgeStartData.ownerId, edgeStartData.reqId, edgeStartData.ownerType, getCurrentLevel().graph) || edgeStartData;
    tempEdgePath.setAttribute('d', `M ${start.x} ${start.y} L ${x} ${y}`);
});

export function cleanupEdgeDrawing() {
    isDrawingEdge = false; edgeStartData = null;
    if (tempEdgePath) { tempEdgePath.remove(); tempEdgePath = null; }
}

/* --- TRASCINAMENTI --- */

function startResizeDrag(e, node) {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialW = node.width || appSettings.node.width;
    const initialH = node.height || appSettings.node.height;

    function drag(ev) {
        const gridSize = appSettings.grid.size;
        node.width = Math.max(80, Math.round((initialW + (ev.clientX - startX) / zoomState.scale) / gridSize) * gridSize);
        node.height = Math.max(40, Math.round((initialH + (ev.clientY - startY) / zoomState.scale) / gridSize) * gridSize);
        render();
    }

    function endDrag() {
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
    }

    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
}

function startPinPerimeterDrag(e, node, reqId) {
    const nodeW = node.width || appSettings.node.width;
    const nodeH = node.height || appSettings.node.height;

    function drag(ev) {
        const coords = getCanvasCoords(ev);
        const relX = coords.x - node.position.x;
        const relY = coords.y - node.position.y;

        const dTop = Math.abs(relY);
        const dBottom = Math.abs(relY - nodeH);
        const dLeft = Math.abs(relX);
        const dRight = Math.abs(relX - nodeW);

        const min = Math.min(dTop, dBottom, dLeft, dRight);
        if (!node.pinPositions) node.pinPositions = {};

        if (min === dTop) node.pinPositions[reqId] = { side: 'top', ratio: Math.max(0, Math.min(1, relX / nodeW)) };
        else if (min === dBottom) node.pinPositions[reqId] = { side: 'bottom', ratio: Math.max(0, Math.min(1, relX / nodeW)) };
        else if (min === dLeft) node.pinPositions[reqId] = { side: 'left', ratio: Math.max(0, Math.min(1, relY / nodeH)) };
        else node.pinPositions[reqId] = { side: 'right', ratio: Math.max(0, Math.min(1, relY / nodeH)) };

        render();
    }

    function endDrag() {
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
    }

    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
}

function startWaypointDrag(e, waypoint) {
    e.stopPropagation();

    function drag(ev) {
        const coords = getCanvasCoords(ev);
        waypoint.x = coords.x;
        waypoint.y = coords.y;
        render();
    }

    function endDrag() {
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
    }

    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
}

function enterNode(node) {
    if (!node.internal_graph) node.internal_graph = { nodes: [], edges: [] };
    pathStack.push({
        id: node.id,
        label: node.label || node.id,
        graph: node.internal_graph,
        parentNode: node
    });
    setActiveNodeId(null);
    renderUI();
    render();
}

function startDrag(e, node) {
    e.stopPropagation();
    const startCoords = getCanvasCoords(e);
    const offset = { x: startCoords.x - node.position.x, y: startCoords.y - node.position.y };

    function drag(ev) {
        const coords = getCanvasCoords(ev);
        node.position.x = coords.x - offset.x;
        node.position.y = coords.y - offset.y;
        render();
    }
    function endDrag() {
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
    }
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
}
