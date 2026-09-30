/* --- ISPETTORE: MODIFICA DI BLOCCHI DI LIBRERIA, REQUISITI E TESTI DA ESPORTARE --- */

import { getCurrentLevel, setActiveNodeId, appState, appSettings, pathStack } from './state.js';
import { render } from './renderer.js';
import { initLibrary } from './builder.js';
import { escapeHtml, slugifyId } from './utils.js';
import { getTipologie, idRequisitoLibero, aggiornaRiferimentiRequisiti } from './model.js';
import { segnaLibreriaModificata } from './progetto.js';

const propsContent = document.getElementById('propsContent');

// Id requisito: lettere, cifre, underscore, trattino e punto, senza spazi
const FORMATO_ID_REQUISITO = /^[A-Za-z0-9_.-]+$/;

export function checkLibraryDuplicates(id, titolo, currentEditingId = null) {
    const cleanId = id.trim().toLowerCase();
    const cleanTitolo = titolo.trim().toLowerCase();

    for (const [libId, block] of Object.entries(appState.library)) {
        if (currentEditingId && libId.toLowerCase() === currentEditingId.toLowerCase()) continue;

        if (libId.toLowerCase() === cleanId) {
            return `Un blocco con ID "${id}" esiste già nella libreria.`;
        }
        if (block.titolo.trim().toLowerCase() === cleanTitolo) {
            return `Un blocco con titolo "${titolo}" esiste già nella libreria.`;
        }
    }
    return null;
}

function copiaRequisiti(requisiti) {
    return JSON.parse(JSON.stringify(requisiti)).map(r => ({ ...r, _idOriginale: r.id }));
}

export function renderNewBlockForm() {
    setActiveNodeId(null);
    renderEditorForm({
        isNew: true,
        titolo: "",
        descrizione: "",
        categoria: "Generali",
        sottocategoria: "",
        requisiti: []
    });
}

// Apre un blocco di libreria nell'ispettore; nodeId è l'istanza sul canvas, se c'è
export function openLibraryBlock(blockId, nodeId = null) {
    const blockDef = appState.library[blockId];
    if (!blockDef) return;
    renderEditorForm({
        isNew: false,
        nodeId,
        blockId,
        titolo: blockDef.titolo,
        descrizione: blockDef.descrizione,
        categoria: blockDef.categoria,
        sottocategoria: blockDef.sottocategoria,
        requisiti: copiaRequisiti(blockDef.requisiti)
    });
}

export function selectNode(node) {
    setActiveNodeId(node.id);
    if (appState.library[node.type]) {
        openLibraryBlock(node.type, node.id);
    } else {
        propsContent.innerHTML = `<div class="empty-props">Il blocco "${escapeHtml(node.type)}" non è presente nella libreria caricata.</div>`;
    }
}

// <option> di una lista, mantenendo un valore attuale che non è più in elenco
function opzioni(valori, selezionato, etichettaVuota) {
    const lista = [...valori];
    if (selezionato && !lista.includes(selezionato)) lista.push(selezionato);
    const vuota = etichettaVuota !== undefined
        ? `<option value="" ${!selezionato ? 'selected' : ''}>${escapeHtml(etichettaVuota)}</option>`
        : '';
    return vuota + lista.map(v =>
        `<option value="${escapeHtml(v)}" ${v === selezionato ? 'selected' : ''}>${escapeHtml(v)}</option>`
    ).join('');
}

function renderEditorForm(data) {
    const html = `
        <div style="display:flex; flex-direction:column; gap:8px;">
            <div class="prop-item">
                <strong>Titolo Blocco</strong>
                <input type="text" id="edtBlockTitolo" value="${escapeHtml(data.titolo)}" placeholder="es. Centralina Motore" style="width:100%; padding:5px; box-sizing:border-box;">
            </div>

            <div class="prop-item">
                <strong>${data.isNew ? 'ID Blocco Generato' : 'ID Blocco di Libreria'}</strong>
                <input type="text" id="edtBlockId" value="${data.isNew ? '' : escapeHtml(data.blockId)}" ${data.isNew ? 'readonly' : 'disabled'} placeholder="Generato dal titolo..." style="width:100%; padding:5px; box-sizing:border-box; background:#f0f4f8;">
            </div>

            <div class="prop-item">
                <strong>Descrizione</strong>
                <textarea id="edtBlockDescrizione" rows="2" placeholder="Cosa fa questo blocco..." style="width:100%; box-sizing:border-box; padding:5px; font-family:inherit; resize:vertical;">${escapeHtml(data.descrizione)}</textarea>
            </div>

            <div style="display:flex; gap:6px;">
                <div class="prop-item" style="flex:1;">
                    <strong>Categoria</strong>
                    <input type="text" id="edtBlockCategoria" value="${escapeHtml(data.categoria)}" placeholder="es. Elettrica" style="width:100%; padding:5px; box-sizing:border-box;">
                </div>
                <div class="prop-item" style="flex:1;">
                    <strong>Sottocategoria</strong>
                    <input type="text" id="edtBlockSottocategoria" value="${escapeHtml(data.sottocategoria)}" placeholder="es. Controllo" style="width:100%; padding:5px; box-sizing:border-box;">
                </div>
            </div>

            <hr style="border:0; border-top:1px solid #ddd; margin:6px 0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0;">Requisiti Blocco</h4>
                <button id="btnAddReqRow" style="background:#0078d4; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:11px;">+ Requisito</button>
            </div>
            <div style="font-size:10px; color:#777;">Con una tipologia il requisito è di interfaccia (porta sul bordo). Senza tipologia è di capacità (pin quadrato interno).</div>

            <div id="reqsListContainer" style="display:flex; flex-direction:column; gap:8px; margin-top:6px;"></div>

            <hr style="border:0; border-top:1px solid #ddd; margin:8px 0;">

            <div style="display:flex; flex-direction:column; gap:6px;">
                <button id="btnSaveBlockToLib" style="background:#2ecc71; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:12px;">
                    ${data.isNew ? '💾 Salva in Libreria' : '🔄 Aggiorna Blocco di Libreria'}
                </button>

                ${!data.isNew ? `
                    <button id="btnCreateCopy" style="background:#f39c12; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;">
                        📋 Salva come Nuovo Blocco Simile
                    </button>
                ` : ''}
                ${data.nodeId ? `
                    <button id="btnDeleteNode" style="background:#e74c3c; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;">
                        🗑️ Elimina Blocco dal Grafico
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    propsContent.innerHTML = html;

    const titoloInput = document.getElementById('edtBlockTitolo');
    const idInput = document.getElementById('edtBlockId');

    if (data.isNew) {
        titoloInput.addEventListener('input', (e) => {
            idInput.value = slugifyId(e.target.value);
        });
    }

    const currentReqs = data.requisiti;
    const reqsContainer = document.getElementById('reqsListContainer');

    function renderReqRows() {
        if (currentReqs.length === 0) {
            reqsContainer.innerHTML = `<div class="empty-props">Nessun requisito definito.</div>`;
            return;
        }

        reqsContainer.innerHTML = currentReqs.map((req, idx) => `
            <div class="req-card">
                <div style="display:flex; gap:4px; align-items:center;">
                    <input type="text" data-idx="${idx}" data-campo="id" value="${escapeHtml(req.id)}" placeholder="ID univoco" title="ID univoco del requisito" style="width:90px; padding:4px; font-size:11px; font-family:monospace;">
                    <input type="text" data-idx="${idx}" data-campo="titolo" value="${escapeHtml(req.titolo)}" placeholder="Titolo requisito" style="flex:1; min-width:0; padding:4px; font-size:11px; font-weight:bold;">
                    <button data-idx="${idx}" data-azione="elimina-req" title="Elimina requisito" style="color:red; border:none; background:none; cursor:pointer; font-weight:bold;">✕</button>
                </div>
                <div style="display:flex; gap:4px;">
                    <select data-idx="${idx}" data-campo="tipologia" title="Tipologia (vuota = capacità)" style="flex:1; min-width:0; padding:3px; font-size:11px;">
                        ${opzioni(getTipologie(), req.tipologia, 'Capacità (nessuna tipologia)')}
                    </select>
                    <select data-idx="${idx}" data-campo="metodoVerifica" title="Metodo di verifica" style="flex:1; min-width:0; padding:3px; font-size:11px;">
                        ${opzioni(appSettings.metodiVerifica, req.metodoVerifica, 'Metodo di verifica...')}
                    </select>
                </div>
                <div class="req-testi">
                    ${req.testiExport.map((t, tidx) => `
                        <div class="req-testo">
                            <div style="display:flex; gap:4px; align-items:center;">
                                <select data-idx="${idx}" data-tidx="${tidx}" data-campo="documento" title="Documento in cui esportare il testo" style="flex:1; min-width:0; padding:3px; font-size:11px;">
                                    ${opzioni(appSettings.documenti, t.documento, 'Documento...')}
                                </select>
                                <button data-idx="${idx}" data-tidx="${tidx}" data-azione="elimina-testo" title="Elimina testo" style="color:#c0392b; border:none; background:none; cursor:pointer;">✕</button>
                            </div>
                            <textarea data-idx="${idx}" data-tidx="${tidx}" data-campo="testo" rows="2" placeholder="Testo da esportare nel documento..." style="width:100%; box-sizing:border-box; padding:4px; font-size:11px; resize:vertical; border:1px solid #ccc; border-radius:3px; font-family:inherit;">${escapeHtml(t.testo)}</textarea>
                        </div>
                    `).join('')}
                    <button data-idx="${idx}" data-azione="aggiungi-testo" style="align-self:flex-start; background:none; border:1px dashed #0078d4; color:#0078d4; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">+ Testo da esportare</button>
                </div>
            </div>
        `).join('');
    }

    // Un solo ascoltatore per tutti i campi dei requisiti
    reqsContainer.addEventListener('input', (e) => {
        const { idx, tidx, campo } = e.target.dataset;
        if (idx === undefined || !campo) return;
        const req = currentReqs[idx];
        const valore = e.target.value;
        switch (campo) {
            case 'id': req.id = valore.trim(); break;
            case 'titolo': req.titolo = valore; break;
            case 'tipologia': req.tipologia = valore || null; break;
            case 'metodoVerifica': req.metodoVerifica = valore; break;
            case 'documento': req.testiExport[tidx].documento = valore; break;
            case 'testo': req.testiExport[tidx].testo = valore; break;
        }
    });

    reqsContainer.addEventListener('click', (e) => {
        const bottone = e.target.closest('button[data-azione]');
        if (!bottone) return;
        const { idx, tidx, azione } = bottone.dataset;
        if (azione === 'elimina-req') {
            const req = currentReqs[idx];
            if (!confirm(`Eliminare il requisito "${req.id}"? I collegamenti che lo usano verranno rimossi al salvataggio.`)) return;
            currentReqs.splice(idx, 1);
        } else if (azione === 'aggiungi-testo') {
            currentReqs[idx].testiExport.push({ testo: '', documento: '' });
        } else if (azione === 'elimina-testo') {
            currentReqs[idx].testiExport.splice(tidx, 1);
        }
        renderReqRows();
    });

    renderReqRows();

    function baseIdRequisiti() {
        return (data.isNew ? idInput.value : data.blockId) || slugifyId(titoloInput.value) || 'req';
    }

    document.getElementById('btnAddReqRow').addEventListener('click', () => {
        currentReqs.push({
            id: idRequisitoLibero(appState.library, baseIdRequisiti(), currentReqs.map(r => r.id)),
            titolo: '',
            tipologia: null,
            metodoVerifica: '',
            testiExport: [{ testo: '', documento: '' }]
        });
        renderReqRows();
    });

    function leggiCampiBlocco() {
        return {
            titolo: titoloInput.value.trim(),
            descrizione: document.getElementById('edtBlockDescrizione').value.trim(),
            categoria: document.getElementById('edtBlockCategoria').value.trim() || 'Generali',
            sottocategoria: document.getElementById('edtBlockSottocategoria').value.trim()
        };
    }

    document.getElementById('btnSaveBlockToLib').addEventListener('click', () => {
        const campi = leggiCampiBlocco();
        const blockId = data.isNew ? slugifyId(campi.titolo) : data.blockId;

        if (!campi.titolo || !blockId) return alert("Inserisci un titolo valido per il blocco.");

        const dupErr = checkLibraryDuplicates(blockId, campi.titolo, data.isNew ? null : blockId);
        if (dupErr) return alert(dupErr);

        const requisiti = currentReqs.map(({ _idOriginale, ...req }) => ({
            ...req,
            titolo: req.titolo.trim(),
            // I testi lasciati completamente vuoti non vengono salvati
            testiExport: req.testiExport
                .map(t => ({ testo: t.testo.trim(), documento: t.documento }))
                .filter(t => t.testo || t.documento)
        }));

        const errore = validaRequisiti(requisiti, blockId);
        if (errore) return alert(errore);

        appState.library[blockId] = { id: blockId, ...campi, requisiti };
        segnaLibreriaModificata();

        let filiRimossi = 0;
        if (!data.isNew) {
            const mappaRinomina = {};
            currentReqs.forEach(r => {
                if (r._idOriginale && r._idOriginale !== r.id) mappaRinomina[r._idOriginale] = r.id;
            });
            filiRimossi = aggiornaRiferimentiRequisiti(pathStack[0].graph, appState.library, blockId, mappaRinomina);

            if (data.nodeId) {
                const node = getCurrentLevel().graph.nodes.find(n => n.id === data.nodeId);
                if (node) node.label = campi.titolo;
            }
        }

        initLibrary();
        render();
        openLibraryBlock(blockId, data.nodeId || null);
        alert(filiRimossi > 0
            ? `Blocco salvato. ${filiRimossi} collegamenti rimossi perché i requisiti sono stati eliminati o non sono più compatibili.`
            : "Blocco salvato con successo!");
    });

    document.getElementById('btnCreateCopy')?.addEventListener('click', () => {
        const campi = leggiCampiBlocco();
        const titoloCopia = campi.titolo + " Copia";
        const baseCopia = slugifyId(titoloCopia) || 'req';
        // Gli id dei requisiti sono univoci in tutta la libreria: la copia ne riceve di nuovi
        const nuoviId = [];
        const requisitiCopia = JSON.parse(JSON.stringify(currentReqs)).map(({ _idOriginale, ...req }) => {
            const id = idRequisitoLibero(appState.library, baseCopia, nuoviId);
            nuoviId.push(id);
            return { ...req, id };
        });

        setActiveNodeId(null);
        renderEditorForm({ isNew: true, ...campi, titolo: titoloCopia, requisiti: requisitiCopia });
        document.getElementById('edtBlockId').value = slugifyId(titoloCopia);
    });

    document.getElementById('btnDeleteNode')?.addEventListener('click', () => {
        if (data.nodeId) deleteNodeFromGraph(data.nodeId);
    });
}

// Restituisce il primo problema trovato nei requisiti, oppure null
function validaRequisiti(requisiti, blockId) {
    const idNelBlocco = new Set();
    const tipologie = getTipologie();

    for (const req of requisiti) {
        if (!req.id) return "Ogni requisito deve avere un ID.";
        if (!FORMATO_ID_REQUISITO.test(req.id)) {
            return `L'ID "${req.id}" non è valido: usa solo lettere, cifre, underscore, trattino e punto, senza spazi.`;
        }
        if (idNelBlocco.has(req.id)) return `L'ID "${req.id}" è usato due volte in questo blocco.`;
        idNelBlocco.add(req.id);

        for (const [altroId, altro] of Object.entries(appState.library)) {
            if (altroId === blockId) continue;
            if (altro.requisiti.some(r => r.id === req.id)) {
                return `L'ID "${req.id}" è già usato dal blocco "${altro.titolo}". Gli ID dei requisiti devono essere univoci in tutta la libreria.`;
            }
        }

        if (!req.titolo) return `Il requisito "${req.id}" non ha un titolo.`;
        if (req.tipologia && !tipologie.includes(req.tipologia)) {
            return `La tipologia "${req.tipologia}" del requisito "${req.id}" non è tra quelle di settings.json.`;
        }
        const senzaDocumento = req.testiExport.find(t => !t.documento);
        if (senzaDocumento) return `Nel requisito "${req.id}" c'è un testo senza documento di riferimento.`;
        const senzaTesto = req.testiExport.find(t => !t.testo);
        if (senzaTesto) return `Nel requisito "${req.id}" c'è un documento (${senzaTesto.documento}) senza testo.`;
    }
    return null;
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
