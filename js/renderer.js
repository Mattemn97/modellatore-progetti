/* --- MOTORE DI RENDERING, ZOOM/PAN E ELIMINAZIONE CAVI --- */

import { appState, pathStack, getCurrentLevel, activeNodeId, setActiveNodeId, appSettings } from './state.js';
import { selectNode } from './inspector.js';
import { renderUI } from './app.js';

const svg = document.getElementById('workspaceSvg');
const viewport = document.getElementById('viewport');
const nodesLayer = document.getElementById('nodesLayer');
const edgesLayer = document.getElementById('edgesLayer');
const parentLayer = document.getElementById('parentLayer');

export let isDrawingEdge = false;
export let edgeStartData = null;
let tempEdgePath = null;

// Gestione Zoom e Pan
export let zoomState = { scale: 1, x: 0, y: 0 };
let isPanning = false;
let startPan = { x: 0, y: 0 };

export function resetView() {
    zoomState = { scale: 1, x: 0, y: 0 };
    updateViewportTransform();
}

function updateViewportTransform() {
    viewport.setAttribute('transform', `translate(${zoomState.x}, ${zoomState.y}) scale(${zoomState.scale})`);
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
    if (e.button === 1 || e.target === svg || e.target.id === 'grid') { // Tasto centrale o sfondo
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

export function render() {
    if (!appSettings) return;

    updateViewportTransform();

    const currentLevel = getCurrentLevel();
    const currentGraph = currentLevel.graph;
    
    nodesLayer.innerHTML = '';
    edgesLayer.innerHTML = '';
    parentLayer.innerHTML = '';

    const filterType = appState.activeTypeFilter;
    const omitUninvolved = appState.omitUninvolved;

    if (pathStack.length > 1 && currentLevel.parentNode) {
        renderParentBoundary(currentLevel.parentNode);
    }

    // RENDER FILI (EDGES)
    const activeEdges = currentGraph.edges.filter(edge => {
        if (filterType === 'Tutti') return true;
        const reqType = getReqType(edge.source, edge.sourceHandle, edge.sourceType);
        return reqType === filterType;
    });

    activeEdges.forEach(edge => {
        let startCoords, endCoords;
        const srcNode = currentGraph.nodes.find(n => n.id === edge.source);
        const tgtNode = currentGraph.nodes.find(n => n.id === edge.target);

        if (edge.sourceType === 'parent') {
            startCoords = getParentReqCoords(edge.sourceHandle);
        } else if (srcNode) {
            startCoords = getReqCoordinates(srcNode, edge.sourceHandle);
        }

        if (edge.targetType === 'parent') {
            endCoords = getParentReqCoords(edge.targetHandle);
        } else if (tgtNode) {
            endCoords = getReqCoordinates(tgtNode, edge.targetHandle);
        }

        if (startCoords && endCoords) {
            const reqType = getReqType(edge.source, edge.sourceHandle, edge.sourceType);
            const edgeColor = appSettings.requirements.typeColors[reqType] || "#555";

            if (!edge.waypoints) edge.waypoints = [];
            const points = [startCoords, ...edge.waypoints, endCoords];

            let pathData = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                pathData += ` L ${points[i].x} ${points[i].y}`;
            }

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'edge-path');
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', edgeColor);

            // Aggiungi Titolo Tooltip
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `Collegamento [${reqType}] - Click Destro per Eliminare`;
            path.appendChild(title);

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
                const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                handle.setAttribute('cx', wp.x); handle.setAttribute('cy', wp.y);
                handle.setAttribute('r', 5); handle.setAttribute('fill', edgeColor);
                handle.setAttribute('stroke', '#ffffff'); handle.setAttribute('stroke-width', '1.5');
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
    });

    // RENDER NODI
    currentGraph.nodes.forEach(node => {
        const blockDef = appState.library[node.type];
        if (!blockDef) return;

        if (filterType !== 'Tutti' && omitUninvolved) {
            const hasReqType = blockDef.requirements.some(r => r.type === filterType);
            const isConnectedInFilter = activeEdges.some(e => e.source === node.id || e.target === node.id);
            if (!hasReqType && !isConnectedInFilter) return; 
        }

        const nodeW = node.width || appSettings.node.width;
        const nodeH = node.height || appSettings.node.height;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', nodeW); rect.setAttribute('height', nodeH);
        rect.setAttribute('class', 'node-rect');
        if (activeNodeId === node.id) {
            rect.style.stroke = appSettings.node.selectedBorderColor;
            rect.style.strokeWidth = '3px';
        }

        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', nodeW / 2); labelText.setAttribute('y', nodeH / 2 + 5);
        labelText.setAttribute('text-anchor', 'middle');
        labelText.setAttribute('class', 'node-text');
        labelText.textContent = node.label || blockDef.name || node.id;

        g.appendChild(rect);
        g.appendChild(labelText);

        const resizeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        resizeHandle.setAttribute('x', nodeW - 10); resizeHandle.setAttribute('y', nodeH - 10);
        resizeHandle.setAttribute('width', 10); resizeHandle.setAttribute('height', 10);
        resizeHandle.setAttribute('class', 'node-resize-handle');
        resizeHandle.addEventListener('mousedown', (e) => startResizeDrag(e, node));
        g.appendChild(resizeHandle);

        blockDef.requirements.forEach((req, idx) => {
            const pos = getReqPerimeterPos(node, req.id, idx, blockDef.requirements.length);
            const color = appSettings.requirements.typeColors[req.type] || "#3498db";

            const circle = createReqPin(pos.x, pos.y, color, node.id, req.id, req.title || req.name, req.description, 'node');
            circle.addEventListener('mousedown', (e) => {
                if (e.shiftKey) {
                    e.stopPropagation();
                    startPinPerimeterDrag(e, node, req.id);
                }
            });

            g.appendChild(circle);
        });

        g.addEventListener('mousedown', (e) => startDrag(e, node));
        g.addEventListener('dblclick', () => enterNode(node));
        g.addEventListener('click', (e) => { e.stopPropagation(); selectNode(node); });

        nodesLayer.appendChild(g);
    });

    renderUI();
}

function getCanvasCoords(e) {
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
    if (node.pinPositions[reqId]) {
        const pin = node.pinPositions[reqId];
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

export function getReqCoordinates(node, reqId) {
    const blockDef = appState.library[node.type];
    const idx = blockDef?.requirements.findIndex(r => r.id === reqId);
    const relPos = getReqPerimeterPos(node, reqId, idx >= 0 ? idx : 0, blockDef?.requirements.length || 1);
    return { x: node.position.x + relPos.x, y: node.position.y + relPos.y };
}

function getReqType(ownerId, reqId, ownerType) {
    if (ownerType === 'parent') {
        const currentLevel = getCurrentLevel();
        const parentDef = appState.library[currentLevel.parentNode.type];
        return parentDef?.requirements?.find(r => r.id === reqId)?.type;
    } else {
        const currentLevel = getCurrentLevel();
        const node = currentLevel.graph.nodes.find(n => n.id === ownerId);
        const blockDef = appState.library[node?.type];
        return blockDef?.requirements?.find(r => r.id === reqId)?.type;
    }
}

function renderParentBoundary(parentNode) {
    const parentDef = appState.library[parentNode.type];
    if (!parentDef || !parentDef.requirements) return;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '20'); rect.setAttribute('y', '10');
    rect.setAttribute('width', '95%'); rect.setAttribute('height', '45');
    rect.setAttribute('class', 'parent-req-bar');
    parentLayer.appendChild(rect);

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', '35'); title.setAttribute('y', '36');
    title.setAttribute('font-size', '12'); title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#0078d4');
    title.textContent = `REQUISITI PADRE [${parentNode.label || parentNode.id}]:`;
    parentLayer.appendChild(title);

    parentDef.requirements.forEach((req, idx) => {
        const cx = 250 + (idx * 120);
        const cy = 32;
        const color = appSettings.requirements.typeColors[req.type] || "#3498db";
        const pin = createReqPin(cx, cy, color, parentNode.id, req.id, req.title || req.name, req.description, 'parent');
        parentLayer.appendChild(pin);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', cx + 12); txt.setAttribute('y', cy + 4);
        txt.setAttribute('font-size', '10'); txt.setAttribute('fill', '#333');
        txt.textContent = req.title || req.name;
        parentLayer.appendChild(txt);
    });
}

function createReqPin(cx, cy, color, ownerId, reqId, reqTitle, reqDescription, ownerType) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
    circle.setAttribute('r', appSettings.requirements.radius);
    circle.setAttribute('class', 'node-req-pin');
    circle.setAttribute('fill', color);

    const typeStr = getReqType(ownerId, reqId, ownerType);
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${reqTitle || reqId} [${typeStr}]\n${reqDescription ? reqDescription + '\n' : ''}[Shift+Drag per spostare la porta]`;
    circle.appendChild(title);

    circle.addEventListener('mousedown', (e) => {
        if (e.shiftKey) return;
        e.stopPropagation();
        isDrawingEdge = true;
        const coords = getCanvasCoords(e);
        edgeStartData = { ownerId, reqId, ownerType, x: coords.x, y: coords.y };

        tempEdgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempEdgePath.setAttribute('class', 'edge-path');
        tempEdgePath.setAttribute('stroke', color);
        tempEdgePath.style.strokeDasharray = '4,4';
        edgesLayer.appendChild(tempEdgePath);
    });

    circle.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        if (isDrawingEdge && edgeStartData) {
            const sourceType = getReqType(edgeStartData.ownerId, edgeStartData.reqId, edgeStartData.ownerType);
            const targetType = getReqType(ownerId, reqId, ownerType);

            if (sourceType !== targetType) {
                alert(`Impossibile collegare: il requisito sorgente è '${sourceType}' mentre la destinazione è '${targetType}'.`);
                cleanupEdgeDrawing();
                render();
                return;
            }

            getCurrentLevel().graph.edges.push({
                id: 'edge_' + Date.now(),
                source: edgeStartData.ownerId,
                sourceHandle: edgeStartData.reqId,
                sourceType: edgeStartData.ownerType,
                target: ownerId,
                targetHandle: reqId,
                targetType: ownerType,
                waypoints: []
            });
        }
        cleanupEdgeDrawing();
        render();
    });

    return circle;
}

export function cleanupEdgeDrawing() {
    isDrawingEdge = false; edgeStartData = null;
    if (tempEdgePath) { tempEdgePath.remove(); tempEdgePath = null; }
}

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

function getParentReqCoords(reqId) {
    const currentLevel = getCurrentLevel();
    const parentDef = appState.library[currentLevel.parentNode.type];
    const idx = parentDef?.requirements.findIndex(r => r.id === reqId);
    return { x: 250 + (idx * 120), y: 32 };
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