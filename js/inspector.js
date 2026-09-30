/* --- ISPETTORE, EDITING REQUISITI E CONFERMA CANCELLAZIONE --- */

import { getCurrentLevel, setActiveNodeId, appState } from './state.js';
import { render } from './renderer.js';
import { initLibrary } from './builder.js';

const propsContent = document.getElementById('propsContent');

function slugifyId(text) {
    return text.toLowerCase().trim().replace(/\s+/g, '_');
}

export function checkLibraryDuplicates(id, label, currentEditingId = null) {
    const cleanId = id.trim().toLowerCase();
    const cleanLabel = label.trim().toLowerCase();

    for (const [libId, block] of Object.entries(appState.library)) {
        if (currentEditingId && libId.toLowerCase() === currentEditingId.toLowerCase()) continue;

        if (libId.toLowerCase() === cleanId) {
            return `Un blocco con ID "${id}" esiste già nella libreria.`;
        }
        if (block.name.trim().toLowerCase() === cleanLabel) {
            return `Un blocco con Etichetta/Nome "${label}" esiste già nella libreria.`;
        }
    }
    return null;
}

export function renderNewBlockForm() {
    setActiveNodeId(null);
    renderEditorForm({
        isNew: true,
        id: "",
        label: "",
        category: "Generali",
        requirements: []
    });
}

export function selectNode(node) {
    setActiveNodeId(node.id);
    const blockDef = appState.library[node.type] || { name: node.label || node.id, requirements: [] };
    
    renderEditorForm({
        isNew: false,
        nodeId: node.id,
        typeId: node.type,
        label: node.label || blockDef.name,
        category: blockDef.category || "Generali",
        requirements: JSON.parse(JSON.stringify(blockDef.requirements || []))
    });
}

function renderEditorForm(data) {
    let html = `
        <div style="display:flex; flex-direction:column; gap:8px;">
            <div class="prop-item">
                <strong>Etichetta / Nome Blocco</strong>
                <input type="text" id="edtBlockLabel" value="${data.label}" placeholder="es. Centralina Motore" style="width:100%; padding:5px; box-sizing:border-box;">
            </div>

            <div class="prop-item">
                <strong>${data.isNew ? 'ID Blocco Generato' : 'ID Modello Libreria'}</strong>
                <input type="text" id="edtBlockId" value="${data.isNew ? '' : data.typeId}" ${data.isNew ? 'readonly' : 'disabled'} placeholder="Generato automaticamente..." style="width:100%; padding:5px; box-sizing:border-box; background:#f0f4f8;">
            </div>

            <div class="prop-item">
                <strong>Categoria</strong>
                <input type="text" id="edtBlockCategory" value="${data.category}" placeholder="es. Elettrica/Controllo" style="width:100%; padding:5px; box-sizing:border-box;">
            </div>

            <hr style="border:0; border-top:1px solid #ddd; margin:6px 0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0;">Requisiti Blocco</h4>
                <button id="btnAddReqRow" style="background:#0078d4; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:11px;">+ Requisito</button>
            </div>

            <div id="reqsListContainer" style="display:flex; flex-direction:column; gap:8px; margin-top:6px;"></div>

            <hr style="border:0; border-top:1px solid #ddd; margin:8px 0;">

            <div style="display:flex; flex-direction:column; gap:6px;">
                <button id="btnSaveBlockToLib" style="background:#2ecc71; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:12px;">
                    ${data.isNew ? '💾 Salva in Libreria' : '🔄 Aggiorna Modello & Istanza'}
                </button>

                ${!data.isNew ? `
                    <button id="btnCreateCopy" style="background:#f39c12; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;">
                        📋 Salva come Nuovo Blocco Simile
                    </button>
                    <button id="btnDeleteNode" style="background:#e74c3c; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;">
                        🗑️ Elimina Blocco dal Grafico
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    propsContent.innerHTML = html;

    const labelInput = document.getElementById('edtBlockLabel');
    const idInput = document.getElementById('edtBlockId');

    if (data.isNew && labelInput && idInput) {
        labelInput.addEventListener('input', (e) => {
            idInput.value = slugifyId(e.target.value);
        });
    }

    let currentReqs = data.requirements;
    const reqsContainer = document.getElementById('reqsListContainer');

    function renderReqRows() {
        reqsContainer.innerHTML = '';
        if (currentReqs.length === 0) {
            reqsContainer.innerHTML = `<div class="empty-props">Nessun requisito definito.</div>`;
            return;
        }

        currentReqs.forEach((req, idx) => {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; flex-direction:column; gap:4px; background:#f0f4f8; padding:6px; border-radius:4px; border:1px solid #d0d7de;";
            row.innerHTML = `
                <div style="display:flex; gap:4px; align-items:center;">
                    <input type="text" class="req-title-input" data-idx="${idx}" value="${req.title || req.name || ''}" placeholder="Titolo Requisito" style="flex:1; padding:4px; font-size:11px; font-weight:bold;">
                    <select class="req-type-select" data-idx="${idx}" style="padding:4px; font-size:11px;">
                        <option value="Elettrica" ${req.type === 'Elettrica' ? 'selected' : ''}>Elettrica</option>
                        <option value="Segnale" ${req.type === 'Segnale' ? 'selected' : ''}>Segnale</option>
                        <option value="Meccanica" ${req.type === 'Meccanica' ? 'selected' : ''}>Meccanica</option>
                        <option value="Fluidica" ${req.type === 'Fluidica' ? 'selected' : ''}>Fluidica</option>
                    </select>
                    <button class="btn-del-req" data-idx="${idx}" style="color:red; border:none; background:none; cursor:pointer; font-weight:bold;">✕</button>
                </div>
                <textarea class="req-desc-input" data-idx="${idx}" placeholder="Descrizione estesa del requisito..." rows="2" style="width:100%; box-sizing:border-box; padding:4px; font-size:11px; resize:vertical; border:1px solid #ccc; border-radius:3px; font-family:inherit;">${req.description || ''}</textarea>
            `;
            reqsContainer.appendChild(row);
        });

        reqsContainer.querySelectorAll('.req-title-input').forEach(inp => {
            inp.addEventListener('input', (e) => { currentReqs[e.target.dataset.idx].title = e.target.value; });
        });
        reqsContainer.querySelectorAll('.req-desc-input').forEach(txt => {
            txt.addEventListener('input', (e) => { currentReqs[e.target.dataset.idx].description = e.target.value; });
        });
        reqsContainer.querySelectorAll('.req-type-select').forEach(sel => {
            sel.addEventListener('change', (e) => { currentReqs[e.target.dataset.idx].type = e.target.value; });
        });
        reqsContainer.querySelectorAll('.btn-del-req').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentReqs.splice(e.target.dataset.idx, 1);
                renderReqRows();
            });
        });
    }

    renderReqRows();

    document.getElementById('btnAddReqRow').addEventListener('click', () => {
        currentReqs.push({ 
            id: 'req_' + Date.now() + '_' + Math.floor(Math.random()*100), 
            title: 'NUOVO REQUISITO', 
            description: '', 
            type: 'Elettrica' 
        });
        renderReqRows();
    });

    document.getElementById('btnSaveBlockToLib').addEventListener('click', () => {
        const newLabel = document.getElementById('edtBlockLabel').value.trim();
        const newId = data.isNew ? slugifyId(newLabel) : document.getElementById('edtBlockId').value.trim();
        const newCategory = document.getElementById('edtBlockCategory').value.trim() || 'Generali';

        if (!newId || !newLabel) return alert("Inserisci un Nome valido per il blocco!");

        if (data.isNew) {
            const dupErr = checkLibraryDuplicates(newId, newLabel);
            if (dupErr) return alert(dupErr);
        }

        appState.library[newId] = {
            name: newLabel,
            category: newCategory,
            requirements: currentReqs
        };

        if (!data.isNew && data.nodeId) {
            const currentGraph = getCurrentLevel().graph;
            const node = currentGraph.nodes.find(n => n.id === data.nodeId);
            if (node) node.label = newLabel;
        }

        initLibrary();
        render();
        alert("Blocco salvato con successo!");
    });

    document.getElementById('btnCreateCopy')?.addEventListener('click', () => {
        const copyLabel = document.getElementById('edtBlockLabel').value.trim() + " Copia";
        const copyId = slugifyId(copyLabel);

        renderEditorForm({
            isNew: true,
            id: copyId,
            label: copyLabel,
            category: document.getElementById('edtBlockCategory').value.trim(),
            requirements: JSON.parse(JSON.stringify(currentReqs))
        });
    });

    document.getElementById('btnDeleteNode')?.addEventListener('click', () => {
        if (data.nodeId) deleteNodeFromGraph(data.nodeId);
    });
}

export function deleteNodeFromGraph(nodeId) {
    if (!confirm("Sei sicuro di voler eliminare questo blocco e tutti i suoi collegamenti?")) return;

    const currentGraph = getCurrentLevel().graph;
    currentGraph.nodes = currentGraph.nodes.filter(n => n.id !== nodeId);
    currentGraph.edges = currentGraph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    setActiveNodeId(null);
    propsContent.innerHTML = `<div class="empty-props">Seleziona un blocco...</div>`;
    render();
}