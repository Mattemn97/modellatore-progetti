/* --- ISPETTORE: MODIFICA DI BLOCCHI DI LIBRERIA, REQUISITI E TESTI DA ESPORTARE --- */

import { getCurrentLevel, setActiveNodeId, appState, appSettings, pathStack } from './state.js';
import { render, centraVista, evidenziaCliente, descriviEstremo, eliminaFilo, togliSelezioneFilo } from './renderer.js';
import { chiediTesto, escapeHtml, slugifyId } from './utils.js';
import {
    getTipologie, idRequisitoLibero, aggiornaRiferimentiRequisiti, getClasseRequisito, ID_CLIENTE,
    isDerivazione, isRequisitoCliente, verificaCompatibilita, titoloRequisito, classeDocumenti, documentiDellaClasse,
    motivoNonAmmesso
} from './model.js';
import {
    salvaBloccoLibreria, aggiornaPulsantiLibreria, mostraChangelog, eliminaBloccoLibreria, rinominaBloccoLibreria,
    type RispostaLibreria
} from './libreria.js';
import { trovaRequisitoCliente, contaFiliCliente, impostaSelezioneCliente } from './cliente.js';
import { rinominaSceltaGerarchia, mostraGerarchiaCliente } from './gerarchia.js';
import { iconaAiuto } from './aiuto.js';
import type { EstremoDescritto, Filo, Nodo, RequisitoCliente, RequisitoLibreria } from './tipi.js';

const propsContent = document.getElementById('propsContent') as HTMLElement;

// Id requisito: lettere, cifre, underscore, trattino e punto, senza spazi
const FORMATO_ID_REQUISITO = /^[A-Za-z0-9_.-]+$/;

// Requisito nel form: l'id che aveva all'apertura serve a riconoscere le rinomine
type RequisitoForm = RequisitoLibreria & { _idOriginale?: string };

interface DatiForm {
    isNew: boolean;
    nodeId?: string | null;
    blockId?: string;
    titolo: string;
    descrizione: string;
    categoria: string;
    sottocategoria: string;
    requisiti: RequisitoForm[];
}

function campo<T extends HTMLElement = HTMLInputElement>(id: string): T {
    return document.getElementById(id) as T;
}

export function checkLibraryDuplicates(id: string, titolo: string, currentEditingId: string | null = null): string | null {
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

function copiaRequisiti(requisiti: RequisitoLibreria[]): RequisitoForm[] {
    return (JSON.parse(JSON.stringify(requisiti)) as RequisitoLibreria[]).map((r) => ({ ...r, _idOriginale: r.id }));
}

// Un altro contenuto nel pannello toglie la selezione del filo (spec 0009, AC-1)
function lasciaFilo(): void {
    if (togliSelezioneFilo()) render();
}

export function renderNewBlockForm(): void {
    lasciaFilo();
    setActiveNodeId(null);
    renderEditorForm({
        isNew: true,
        titolo: '',
        descrizione: '',
        categoria: 'Generali',
        sottocategoria: '',
        requisiti: []
    });
}

// Apre un blocco di libreria nell'ispettore; nodeId è l'istanza sul canvas, se c'è
export function openLibraryBlock(blockId: string, nodeId: string | null = null): void {
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

export function selectNode(node: Nodo): void {
    lasciaFilo();
    setActiveNodeId(node.id);
    if (appState.library[node.type]) {
        openLibraryBlock(node.type, node.id);
    } else {
        propsContent.innerHTML = `<div class="empty-props">Il blocco "${escapeHtml(node.type)}" non è presente nella libreria caricata.</div>`;
    }
}

// <option> di una lista, mantenendo un valore attuale che non è più in elenco
function opzioni(valori: string[], selezionato: string | null, etichettaVuota?: string): string {
    const lista = [...valori];
    if (selezionato && !lista.includes(selezionato)) lista.push(selezionato);
    const vuota = etichettaVuota !== undefined
        ? `<option value="" ${!selezionato ? 'selected' : ''}>${escapeHtml(etichettaVuota)}</option>`
        : '';
    return vuota + lista.map((v) =>
        `<option value="${escapeHtml(v)}" ${v === selezionato ? 'selected' : ''}>${escapeHtml(v)}</option>`
    ).join('');
}

// Menu Documento (spec 0027): solo i documenti ammessi per la classe del requisito nel form;
// un documento già scelto e non ammesso resta in fondo, marcato, così non si perde al ridisegno
function opzioniDocumento(req: RequisitoLibreria, documento: string): string {
    const scelto = (documento || '').trim();
    const ammessi = documentiDellaClasse(classeDocumenti(req));
    const vuota = `<option value="" ${!scelto ? 'selected' : ''}>Documento...</option>`;
    const voci = ammessi.map((v) => `<option value="${escapeHtml(v)}" ${v === scelto ? 'selected' : ''}>${escapeHtml(v)}</option>`);
    if (scelto && !ammessi.includes(scelto)) {
        voci.push(`<option value="${escapeHtml(scelto)}" selected>${escapeHtml(scelto)} (non ammesso)</option>`);
    }
    return vuota + voci.join('');
}

function renderEditorForm(data: DatiForm): void {
    // Il form della libreria prende il posto del dettaglio di un requisito cliente
    impostaSelezioneCliente(null);
    evidenziaCliente(null);
    const html = `
        <div style="display:flex; flex-direction:column; gap:8px;">
            <div class="prop-item">
                <strong>Titolo Blocco${iconaAiuto('ispettore.titolo')}</strong>
                <input type="text" id="edtBlockTitolo" value="${escapeHtml(data.titolo)}" placeholder="es. Centralina Motore" style="width:100%; padding:5px; box-sizing:border-box;">
            </div>

            <div class="prop-item">
                <strong style="display:flex; justify-content:space-between;">
                    <span>${data.isNew ? 'ID Blocco Generato' : 'ID Blocco di Libreria'}${iconaAiuto('ispettore.id')}</span>
                    ${!data.isNew ? `<span style="font-weight:normal; font-size:11px; display:flex; gap:8px;">
                        <a href="#" id="lnkRinominaBlocco" data-aiuto="ispettore.rinomina">✏️ Rinomina ID</a>
                        <a href="#" id="lnkStoria" data-aiuto="ispettore.storia">📜 Storia</a>
                    </span>` : ''}
                </strong>
                <input type="text" id="edtBlockId" value="${data.isNew ? '' : escapeHtml(data.blockId)}" ${data.isNew ? 'readonly' : 'disabled'} placeholder="Generato dal titolo..." style="width:100%; padding:5px; box-sizing:border-box; background:#f0f4f8;">
            </div>

            <div class="prop-item">
                <strong>Descrizione${iconaAiuto('ispettore.descrizione')}</strong>
                <textarea id="edtBlockDescrizione" rows="2" placeholder="Cosa fa questo blocco..." style="width:100%; box-sizing:border-box; padding:5px; font-family:inherit; resize:vertical;">${escapeHtml(data.descrizione)}</textarea>
            </div>

            <div style="display:flex; gap:6px;">
                <div class="prop-item" style="flex:1;">
                    <strong>Categoria${iconaAiuto('ispettore.categoria')}</strong>
                    <input type="text" id="edtBlockCategoria" value="${escapeHtml(data.categoria)}" placeholder="es. Elettrica" style="width:100%; padding:5px; box-sizing:border-box;">
                </div>
                <div class="prop-item" style="flex:1;">
                    <strong>Sottocategoria${iconaAiuto('ispettore.sottocategoria')}</strong>
                    <input type="text" id="edtBlockSottocategoria" value="${escapeHtml(data.sottocategoria)}" placeholder="es. Controllo" style="width:100%; padding:5px; box-sizing:border-box;">
                </div>
            </div>

            <hr style="border:0; border-top:1px solid #ddd; margin:6px 0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0;">Requisiti Blocco${iconaAiuto('ispettore.requisiti')}</h4>
                <button id="btnAddReqRow" data-aiuto="ispettore.aggiungiRequisito" style="background:#0078d4; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:11px;">+ Requisito</button>
            </div>
            <div style="font-size:10px; color:#777;">Con una tipologia il requisito è di interfaccia (porta sul bordo). Senza tipologia è di capacità (pin quadrato interno).</div>
            <!-- Una sola riga di etichette con le (i) per i campi delle schede requisito (spec 0012) -->
            <div class="etichette-requisiti">
                <span>ID${iconaAiuto('ispettore.req.id')}</span><span>Titolo${iconaAiuto('ispettore.req.titolo')}</span><span>Tipologia${iconaAiuto('ispettore.req.tipologia')}</span><span>Metodo di verifica${iconaAiuto('ispettore.req.metodo')}</span><span>Documento${iconaAiuto('ispettore.req.documento')}</span><span>Testo da esportare${iconaAiuto('ispettore.req.testo')}</span>
            </div>

            <div id="reqsListContainer" style="display:flex; flex-direction:column; gap:8px; margin-top:6px;"></div>

            <hr style="border:0; border-top:1px solid #ddd; margin:8px 0;">

            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; gap:6px;">
                    <div class="prop-item" style="flex:0 0 90px;">
                        <strong>Livello${iconaAiuto('ispettore.livello')}</strong>
                        <select id="edtLivello" aria-label="Livello della versione" style="width:100%; padding:4px; box-sizing:border-box;">
                            <option value="auto" selected>Automatico</option>
                            <option value="patch">Patch</option>
                            <option value="minor">Minor</option>
                            <option value="major">Major</option>
                        </select>
                    </div>
                    <div class="prop-item" style="flex:1; min-width:0;">
                        <strong>Motivo della modifica${iconaAiuto('ispettore.motivo')}</strong>
                        <input type="text" id="edtNotaModifica" maxlength="2000" placeholder="Facoltativo, finisce nel changelog" style="width:100%; padding:5px; box-sizing:border-box;">
                    </div>
                </div>
                <button id="btnSaveBlockToLib" data-aiuto="ispettore.salva" style="background:#2ecc71; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:12px;">
                    ${data.isNew ? '💾 Salva in Libreria' : '🔄 Aggiorna Blocco di Libreria'}
                </button>

                ${!data.isNew ? `
                    <button id="btnCreateCopy" data-aiuto="ispettore.copia" style="background:#f39c12; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;">
                        📋 Salva come Nuovo Blocco Simile
                    </button>
                    <button id="btnEliminaBloccoLib" data-aiuto="ispettore.eliminaLibreria" style="background:#c0392b; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;">
                        🗑 Elimina dalla libreria
                    </button>
                ` : ''}
                ${data.nodeId ? `
                    <button id="btnDeleteNode" data-aiuto="ispettore.eliminaGrafico" style="background:#e74c3c; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;">
                        🗑️ Elimina Blocco dal Grafico
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    propsContent.innerHTML = html;
    // Sola lettura, conflitto della libreria o salvataggio in corso
    aggiornaPulsantiLibreria();

    document.getElementById('lnkStoria')?.addEventListener('click', (e) => {
        e.preventDefault();
        void mostraChangelog(data.blockId);
    });

    const titoloInput = campo('edtBlockTitolo');
    const idInput = campo('edtBlockId');

    if (data.isNew) {
        titoloInput.addEventListener('input', () => {
            idInput.value = slugifyId(titoloInput.value);
        });
    }

    const currentReqs = data.requisiti;
    const reqsContainer = campo<HTMLElement>('reqsListContainer');

    function renderReqRows(): void {
        if (currentReqs.length === 0) {
            reqsContainer.innerHTML = '<div class="empty-props">Nessun requisito definito.</div>';
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
                    ${req.testiExport.map((t, tidx) => {
                        const motivo = motivoNonAmmesso(req, t.documento);
                        return `
                        <div class="req-testo">
                            <div style="display:flex; gap:4px; align-items:center;">
                                <select data-idx="${idx}" data-tidx="${tidx}" data-campo="documento" title="Documento in cui esportare il testo" class="${motivo ? 'documento-non-ammesso' : ''}" style="flex:1; min-width:0; padding:3px; font-size:11px;">
                                    ${opzioniDocumento(req, t.documento)}
                                </select>
                                <button data-idx="${idx}" data-tidx="${tidx}" data-azione="elimina-testo" title="Elimina testo" style="color:#c0392b; border:none; background:none; cursor:pointer;">✕</button>
                            </div>
                            ${motivo ? `<div class="motivo-non-ammesso">Documento non ammesso: ${escapeHtml(motivo)}</div>` : ''}
                            <textarea data-idx="${idx}" data-tidx="${tidx}" data-campo="testo" rows="2" placeholder="Testo da esportare nel documento..." style="width:100%; box-sizing:border-box; padding:4px; font-size:11px; resize:vertical; border:1px solid #ccc; border-radius:3px; font-family:inherit;">${escapeHtml(t.testo)}</textarea>
                        </div>
                    `;
                    }).join('')}
                    <button data-idx="${idx}" data-azione="aggiungi-testo" style="align-self:flex-start; background:none; border:1px dashed #0078d4; color:#0078d4; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">+ Testo da esportare</button>
                </div>
            </div>
        `).join('');
    }

    // Un solo ascoltatore per tutti i campi dei requisiti
    reqsContainer.addEventListener('input', (e) => {
        const bersaglio = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const { idx, tidx, campo: nomeCampo } = bersaglio.dataset;
        if (idx === undefined || !nomeCampo) return;
        const req = currentReqs[Number(idx)];
        if (!req) return;
        const valore = bersaglio.value;
        const testo = tidx === undefined ? undefined : req.testiExport[Number(tidx)];
        switch (nomeCampo) {
            case 'id': req.id = valore.trim(); break;
            case 'titolo': req.titolo = valore; break;
            case 'tipologia': req.tipologia = valore || null; break;
            case 'metodoVerifica': req.metodoVerifica = valore; break;
            case 'documento': if (testo) testo.documento = valore; break;
            case 'testo': if (testo) testo.testo = valore; break;
        }
    });

    // Tipologia e documento cambiano i menu e gli avvisi dei testi (spec 0027): si ridisegna su change,
    // non su input, poi il fuoco torna sul menu appena cambiato
    reqsContainer.addEventListener('change', (e) => {
        const bersaglio = e.target as HTMLElement;
        const { idx, tidx, campo: nomeCampo } = bersaglio.dataset;
        if (nomeCampo !== 'tipologia' && nomeCampo !== 'documento') return;
        renderReqRows();
        const selettore = `[data-idx="${idx}"][data-campo="${nomeCampo}"]${tidx === undefined ? '' : `[data-tidx="${tidx}"]`}`;
        reqsContainer.querySelector<HTMLElement>(selettore)?.focus();
    });

    reqsContainer.addEventListener('click', (e) => {
        const bottone = (e.target as Element).closest<HTMLElement>('button[data-azione]');
        if (!bottone) return;
        const { idx, tidx, azione } = bottone.dataset;
        const i = Number(idx);
        const req = currentReqs[i];
        if (!req) return;
        if (azione === 'elimina-req') {
            if (!confirm(`Eliminare il requisito "${req.id}"? I collegamenti che lo usano verranno rimossi al salvataggio.`)) return;
            currentReqs.splice(i, 1);
        } else if (azione === 'aggiungi-testo') {
            req.testiExport.push({ testo: '', documento: '' });
        } else if (azione === 'elimina-testo') {
            req.testiExport.splice(Number(tidx), 1);
        }
        renderReqRows();
    });

    renderReqRows();

    function baseIdRequisiti(): string {
        return (data.isNew ? idInput.value : data.blockId) || slugifyId(titoloInput.value) || 'req';
    }

    campo<HTMLButtonElement>('btnAddReqRow').addEventListener('click', () => {
        currentReqs.push({
            id: idRequisitoLibero(appState.library, baseIdRequisiti(), currentReqs.map((r) => r.id)),
            titolo: '',
            tipologia: null,
            metodoVerifica: '',
            testiExport: [{ testo: '', documento: '' }]
        });
        renderReqRows();
    });

    function leggiCampiBlocco(): { titolo: string; descrizione: string; categoria: string; sottocategoria: string } {
        return {
            titolo: titoloInput.value.trim(),
            descrizione: campo<HTMLTextAreaElement>('edtBlockDescrizione').value.trim(),
            categoria: campo('edtBlockCategoria').value.trim() || 'Generali',
            sottocategoria: campo('edtBlockSottocategoria').value.trim()
        };
    }

    const opzioniVersione = () => ({
        livello: document.querySelector<HTMLSelectElement>('#edtLivello')?.value || 'auto',
        nota: (document.querySelector<HTMLInputElement>('#edtNotaModifica')?.value || '').trim()
    });

    // Prima il disco, poi la memoria: libreria, progetto e albero cambiano solo dopo la risposta positiva del server
    campo<HTMLButtonElement>('btnSaveBlockToLib').addEventListener('click', async () => {
        const campi = leggiCampiBlocco();
        const blockId = data.isNew ? slugifyId(campi.titolo) : data.blockId ?? '';

        if (!campi.titolo || !blockId) return alert('Inserisci un titolo valido per il blocco.');
        if (blockId === ID_CLIENTE) return alert(`L'ID "${ID_CLIENTE}" è riservato ai requisiti cliente: scegli un altro titolo.`);

        const dupErr = checkLibraryDuplicates(blockId, campi.titolo, data.isNew ? null : blockId);
        if (dupErr) return alert(dupErr);

        const requisiti: RequisitoLibreria[] = currentReqs.map(({ _idOriginale: _ignorato, ...req }) => ({
            ...req,
            titolo: req.titolo.trim(),
            // I testi lasciati completamente vuoti non vengono salvati
            testiExport: req.testiExport
                .map((t) => ({ testo: t.testo.trim(), documento: t.documento.trim() }))
                .filter((t) => t.testo || t.documento)
        }));

        const errore = validaRequisiti(requisiti, blockId);
        if (errore) return alert(errore);

        const mappaRinomina: Record<string, string> = {};
        if (!data.isNew) {
            currentReqs.forEach((r) => {
                if (r._idOriginale && r._idOriginale !== r.id) mappaRinomina[r._idOriginale] = r.id;
            });
        }

        // Chiamata dopo che la libreria su disco è stata scritta e adottata in appState.library
        const alSuccesso = (risposta: RispostaLibreria): void => {
            if (risposta.invariata) {
                alert('Nessuna modifica da salvare');
                return;
            }
            let filiRimossi = 0;
            if (!data.isNew) {
                filiRimossi = aggiornaRiferimentiRequisiti(pathStack[0]!.graph, appState.library, blockId, mappaRinomina);
                // Prima di qualunque render(): la scelta della Gerarchia segue l'id rinominato
                rinominaSceltaGerarchia(blockId, mappaRinomina);
                if (data.nodeId) {
                    const node = getCurrentLevel().graph.nodes.find((n) => n.id === data.nodeId);
                    if (node) node.label = campi.titolo;
                }
            }
            // render() fa partire anche il salvataggio automatico del progetto (0001)
            render();
            // Il form riaperto riporta Livello e Motivo ai valori predefiniti
            openLibraryBlock(blockId, data.nodeId || null);
            const fili = filiRimossi > 0
                ? ` ${filiRimossi} collegamenti rimossi perché i requisiti sono stati eliminati o non sono più compatibili.`
                : '';
            alert(risposta.voce
                ? `Blocco salvato. Libreria v${risposta.versione} (${risposta.voce.livello}).${fili}`
                : `Blocco salvato. ${risposta.avviso}.${fili}`);
        };

        const esito = await salvaBloccoLibreria({
            blocco: { id: blockId, ...campi, requisiti },
            nuovo: data.isNew,
            rinomine: mappaRinomina,
            ...opzioniVersione()
        }, alSuccesso, { blockId: data.isNew ? null : blockId, nodeId: data.nodeId || null });
        // Rifiuto o errore: il form resta aperto con i dati inseriti; il conflitto si risolve dal banner
        if (!esito.ok && !esito.conflitto) alert(`Blocco non salvato: ${esito.messaggio}`);
    });

    document.getElementById('btnCreateCopy')?.addEventListener('click', () => {
        const campi = leggiCampiBlocco();
        const titoloCopia = campi.titolo + ' Copia';
        const baseCopia = slugifyId(titoloCopia) || 'req';
        // Gli id dei requisiti sono univoci in tutta la libreria: la copia ne riceve di nuovi
        const nuoviId: string[] = [];
        const requisitiCopia = (JSON.parse(JSON.stringify(currentReqs)) as RequisitoForm[]).map(({ _idOriginale: _ignorato, ...req }) => {
            const id = idRequisitoLibero(appState.library, baseCopia, nuoviId);
            nuoviId.push(id);
            return { ...req, id };
        });

        setActiveNodeId(null);
        renderEditorForm({ isNew: true, ...campi, titolo: titoloCopia, requisiti: requisitiCopia });
        campo('edtBlockId').value = slugifyId(titoloCopia);
    });

    document.getElementById('btnDeleteNode')?.addEventListener('click', () => {
        if (data.nodeId) deleteNodeFromGraph(data.nodeId);
    });

    // Gestione completa della libreria (spec 0010)
    document.getElementById('btnEliminaBloccoLib')?.addEventListener('click', () => {
        if (data.blockId) void eliminaBlocco(data.blockId, opzioniVersione());
    });
    document.getElementById('lnkRinominaBlocco')?.addEventListener('click', (e) => {
        e.preventDefault();
        if ((e.currentTarget as HTMLElement).getAttribute('aria-disabled') === 'true' || !data.blockId) return;
        void rinominaBlocco(data.blockId, data.nodeId || null, opzioniVersione());
    });
}

/* --- ELIMINA E RINOMINA UN BLOCCO DI LIBRERIA (spec 0010) --- */

const MAX_ISTANZE_ELENCATE = 20;
const MSG_ID_NON_VALIDO = "L'ID può contenere solo lettere, cifre, underscore, trattino e punto (al massimo 200 caratteri).";

// Ogni nodo del progetto con quel tipo, a qualsiasi livello, con il percorso di etichette dalla radice
export function istanzeDelBlocco(idBlocco: string): Array<{ nodo: Nodo; percorso: string }> {
    const trovate: Array<{ nodo: Nodo; percorso: string }> = [];
    function visita(graph: { nodes?: Nodo[] } | undefined, etichette: string[]): void {
        (graph?.nodes || []).forEach((nodo) => {
            const percorso = [...etichette, nodo.label || nodo.id];
            if (nodo.type === idBlocco) trovate.push({ nodo, percorso: percorso.join(' › ') });
            if (nodo.internal_graph) visita(nodo.internal_graph, percorso);
        });
    }
    visita(pathStack[0]!.graph, [pathStack[0]!.label]);
    return trovate;
}

async function eliminaBlocco(idBlocco: string, opzioni: Record<string, unknown>): Promise<void> {
    const def = appState.library[idBlocco];
    if (!def) return;
    const titolo = def.titolo || idBlocco;
    const istanze = istanzeDelBlocco(idBlocco);
    if (istanze.length > 0) {
        const righe = istanze.slice(0, MAX_ISTANZE_ELENCATE).map((i) => `- ${i.percorso}`);
        if (istanze.length > MAX_ISTANZE_ELENCATE) righe.push(`… e altre ${istanze.length - MAX_ISTANZE_ELENCATE}`);
        alert(`Il blocco "${titolo}" è usato in ${istanze.length} istanze nel progetto e non si può eliminare. Togli prima le istanze:\n${righe.join('\n')}`);
        return;
    }
    if (!confirm(`Eliminare il blocco "${titolo}" (${idBlocco}) dalla libreria? La libreria passa a una nuova versione major; gli altri progetti che lo usano lo vedranno come blocco senza definizione.`)) return;

    const esito = await eliminaBloccoLibreria(idBlocco, opzioni, (risposta) => {
        setActiveNodeId(null);
        propsContent.innerHTML = '<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>';
        render();
        alert(risposta.voce
            ? `Blocco eliminato. Libreria v${risposta.versione} (${risposta.voce.livello}).`
            : `Blocco eliminato. ${risposta.avviso}.`);
    });
    if (!esito.ok && !esito.conflitto) alert(`Blocco non eliminato: ${esito.messaggio}`);
}

async function rinominaBlocco(idBlocco: string, nodeId: string | null, opzioni: Record<string, unknown>): Promise<void> {
    if (!appState.library[idBlocco]) return;
    const risposta = chiediTesto('Nuovo ID del blocco', idBlocco);
    if (risposta === null) return;
    const nuovoId = risposta.trim();
    if (!nuovoId || nuovoId === idBlocco) return;
    if (!FORMATO_ID_REQUISITO.test(nuovoId) || nuovoId.length > 200) {
        alert(MSG_ID_NON_VALIDO);
        return;
    }
    if (Object.keys(appState.library).some((k) => k !== idBlocco && k.toLowerCase() === nuovoId.toLowerCase())) {
        alert(`Un blocco con ID "${nuovoId}" esiste già nella libreria.`);
        return;
    }

    const esito = await rinominaBloccoLibreria(idBlocco, nuovoId, opzioni, (dati) => {
        // Disco già scritto: ora le istanze del progetto seguono il nuovo id, poi il salvataggio automatico
        const istanze = istanzeDelBlocco(idBlocco);
        istanze.forEach(({ nodo }) => { nodo.type = nuovoId; });
        render();
        openLibraryBlock(nuovoId, nodeId);
        alert(dati.voce
            ? `ID rinominato: ${idBlocco} → ${nuovoId}. ${istanze.length} istanze aggiornate. Libreria v${dati.versione} (${dati.voce.livello}).`
            : `ID rinominato: ${idBlocco} → ${nuovoId}. ${istanze.length} istanze aggiornate. ${dati.avviso}.`);
    }, { nodeId });
    if (!esito.ok && !esito.conflitto) alert(`ID non rinominato: ${esito.messaggio}`);
}

// Restituisce il primo problema trovato nei requisiti, oppure null
function validaRequisiti(requisiti: RequisitoLibreria[], blockId: string): string | null {
    const idNelBlocco = new Set<string>();
    const tipologie = getTipologie();

    for (const req of requisiti) {
        if (!req.id) return 'Ogni requisito deve avere un ID.';
        if (!FORMATO_ID_REQUISITO.test(req.id)) {
            return `L'ID "${req.id}" non è valido: usa solo lettere, cifre, underscore, trattino e punto, senza spazi.`;
        }
        if (idNelBlocco.has(req.id)) return `L'ID "${req.id}" è usato due volte in questo blocco.`;
        idNelBlocco.add(req.id);

        for (const [altroId, altro] of Object.entries(appState.library)) {
            if (altroId === blockId) continue;
            if (altro.requisiti.some((r) => r.id === req.id)) {
                return `L'ID "${req.id}" è già usato dal blocco "${altro.titolo}". Gli ID dei requisiti devono essere univoci in tutta la libreria.`;
            }
        }
        if (trovaRequisitoCliente(req.id)) {
            return `L'ID "${req.id}" è già l'id di un requisito cliente del progetto aperto: scegline un altro.`;
        }

        if (!req.titolo) return `Il requisito "${req.id}" non ha un titolo.`;
        if (req.tipologia && !tipologie.includes(req.tipologia)) {
            return `La tipologia "${req.tipologia}" del requisito "${req.id}" non è tra quelle di settings.json.`;
        }
        const senzaDocumento = req.testiExport.find((t) => !t.documento);
        if (senzaDocumento) return `Nel requisito "${req.id}" c'è un testo senza documento di riferimento.`;
        const senzaTesto = req.testiExport.find((t) => !t.testo);
        if (senzaTesto) return `Nel requisito "${req.id}" c'è un documento (${senzaTesto.documento}) senza testo.`;
    }
    // Documenti ammessi per classe (spec 0027, AC-5): dopo gli altri controlli
    for (const req of requisiti) {
        for (const t of req.testiExport) {
            const motivo = motivoNonAmmesso(req, t.documento);
            if (motivo) return `Nel requisito "${req.id}" il testo per ${t.documento.trim()} non è ammesso: ${motivo}.`;
        }
    }
    return null;
}

/* --- DETTAGLIO DI UN REQUISITO CLIENTE (SOLA LETTURA) --- */

function rigaDettaglio(etichetta: string, valore: string | null | undefined, stile = '', chiaveAiuto = ''): string {
    return `<div class="prop-item"><strong>${etichetta}${chiaveAiuto ? iconaAiuto(chiaveAiuto) : ''}</strong><div style="white-space:pre-wrap;${stile}">${escapeHtml(valore ?? '—')}</div></div>`;
}

// Aperto dalla scheda Cliente o dal clic sul blocco tondo; se il requisito è sul canvas e sei alla radice, lo centra
export function mostraDettaglioCliente(id: string | null | undefined): void {
    if (!id) return;
    const req: RequisitoCliente | null = trovaRequisitoCliente(id);
    if (!req) return;
    lasciaFilo();
    setActiveNodeId(null);
    impostaSelezioneCliente(id);

    const fili = contaFiliCliente().get(id) || 0;
    const posizione = pathStack[0]!.graph.parentReqPositions?.[id];
    const precedente = req.precedente;
    const prima = req.modificato && precedente ? `
        <div class="prop-item dettaglio-modifica"><strong>Prima e dopo l'ultimo import</strong>
            ${(['testo', 'titolo', 'tipologia'] as const).map((nome) => {
                const vecchio = precedente[nome] ?? null;
                const nuovo = req[nome] ?? null;
                if (vecchio === nuovo) return '';
                return `<div><em>${nome}</em>: <del>${escapeHtml(vecchio ?? '(vuoto)')}</del> → <ins>${escapeHtml(nuovo ?? '(vuoto)')}</ins></div>`;
            }).join('') || '<div>Tornato attivo dopo essere stato ritirato, senza cambi di testo, titolo o tipologia.</div>'}
        </div>` : '';

    propsContent.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:4px;">
            <h4 style="margin:0 0 6px;">Requisito cliente</h4>
            ${rigaDettaglio('ID del cliente', req.idCliente, 'font-family:monospace;', 'cliente.dett.idCliente')}
            ${rigaDettaglio('Id nel modello', req.id, 'font-family:monospace;', 'cliente.dett.idModello')}
            ${rigaDettaglio('Titolo', req.titolo)}
            ${rigaDettaglio('Testo', req.testo)}
            ${rigaDettaglio('Note', req.note)}
            ${rigaDettaglio('Sezione', req.sezione, '', 'cliente.dett.sezione')}
            ${rigaDettaglio('Classe', getClasseRequisito(req), '', 'cliente.dett.classe')}
            ${rigaDettaglio('Stato', `${req.stato === 'ritirato' ? 'Ritirato' : 'Attivo'}${req.modificato ? ', modificato' : ''}${posizione ? ', sul canvas' : ''}`, '', 'cliente.dett.stato')}
            ${rigaDettaglio('Fili', String(fili), '', 'cliente.dett.fili')}
            ${prima}
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
                <button id="btnGerarchiaCliente" class="pulsante-progetto" data-aiuto="cliente.dett.gerarchia">🌳 Mostra gerarchia</button>
                ${req.modificato ? '<button id="btnVistoCliente" class="pulsante-progetto" data-aiuto="cliente.dett.visto">✔ Segna come visto</button>' : ''}
                <button id="btnTogliCliente" class="pulsante-progetto" data-aiuto="cliente.dett.togli" ${posizione && fili === 0 ? '' : 'disabled'}
                    data-titolo-nativo="${posizione ? (fili > 0 ? 'Togli prima i fili che lo usano' : '') : 'Non è sul canvas'}">Togli dal canvas</button>
            </div>
        </div>`;

    document.getElementById('btnGerarchiaCliente')?.addEventListener('click', () => mostraGerarchiaCliente(id));
    document.getElementById('btnVistoCliente')?.addEventListener('click', () => {
        req.modificato = false;
        req.precedente = null;
        render();
        mostraDettaglioCliente(id);
    });
    document.getElementById('btnTogliCliente')?.addEventListener('click', () => {
        const radice = pathStack[0]!.graph;
        if ((contaFiliCliente().get(id) || 0) > 0) return;
        if (radice.parentReqPositions) delete radice.parentReqPositions[id];
        evidenziaCliente(null);
        render();
        mostraDettaglioCliente(id);
    });

    if (posizione && pathStack.length === 1) {
        centraVista(posizione.x, posizione.y);
        evidenziaCliente(id);
    } else {
        evidenziaCliente(null);
    }
    render();
}

export function deleteNodeFromGraph(nodeId: string): void {
    if (!confirm('Sei sicuro di voler eliminare questo blocco e tutti i suoi collegamenti?')) return;

    const currentGraph = getCurrentLevel().graph;
    currentGraph.nodes = currentGraph.nodes.filter((n) => n.id !== nodeId);
    currentGraph.edges = currentGraph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    setActiveNodeId(null);
    propsContent.innerHTML = '<div class="empty-props">Seleziona un blocco...</div>';
    render();
}

/* --- ISPETTORE DEI COLLEGAMENTI (spec 0009) --- */

const PANNELLO_VUOTO = '<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>';

type EstremoPresente = Exclude<EstremoDescritto, { mancante: true }>;

function bloccoEstremo(e: EstremoPresente): string {
    if (e.cliente) return 'Cliente';
    if (e.tondo) return `Blocco padre: ${e.parentNode?.label || e.parentNode?.id || ''}`;
    const etichetta = e.nodo.label || e.nodo.id;
    const titolo = e.def.titolo || e.def.id;
    return etichetta === titolo ? etichetta : `${etichetta} (${titolo})`;
}

function htmlTesti(e: EstremoPresente): string {
    const req = e.req;
    const voci = isRequisitoCliente(req)
        ? (req.testo ? [req.testo] : [])
        : (req.testiExport || []).filter((t) => String(t.testo ?? '').trim()).map((t) => `[${t.documento || '?'}] ${t.testo}`);
    const corpo = voci.length
        ? `<ul class="testi-collegamento">${voci.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>`
        : '<div>Nessun testo</div>';
    return `<div class="prop-item"><strong>Testi da esportare${iconaAiuto('coll.testi')}</strong>${corpo}</div>`;
}

function htmlLato(titolo: string, e: EstremoDescritto): string {
    if (e.mancante) {
        return `<h5 class="lato-collegamento">${titolo}</h5><div class="prop-item">Requisito non trovato: ${escapeHtml(e.reqId)}</div>`;
    }
    const req = e.req;
    return `<h5 class="lato-collegamento">${titolo}</h5>
        ${rigaDettaglio('ID', isRequisitoCliente(req) ? req.idCliente : req.id, 'font-family:monospace;')}
        ${rigaDettaglio('Titolo', titoloRequisito(req))}
        ${rigaDettaglio('Blocco', bloccoEstremo(e))}
        ${rigaDettaglio('Classe', getClasseRequisito(req), '', 'coll.classe')}
        ${isRequisitoCliente(req) ? '' : rigaDettaglio('Metodo di verifica', req.metodoVerifica || 'non definito', '', 'coll.metodo')}
        ${htmlTesti(e)}`;
}

// Dettaglio del filo del livello di adesso; il contenitore porta data-filo per riconoscerlo dopo
export function mostraDettaglioCollegamento(edge: Filo): void {
    impostaSelezioneCliente(null);
    const a: EstremoDescritto = descriviEstremo(edge.source, edge.sourceHandle, edge.sourceType);
    const b: EstremoDescritto = descriviEstremo(edge.target, edge.targetHandle, edge.targetType);
    const derivazione = isDerivazione(edge);
    const lati: Array<[string, EstremoDescritto]> = !derivazione ? [['Da', a], ['A', b]]
        : edge.sourceType === 'parent' ? [['Padre', a], ['Figlio', b]] : [['Padre', b], ['Figlio', a]];
    const motivo = !a.mancante && !b.mancante
        ? verificaCompatibilita({ ownerId: a.ownerId, reqId: a.reqId, ownerType: a.ownerType, req: a.req },
            { ownerId: b.ownerId, reqId: b.reqId, ownerType: b.ownerType, req: b.req })
        : null;

    propsContent.innerHTML = `
        <div data-filo="${escapeHtml(edge.id)}" style="display:flex; flex-direction:column; gap:4px;">
            <h4 style="margin:0 0 6px;">Collegamento</h4>
            ${rigaDettaglio('Relazione', derivazione ? 'Derivazione padre → figlio' : 'Collegamento tra blocchi', '', 'coll.relazione')}
            ${motivo ? `<div class="prop-item avviso-collegamento">⚠️ ${escapeHtml(motivo)}</div>` : ''}
            ${lati.map(([titolo, e]) => htmlLato(titolo, e)).join('')}
            <button id="btnEliminaCollegamento" class="pulsante-progetto" data-aiuto="coll.elimina" style="margin-top:8px;">🗑 Elimina collegamento</button>
        </div>`;

    document.getElementById('btnEliminaCollegamento')?.addEventListener('click', () => {
        if (!confirm('Vuoi eliminare questo collegamento?')) return;
        eliminaFilo(getCurrentLevel().graph, edge.id);
        propsContent.innerHTML = PANNELLO_VUOTO;
    });
}

function filoNelPannello(): string | null {
    return propsContent.querySelector('[data-filo]')?.getAttribute('data-filo') ?? null;
}

// Ridisegna il dettaglio solo se il pannello mostra ancora quel filo
export function aggiornaDettaglioCollegamento(edge: Filo): void {
    if (filoNelPannello() === edge.id) mostraDettaglioCollegamento(edge);
}

export function chiudiDettaglioCollegamento(edgeId: string): void {
    if (filoNelPannello() === edgeId) propsContent.innerHTML = PANNELLO_VUOTO;
}
