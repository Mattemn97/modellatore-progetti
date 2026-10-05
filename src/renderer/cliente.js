/* --- REQUISITI CLIENTE: IMPORT DA EXCEL O CSV, CONFRONTO COL PRECEDENTE, SCHEDA CLIENTE E CONTROLLI ALL'APERTURA --- */

// Formato in appState.cliente e nel file del progetto (spec 0003):
// { prefisso, requisiti: [{ id, idCliente, testo, titolo, note, sezione, tipologia,
//                           stato: 'attivo' | 'ritirato', modificato, precedente }], ultimoImport }
// Alla radice i requisiti cliente sono i blocchi tondi del padre virtuale ID_CLIENTE.

import { appState, appSettings, pathStack } from './state.js';
import { render, posizioneInColonna } from './renderer.js';
import { chiamaApi, svuota, progettoAperto, progettoInConflitto } from './progetto.js';
import { mostraDettaglioCliente } from './inspector.js';
import { verificaCompatibilita, getTipologie, getColoreRequisito, titoloRequisito } from './model.js';
import { escapeHtml } from './utils.js';
import { iconaAiuto } from './aiuto.js';
import { aggiornaSchedaCoerenza } from './coerenza.js';
import { aggiornaSchedaGerarchia } from './gerarchia.js';

// Campi mappabili sulle colonne del file, nell'ordine della finestra di import
const CAMPI = [
    { chiave: 'id', etichetta: 'ID', obbligatorio: true },
    { chiave: 'testo', etichetta: 'Testo', obbligatorio: true },
    { chiave: 'titolo', etichetta: 'Titolo' },
    { chiave: 'note', etichetta: 'Note' },
    { chiave: 'sezione', etichetta: 'Sezione' },
    { chiave: 'tipologia', etichetta: 'Tipologia' }
];
// I campi il cui cambiamento accende "modificato"; note e sezione si aggiornano in silenzio
const CAMPI_CONFRONTO = ['testo', 'titolo', 'tipologia'];
const ATTESA_RICERCA = 200;

/* --- FORMA DEI DATI SALVATI --- */

// Primo problema della chiave cliente di un file progetto, oppure null. Assente o null = nessun requisito cliente
export function problemaCliente(cliente) {
    if (cliente === undefined || cliente === null) return null;
    if (typeof cliente !== 'object' || Array.isArray(cliente)) return 'la chiave "cliente" non è un oggetto';
    if (typeof cliente.prefisso !== 'string' || !cliente.prefisso) return 'manca il prefisso dei requisiti cliente';
    if (!Array.isArray(cliente.requisiti)) return 'i requisiti cliente non sono un elenco';
    const ids = new Set();
    const idsCliente = new Set();
    for (const r of cliente.requisiti) {
        if (!r || typeof r !== 'object') return 'un requisito cliente non è un oggetto';
        if (typeof r.idCliente !== 'string' || !r.idCliente) return 'un requisito cliente non ha l\'ID del cliente';
        if (r.id !== cliente.prefisso + r.idCliente) return `l'id "${r.id}" non è il prefisso più l'ID del cliente "${r.idCliente}"`;
        if (typeof r.testo !== 'string' || !r.testo) return `il requisito cliente "${r.idCliente}" non ha testo`;
        for (const campo of ['titolo', 'note', 'sezione', 'tipologia']) {
            if (r[campo] !== undefined && r[campo] !== null && typeof r[campo] !== 'string') {
                return `il campo ${campo} del requisito cliente "${r.idCliente}" non è un testo`;
            }
        }
        if (r.stato !== 'attivo' && r.stato !== 'ritirato') return `il requisito cliente "${r.idCliente}" ha uno stato sconosciuto`;
        if (ids.has(r.id) || idsCliente.has(r.idCliente)) return `l'ID del cliente "${r.idCliente}" compare due volte`;
        ids.add(r.id);
        idsCliente.add(r.idCliente);
    }
    return null;
}

// Completa i campi facoltativi (già validati con problemaCliente), così la sola apertura non genera salvataggi
export function completaCliente(cliente) {
    if (!cliente) return null;
    cliente.requisiti.forEach(r => {
        ['titolo', 'note', 'sezione', 'tipologia'].forEach(campo => { if (r[campo] === undefined || r[campo] === '') r[campo] = null; });
        r.modificato = r.modificato === true;
        if (!r.modificato || !r.precedente || typeof r.precedente !== 'object') {
            r.precedente = r.modificato ? { testo: r.testo, titolo: r.titolo, tipologia: r.tipologia } : null;
        }
    });
    if (cliente.ultimoImport === undefined) cliente.ultimoImport = null;
    return cliente;
}

/* --- CONTEGGI SUL MODELLO --- */

// id cliente → numero di fili della radice che lo usano
export function contaFiliCliente() {
    const conteggi = new Map();
    pathStack[0].graph.edges.forEach(edge => {
        if (edge.sourceType === 'parent') conteggi.set(edge.sourceHandle, (conteggi.get(edge.sourceHandle) || 0) + 1);
        if (edge.targetType === 'parent') conteggi.set(edge.targetHandle, (conteggi.get(edge.targetHandle) || 0) + 1);
    });
    return conteggi;
}

export function trovaRequisitoCliente(id) {
    return appState.cliente?.requisiti.find(r => r.id === id) || null;
}

function idLibreria(library) {
    const ids = new Set();
    Object.values(library).forEach(b => b.requisiti.forEach(r => ids.add(r.id)));
    return ids;
}

/* --- CONTROLLI ALL'APERTURA --- */

// Fili verso id cliente che non esistono più: rimossi. Fili senza posizione del blocco tondo: posizione in colonna.
// Id cliente uguali a id della libreria: avviso. Restituisce { cambiato, avviso }
export function controllaClienteAllApertura() {
    const radice = pathStack[0].graph;
    const esistenti = new Set((appState.cliente?.requisiti || []).map(r => r.id));
    const orfano = (tipo, handle) => tipo === 'parent' && !esistenti.has(handle);
    const prima = radice.edges.length;
    radice.edges = radice.edges.filter(e => !orfano(e.sourceType, e.sourceHandle) && !orfano(e.targetType, e.targetHandle));
    let cambiato = radice.edges.length !== prima;

    if (!radice.parentReqPositions) radice.parentReqPositions = {};
    const posizioni = radice.parentReqPositions;
    const senzaPosizione = new Set();
    radice.edges.forEach(e => {
        if (e.sourceType === 'parent' && !posizioni[e.sourceHandle]) senzaPosizione.add(e.sourceHandle);
        if (e.targetType === 'parent' && !posizioni[e.targetHandle]) senzaPosizione.add(e.targetHandle);
    });
    if (senzaPosizione.size > 0) {
        const occupati = new Set(Object.values(posizioni).map(p => `${p.x},${p.y}`));
        let idx = 0;
        senzaPosizione.forEach(id => {
            let pos = posizioneInColonna(idx);
            while (occupati.has(`${pos.x},${pos.y}`)) pos = posizioneInColonna(++idx);
            posizioni[id] = pos;
            occupati.add(`${pos.x},${pos.y}`);
        });
        cambiato = true;
    }

    const libreria = idLibreria(appState.library);
    const collisioni = (appState.cliente?.requisiti || []).filter(r => libreria.has(r.id)).map(r => r.id);
    const avviso = collisioni.length > 0
        ? `Questi id dei requisiti cliente coincidono con id della libreria aperta: ${collisioni.join(', ')}`
        : '';
    return { cambiato, avviso };
}

/* --- LETTURA DEL FILE --- */

function comeBase64(file) {
    return new Promise((risolvi, rifiuta) => {
        const lettore = new FileReader();
        lettore.onload = () => risolvi(String(lettore.result).split(',')[1] || '');
        lettore.onerror = () => rifiuta(lettore.error);
        lettore.readAsDataURL(file);
    });
}

// Restituisce { ok, dati: { formato, fogli } } oppure { ok: false, messaggio }
export async function leggiFileCliente(file) {
    const max = appSettings.cliente.maxFileMB;
    if (file.size > max * 1048576) {
        return { ok: false, messaggio: `Il file supera il limite di ${max} MB (cliente.maxFileMB in settings.json).` };
    }
    if (file.size === 0) return { ok: false, messaggio: 'Il file è vuoto.' };
    let contenuto;
    try {
        contenuto = await comeBase64(file);
    } catch (err) {
        return { ok: false, messaggio: `Impossibile leggere il file: ${err?.message || err}` };
    }
    const r = await chiamaApi('POST', '/api/cliente/leggi', { nomeFile: file.name, contenuto });
    if (!r.ok) {
        return { ok: false, messaggio: r.stato === 0 ? "Server non raggiungibile: avvia l'app con start.py." : r.messaggio };
    }
    return { ok: true, dati: r.dati };
}

/* --- COLONNE, RIGHE E VALIDAZIONE --- */

export function letteraColonna(indice) {
    let lettere = '';
    for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
        lettere = String.fromCharCode(65 + ((n - 1) % 26)) + lettere;
    }
    return lettere;
}

// Colonne del foglio viste dalla riga di intestazione (da 1): [{ indice, lettera, nome }]
function colonneDelFoglio(foglio, rigaIntestazione) {
    const larghezza = foglio.righe.reduce((max, riga) => Math.max(max, riga.length), 0);
    const intestazione = foglio.righe[rigaIntestazione - 1] || [];
    return Array.from({ length: larghezza }, (_, indice) => ({
        indice,
        lettera: letteraColonna(indice),
        nome: String(intestazione[indice] ?? '').trim()
    }));
}

// Colonna proposta per un riferimento { nome, lettera }: per nome se unico nella riga, altrimenti per lettera
function trovaColonna(colonne, riferimento) {
    if (!riferimento) return null;
    const perNome = riferimento.nome ? colonne.filter(c => c.nome === riferimento.nome) : [];
    if (perNome.length === 1) return perNome[0].indice;
    return colonne.find(c => c.lettera === riferimento.lettera)?.indice ?? null;
}

// Righe dati sotto l'intestazione, mappate sui campi; le righe del tutto vuote sono ignorate
export function estraiRighe(foglio, rigaIntestazione, colonne) {
    const righe = [];
    for (let i = rigaIntestazione; i < foglio.righe.length; i++) {
        const celle = foglio.righe[i];
        if (!celle.some(c => String(c ?? '').trim() !== '')) continue;
        const valore = chiave => {
            const indice = colonne[chiave];
            if (indice === null || indice === undefined) return null;
            return String(celle[indice] ?? '').trim() || null;
        };
        righe.push({
            riga: i + 1,
            idCliente: valore('id'),
            testo: valore('testo'),
            titolo: valore('titolo'),
            note: valore('note'),
            sezione: valore('sezione'),
            tipologia: valore('tipologia')
        });
    }
    return righe;
}

// Scarta una riga per il primo motivo che vale: ID vuoto, testo vuoto, tipologia sconosciuta, ID ripetuto, id della libreria
export function validaRighe(righe, prefisso, library) {
    const tipologie = new Map(getTipologie().map(t => [t.toLowerCase(), t]));
    const libreria = idLibreria(library);
    const ripetizioni = new Map();
    righe.forEach(r => { if (r.idCliente) ripetizioni.set(r.idCliente, (ripetizioni.get(r.idCliente) || 0) + 1); });

    const valide = [];
    const scartate = [];
    righe.forEach(r => {
        let motivo = null;
        if (!r.idCliente) motivo = 'ID vuoto';
        else if (!r.testo) motivo = 'Testo vuoto';
        else if (r.tipologia && !tipologie.has(r.tipologia.toLowerCase())) {
            motivo = `Tipologia "${r.tipologia}" sconosciuta (ammesse: ${getTipologie().join(', ')}; vuota = capacità)`;
        } else if (ripetizioni.get(r.idCliente) > 1) motivo = `ID ripetuto ${ripetizioni.get(r.idCliente)} volte nel file`;
        else if (libreria.has(prefisso + r.idCliente)) motivo = `L'id "${prefisso + r.idCliente}" è già un requisito della libreria`;

        if (motivo) scartate.push({ riga: r.riga, idCliente: r.idCliente || '', motivo });
        else valide.push({ ...r, tipologia: r.tipologia ? tipologie.get(r.tipologia.toLowerCase()) : null });
    });
    return { valide, scartate };
}

/* --- CONFRONTO CON L'IMPORT PRECEDENTE (FUNZIONE PURA) --- */

// Nuovo elenco dei requisiti cliente, conteggi, liste per le schede dell'anteprima e id dei fili che si perdono.
// L'anteprima la chiama a ogni cambio; la conferma applica esattamente il suo risultato
export function calcolaImport(cliente, valide, modalita, prefisso, workspace, library = appState.library) {
    const esistenti = cliente?.requisiti || [];
    const perIdCliente = new Map(esistenti.map(r => [r.idCliente, r]));
    const nelFile = new Set();
    const requisiti = [];
    const liste = { modificati: [], ritirati: [], nuovi: [] };
    const conteggi = { nuovi: 0, modificati: 0, riattivati: 0, ritirati: 0, invariati: 0, scartati: 0, filiPersi: 0 };
    const tipologiaCambiata = new Set();

    valide.forEach(v => {
        nelFile.add(v.idCliente);
        const vecchio = perIdCliente.get(v.idCliente);
        const valori = { testo: v.testo, titolo: v.titolo, tipologia: v.tipologia };
        if (!vecchio) {
            const nuovo = {
                id: prefisso + v.idCliente, idCliente: v.idCliente, ...valori, note: v.note, sezione: v.sezione,
                stato: 'attivo', modificato: false, precedente: null
            };
            requisiti.push(nuovo);
            liste.nuovi.push(nuovo);
            conteggi.nuovi++;
            return;
        }
        const cambiato = CAMPI_CONFRONTO.some(c => (vecchio[c] ?? null) !== (valori[c] ?? null));
        const riattivato = vecchio.stato === 'ritirato';
        const aggiornato = { ...vecchio, ...valori, note: v.note, sezione: v.sezione, stato: 'attivo' };
        if (riattivato || cambiato) {
            aggiornato.modificato = true;
            // precedente conserva i valori più vecchi non ancora visti
            aggiornato.precedente = vecchio.precedente ?? { testo: vecchio.testo, titolo: vecchio.titolo, tipologia: vecchio.tipologia };
        }
        if (riattivato) conteggi.riattivati++;
        else if (cambiato) {
            conteggi.modificati++;
            liste.modificati.push({ prima: vecchio, dopo: aggiornato });
        } else conteggi.invariati++;
        if ((vecchio.tipologia ?? null) !== (aggiornato.tipologia ?? null)) tipologiaCambiata.add(aggiornato.id);
        requisiti.push(aggiornato);
    });

    // Chi manca nel file va in coda, nel suo ordine: con Sostituisci gli attivi diventano ritirati
    esistenti.forEach(r => {
        if (nelFile.has(r.idCliente)) return;
        if (modalita === 'sostituisci' && r.stato === 'attivo') {
            const ritirato = { ...r, stato: 'ritirato' };
            requisiti.push(ritirato);
            liste.ritirati.push(ritirato);
            conteggi.ritirati++;
        } else {
            requisiti.push(r);
        }
    });

    // Fili della radice con un estremo cliente la cui tipologia cambia, rivalutati con le regole di oggi
    const filiPersi = [];
    if (tipologiaCambiata.size > 0) {
        const perId = new Map(requisiti.map(r => [r.id, r]));
        const nodi = new Map(workspace.nodes.map(n => [n.id, n]));
        const estremo = (ownerId, reqId, ownerType) => ({
            ownerId, reqId, ownerType,
            req: ownerType === 'parent'
                ? perId.get(reqId) || null
                : library[nodi.get(ownerId)?.type]?.requisiti.find(r => r.id === reqId) || null
        });
        workspace.edges.forEach(edge => {
            const tocca = (edge.sourceType === 'parent' && tipologiaCambiata.has(edge.sourceHandle)) ||
                          (edge.targetType === 'parent' && tipologiaCambiata.has(edge.targetHandle));
            if (!tocca) return;
            const a = estremo(edge.source, edge.sourceHandle, edge.sourceType);
            const b = estremo(edge.target, edge.targetHandle, edge.targetType);
            // Un blocco che la libreria non conosce non si può valutare: il filo resta
            if (!a.req || !b.req) return;
            if (verificaCompatibilita(a, b)) filiPersi.push(edge.id);
        });
    }
    conteggi.filiPersi = filiPersi.length;
    return { requisiti, conteggi, liste, filiPersi };
}

// Un import è un solo passo di Annulla: prima si salva quanto in attesa, poi si cambia il modello e si salva subito
async function applicaImport(risultato, prefisso, ultimoImport) {
    if (!await svuota()) return false;
    const radice = pathStack[0].graph;
    const persi = new Set(risultato.filiPersi);
    if (persi.size > 0) radice.edges = radice.edges.filter(e => !persi.has(e.id));
    appState.cliente = { prefisso, requisiti: risultato.requisiti, ultimoImport };
    render();
    await svuota();
    return true;
}

/* --- FINESTRA DI IMPORT --- */

const modale = document.getElementById('importClienteModal');
const contenutoModale = document.getElementById('importClienteContenuto');

// Stato della finestra: file letto, foglio, riga di intestazione, colonne, modalità e ultimo risultato
let imp = null;

function chiudiImport() {
    imp = null;
    if (modale) modale.style.display = 'none';
}

export function importClienteAperto() {
    return !!modale && modale.style.display !== 'none';
}

function prefissoInUso() {
    return appState.cliente?.prefisso || appSettings.cliente.prefisso;
}

function scegliFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xlsm,.csv';
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const esito = await leggiFileCliente(file);
        if (!esito.ok) {
            alert(`Import non riuscito: ${esito.messaggio}`);
            return;
        }
        apriFinestraImport(file.name, esito.dati);
    });
    input.click();
}

function apriFinestraImport(nomeFile, dati) {
    const ultimo = appState.cliente?.ultimoImport || null;
    const indiceSalvato = ultimo ? dati.fogli.findIndex(f => f.nome === ultimo.foglio) : -1;
    imp = {
        nomeFile,
        formato: dati.formato,
        fogli: dati.fogli,
        foglio: Math.max(0, indiceSalvato),
        riga: ultimo && Number.isInteger(ultimo.rigaIntestazione) && ultimo.rigaIntestazione >= 1 ? ultimo.rigaIntestazione : 1,
        // Riferimenti { nome, lettera } da cui ricostruire le colonne quando cambiano foglio o riga
        riferimenti: ultimo?.colonne || {},
        colonne: {},
        modalita: 'sostituisci',
        scheda: 'scartati',
        risultato: null,
        validazione: null
    };
    ricostruisciColonne();
    modale.style.display = 'flex';
    disegnaFinestra();
}

function foglioCorrente() {
    return imp.fogli[imp.foglio];
}

function colonneCorrenti() {
    const foglio = foglioCorrente();
    if (imp.riga > foglio.righe.length) return [];
    return colonneDelFoglio(foglio, imp.riga);
}

function ricostruisciColonne() {
    const colonne = colonneCorrenti();
    imp.colonne = {};
    CAMPI.forEach(({ chiave }) => { imp.colonne[chiave] = trovaColonna(colonne, imp.riferimenti[chiave]); });
}

// Riferimenti { nome, lettera } delle colonne scelte, per ultimoImport e per ricostruire i menu
function riferimentiScelti() {
    const colonne = colonneCorrenti();
    const riferimenti = {};
    CAMPI.forEach(({ chiave }) => {
        const c = colonne.find(col => col.indice === imp.colonne[chiave]);
        riferimenti[chiave] = c ? { nome: c.nome, lettera: c.lettera } : null;
    });
    return riferimenti;
}

function mappaturaCompleta() {
    return imp.colonne.id !== null && imp.colonne.id !== undefined &&
           imp.colonne.testo !== null && imp.colonne.testo !== undefined;
}

function calcolaAnteprima() {
    imp.risultato = null;
    imp.validazione = null;
    if (!mappaturaCompleta() || imp.riga > foglioCorrente().righe.length) return;
    const prefisso = prefissoInUso();
    const righe = estraiRighe(foglioCorrente(), imp.riga, imp.colonne);
    imp.validazione = validaRighe(righe, prefisso, appState.library);
    imp.risultato = calcolaImport(appState.cliente, imp.validazione.valide, imp.modalita, prefisso, pathStack[0].graph);
    imp.risultato.conteggi.scartati = imp.validazione.scartate.length;
}

function disegnaFinestra() {
    const foglio = foglioCorrente();
    const colonne = colonneCorrenti();
    const oltreLaFine = imp.riga > foglio.righe.length;
    const opzioniFogli = imp.fogli.map((f, i) =>
        `<option value="${i}" ${i === imp.foglio ? 'selected' : ''}>${escapeHtml(f.nome)}${f.nascosto ? ' (nascosto)' : ''}</option>`).join('');

    const menuCampo = ({ chiave, etichetta, obbligatorio }) => {
        const scelta = imp.colonne[chiave];
        const vuota = obbligatorio
            ? `<option value="" ${scelta === null ? 'selected' : ''}>— scegli —</option>`
            : `<option value="" ${scelta === null ? 'selected' : ''}>(nessuna)</option>`;
        const voci = colonne.map(c =>
            `<option value="${c.indice}" ${c.indice === scelta ? 'selected' : ''}>${escapeHtml(`${c.lettera}: ${c.nome || '(senza nome)'}`)}</option>`).join('');
        return `<label class="campo-import"><span>${etichetta}${obbligatorio ? ' *' : ''}${iconaAiuto(`import.colonna.${chiave}`)}</span>
            <select data-campo="${chiave}" ${oltreLaFine ? 'disabled' : ''}>${vuota}${voci}</select></label>`;
    };

    contenutoModale.innerHTML = `
        <div class="import-file">File: <strong>${escapeHtml(imp.nomeFile)}</strong> (${imp.formato === 'csv' ? 'CSV' : 'Excel'})</div>
        <div class="import-riga">
            <label class="campo-import"><span>Foglio${iconaAiuto('import.foglio')}</span>
                <select id="impFoglio" ${imp.fogli.length < 2 ? 'disabled' : ''}>${opzioniFogli}</select></label>
            <label class="campo-import"><span>Riga di intestazione${iconaAiuto('import.riga')}</span>
                <input type="number" id="impRiga" min="1" step="1" value="${imp.riga}" style="width:80px;"></label>
        </div>
        ${oltreLaFine ? `<p class="elenco-avviso">Il foglio ha solo ${foglio.righe.length} righe</p>` : ''}
        <div class="import-campi">${CAMPI.map(menuCampo).join('')}</div>
        <div class="import-modalita">
            <span class="campo-import"><span>Modalità${iconaAiuto('import.modalita')}</span></span>
            <label><input type="radio" name="impModalita" value="sostituisci" ${imp.modalita === 'sostituisci' ? 'checked' : ''}> Sostituisci l'insieme <small>(chi manca nel file diventa ritirato)</small></label>
            <label><input type="radio" name="impModalita" value="aggiungi" ${imp.modalita === 'aggiungi' ? 'checked' : ''}> Aggiungi e aggiorna <small>(nessuno viene ritirato)</small></label>
        </div>
        <div id="impAnteprima" class="import-anteprima"></div>
        <div class="import-pulsanti">
            <button id="impAnnulla" class="pulsante-progetto">Annulla</button>
            <button id="impConferma" class="pulsante-progetto pulsante-menu">Conferma import</button>
        </div>`;
    disegnaAnteprima();
}

function tabella(intestazioni, righe) {
    return `<table class="report-table"><thead><tr>${intestazioni.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${righe.join('')}</tbody></table>`;
}

function cella(valore) {
    return `<td>${escapeHtml(valore ?? '')}</td>`;
}

function primaDopo(prima, dopo) {
    if ((prima ?? null) === (dopo ?? null)) return `<td class="invariato">${escapeHtml(dopo ?? '')}</td>`;
    return `<td><del>${escapeHtml(prima ?? '(vuoto)')}</del><br><ins>${escapeHtml(dopo ?? '(vuoto)')}</ins></td>`;
}

function contenutoScheda() {
    const { liste } = imp.risultato;
    switch (imp.scheda) {
        case 'scartati': {
            const righe = imp.validazione.scartate.map(s => `<tr>${cella(s.riga)}${cella(s.idCliente)}${cella(s.motivo)}</tr>`);
            return righe.length ? tabella(['Riga', 'ID', 'Motivo'], righe) : '<p class="empty-props">Nessuna riga scartata.</p>';
        }
        case 'modificati': {
            const righe = liste.modificati.map(({ prima, dopo }) =>
                `<tr>${cella(dopo.idCliente)}${primaDopo(prima.testo, dopo.testo)}${primaDopo(prima.titolo, dopo.titolo)}${primaDopo(prima.tipologia ?? 'Capacità', dopo.tipologia ?? 'Capacità')}</tr>`);
            return righe.length ? tabella(['ID', 'Testo', 'Titolo', 'Tipologia'], righe) : '<p class="empty-props">Nessun requisito modificato.</p>';
        }
        case 'ritirati': {
            const righe = liste.ritirati.map(r => `<tr>${cella(r.idCliente)}${cella(titoloRequisito(r))}</tr>`);
            return righe.length ? tabella(['ID', 'Titolo'], righe) : '<p class="empty-props">Nessun requisito ritirato.</p>';
        }
        default: {
            const limite = appSettings.cliente.righeAnteprima;
            const righe = liste.nuovi.slice(0, limite).map(r =>
                `<tr>${cella(r.idCliente)}${cella(r.titolo)}${cella(r.testo.length > 120 ? `${r.testo.slice(0, 120)}…` : r.testo)}${cella(r.tipologia ?? 'Capacità')}</tr>`);
            const altri = liste.nuovi.length - limite;
            if (!righe.length) return '<p class="empty-props">Nessun requisito nuovo.</p>';
            return tabella(['ID', 'Titolo', 'Testo', 'Tipologia'], righe) + (altri > 0 ? `<p class="empty-props">e altri ${altri}</p>` : '');
        }
    }
}

function disegnaAnteprima() {
    calcolaAnteprima();
    const anteprima = document.getElementById('impAnteprima');
    const conferma = document.getElementById('impConferma');
    if (!imp.risultato) {
        anteprima.innerHTML = `<p class="empty-props">Scegli le colonne di ID e Testo per vedere l'anteprima.</p>`;
        conferma.disabled = true;
        conferma.title = 'Scegli prima le colonne di ID e Testo';
        return;
    }
    const c = imp.risultato.conteggi;
    const voci = [
        ['Nuovi', c.nuovi], ['Modificati', c.modificati], ['Riattivati', c.riattivati], ['Ritirati', c.ritirati],
        ['Invariati', c.invariati], ['Scartati', c.scartati], ['Fili che si perdono', c.filiPersi]
    ];
    const schede = [['scartati', 'Scartati', c.scartati], ['modificati', 'Modificati', c.modificati],
        ['ritirati', 'Ritirati', c.ritirati], ['nuovi', 'Nuovi', c.nuovi]];
    anteprima.innerHTML = `
        <div class="import-conteggi">${voci.map(([nome, n]) =>
            `<span class="conteggio-import${n > 0 && (nome === 'Scartati' || nome === 'Fili che si perdono') ? ' conteggio-attenzione' : ''}"><strong>${n}</strong> ${nome.toLowerCase()}</span>`).join('')}</div>
        <div class="schede-import">${schede.map(([chiave, nome, n]) =>
            `<button data-scheda="${chiave}" class="scheda-import${imp.scheda === chiave ? ' attiva' : ''}">${nome} (${n})</button>`).join('')}</div>
        <div class="contenuto-scheda-import">${contenutoScheda()}</div>`;
    const valide = imp.validazione.valide.length;
    conferma.disabled = valide === 0;
    conferma.title = valide === 0 ? 'Il file non ha nessuna riga valida' : '';
}

async function confermaImport() {
    if (!imp?.risultato || imp.validazione.valide.length === 0) return;
    const prefisso = prefissoInUso();
    const ultimoImport = {
        data: new Date().toISOString(),
        nomeFile: imp.nomeFile,
        foglio: foglioCorrente().nome,
        rigaIntestazione: imp.riga,
        modalita: imp.modalita,
        colonne: riferimentiScelti(),
        conteggi: { ...imp.risultato.conteggi }
    };
    const risultato = imp.risultato;
    chiudiImport();
    await applicaImport(risultato, prefisso, ultimoImport);
}

function installaEventiImport() {
    if (!contenutoModale) return;
    contenutoModale.addEventListener('change', (e) => {
        if (!imp) return;
        const t = e.target;
        if (t.id === 'impFoglio' || t.id === 'impRiga') {
            // I menu si ricostruiscono tenendo le colonne scelte (per nome, se no per lettera)
            imp.riferimenti = riferimentiScelti();
            if (t.id === 'impFoglio') imp.foglio = Number(t.value);
            else imp.riga = Math.max(1, Math.floor(Number(t.value)) || 1);
            ricostruisciColonne();
            disegnaFinestra();
        } else if (t.dataset.campo) {
            imp.colonne[t.dataset.campo] = t.value === '' ? null : Number(t.value);
            disegnaAnteprima();
        } else if (t.name === 'impModalita') {
            imp.modalita = t.value;
            disegnaAnteprima();
        }
    });
    contenutoModale.addEventListener('click', (e) => {
        if (!imp) return;
        const scheda = e.target.closest('[data-scheda]');
        if (scheda) {
            imp.scheda = scheda.dataset.scheda;
            disegnaAnteprima();
        } else if (e.target.id === 'impAnnulla') {
            chiudiImport();
        } else if (e.target.id === 'impConferma') {
            confermaImport();
        }
    });
    document.getElementById('btnChiudiImport')?.addEventListener('click', chiudiImport);
}

/* --- SCHEDA CLIENTE DEL PANNELLO SINISTRO --- */

const filtri = { ricerca: '', stato: 'tutti', sezione: '' };
let idSelezionato = null;
let schedaDaAggiornare = false;
let fotogrammaRichiesto = false;
let timerRicerca = null;

function schedaVisibile() {
    const scheda = document.getElementById('schedaCliente');
    return !!scheda && !scheda.hidden;
}

// Chiamata da render(): l'aggiornamento vero avviene una volta per fotogramma e solo se la scheda si vede
export function segnaSchedaClienteDaAggiornare() {
    schedaDaAggiornare = true;
    if (fotogrammaRichiesto) return;
    fotogrammaRichiesto = true;
    requestAnimationFrame(() => {
        fotogrammaRichiesto = false;
        if (schedaDaAggiornare && schedaVisibile()) aggiornaSchedaCliente();
    });
}

// id del requisito cliente mostrato nell'ispettore, null se l'ispettore mostra altro
export function impostaSelezioneCliente(id) {
    idSelezionato = id;
}

export function dettaglioClienteAperto() {
    return idSelezionato !== null;
}

// Importa… spento senza progetto o durante un conflitto del progetto, con il motivo nel suggerimento
export function aggiornaPulsantiCliente() {
    const pulsante = document.getElementById('btnImportaCliente');
    if (!pulsante) return;
    let motivo = '';
    if (!progettoAperto()) motivo = 'Apri un progetto per importare i requisiti cliente';
    else if (progettoInConflitto()) motivo = 'Risolvi prima il conflitto del progetto (banner in alto)';
    pulsante.disabled = !!motivo;
    pulsante.dataset.titoloNativo = motivo;
}

function passaFiltriScheda(req, fili, query) {
    if (filtri.stato === 'nonCollegati' && !(req.stato === 'attivo' && !fili.get(req.id))) return false;
    if (filtri.stato === 'modificati' && !req.modificato) return false;
    if (filtri.stato === 'ritirati' && req.stato !== 'ritirato') return false;
    if (filtri.sezione && req.sezione !== filtri.sezione) return false;
    if (!query) return true;
    return [req.idCliente, req.titolo, req.testo].some(v => (v || '').toLowerCase().includes(query));
}

export function aggiornaSchedaCliente() {
    schedaDaAggiornare = false;
    aggiornaPulsantiCliente();
    const nessunProgetto = document.getElementById('clienteNessunProgetto');
    const strumenti = document.getElementById('clienteStrumenti');
    const vuoto = document.getElementById('clienteVuoto');
    const elenco = document.getElementById('clienteElenco');
    const filtriBox = document.getElementById('clienteFiltri');
    if (!nessunProgetto) return;

    const aperto = progettoAperto();
    const requisiti = appState.cliente?.requisiti || [];
    nessunProgetto.hidden = aperto;
    strumenti.hidden = !aperto;
    vuoto.hidden = !aperto || requisiti.length > 0;
    filtriBox.hidden = !aperto || requisiti.length === 0;
    elenco.hidden = !aperto || requisiti.length === 0;
    document.getElementById('btnVistiCliente').hidden = requisiti.length === 0;
    if (!aperto || requisiti.length === 0) return;

    // Sezioni presenti, tenendo la scelta se esiste ancora
    const selectSezione = document.getElementById('clienteSezione');
    const sezioni = [...new Set(requisiti.map(r => r.sezione).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
    if (filtri.sezione && !sezioni.includes(filtri.sezione)) filtri.sezione = '';
    selectSezione.innerHTML = `<option value="">Tutte le sezioni</option>` +
        sezioni.map(s => `<option value="${escapeHtml(s)}" ${s === filtri.sezione ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
    selectSezione.disabled = sezioni.length === 0;

    const fili = contaFiliCliente();
    const posizioni = pathStack[0].graph.parentReqPositions || {};
    const query = filtri.ricerca.trim().toLowerCase();
    const trovati = requisiti.filter(r => passaFiltriScheda(r, fili, query));
    const limite = appSettings.cliente.righePannello;
    const mostrati = trovati.slice(0, limite);

    document.getElementById('clienteConteggio').textContent = trovati.length > limite
        ? `${trovati.length} risultati, mostrati i primi ${limite}`
        : `${trovati.length} risultati`;

    document.getElementById('clienteRighe').innerHTML = mostrati.map(r => {
        const n = fili.get(r.id) || 0;
        const segni = [
            posizioni[r.id] ? '<span class="segno-cliente" title="Sul canvas">📍</span>' : '',
            n > 0 ? `<span class="segno-cliente" title="Fili">🔗${n}</span>` : '',
            r.modificato ? '<span class="segno-cliente segno-mod" title="Modificato dall\'ultimo import">Mod</span>' : '',
            r.stato === 'ritirato' ? '<span class="segno-cliente segno-rit" title="Ritirato">Rit</span>' : ''
        ].join('');
        const classi = ['riga-cliente', r.stato === 'ritirato' ? 'riga-ritirata' : '', r.id === idSelezionato ? 'riga-selezionata' : ''].join(' ');
        return `<div class="${classi}" draggable="true" data-id="${escapeHtml(r.id)}" title="${escapeHtml(r.testo)}">
            <span class="pallino-classe" style="background:${escapeHtml(getColoreRequisito(r))}"></span>
            <span class="riga-cliente-id">${escapeHtml(r.idCliente)}</span>
            <span class="riga-cliente-titolo">${escapeHtml(titoloRequisito(r))}</span>
            <span class="riga-cliente-segni">${segni}</span>
        </div>`;
    }).join('');
}

function segnaTuttiVisti() {
    const modificati = (appState.cliente?.requisiti || []).filter(r => r.modificato);
    if (modificati.length === 0) {
        alert('Nessun requisito cliente è segnato come modificato.');
        return;
    }
    if (!confirm(`Segnare come visti tutti i ${modificati.length} requisiti cliente modificati? Il prima e dopo di ognuno viene cancellato.`)) return;
    modificati.forEach(r => { r.modificato = false; r.precedente = null; });
    render();
    if (idSelezionato) mostraDettaglioCliente(idSelezionato);
}

// Rilascio di una riga della scheda sul canvas: il requisito diventa un blocco tondo della radice
export function posizionaRequisitoCliente(id, coords) {
    if (pathStack.length > 1) {
        alert('I requisiti cliente si collegano solo alla radice');
        return;
    }
    if (!trovaRequisitoCliente(id)) return;
    const radice = pathStack[0].graph;
    if (!radice.parentReqPositions) radice.parentReqPositions = {};
    radice.parentReqPositions[id] = { x: coords.x, y: coords.y };
    render();
}

// Commutatore delle schede del pannello sinistro: Libreria, Cliente, Coerenza (spec 0004) e Gerarchia (spec 0005)
export function mostraScheda(nome) {
    document.querySelectorAll('.scheda-pannello').forEach(b => b.classList.toggle('attiva', b.dataset.scheda === nome));
    document.getElementById('schedaLibreria').hidden = nome !== 'libreria';
    document.getElementById('schedaCliente').hidden = nome !== 'cliente';
    document.getElementById('schedaCoerenza').hidden = nome !== 'coerenza';
    document.getElementById('schedaGerarchia').hidden = nome !== 'gerarchia';
    if (nome === 'cliente') aggiornaSchedaCliente();
    if (nome === 'coerenza') aggiornaSchedaCoerenza(true);
    if (nome === 'gerarchia') aggiornaSchedaGerarchia(true);
}

export function initSchedaCliente() {
    document.querySelectorAll('.scheda-pannello').forEach(b => b.addEventListener('click', () => mostraScheda(b.dataset.scheda)));
    document.getElementById('btnImportaCliente')?.addEventListener('click', () => {
        aggiornaPulsantiCliente();
        if (!document.getElementById('btnImportaCliente').disabled) scegliFile();
    });
    document.getElementById('btnVistiCliente')?.addEventListener('click', segnaTuttiVisti);

    document.getElementById('clienteRicerca')?.addEventListener('input', (e) => {
        clearTimeout(timerRicerca);
        timerRicerca = setTimeout(() => {
            filtri.ricerca = e.target.value;
            aggiornaSchedaCliente();
        }, ATTESA_RICERCA);
    });
    document.getElementById('clienteStato')?.addEventListener('change', (e) => {
        filtri.stato = e.target.value;
        aggiornaSchedaCliente();
    });
    document.getElementById('clienteSezione')?.addEventListener('change', (e) => {
        filtri.sezione = e.target.value;
        aggiornaSchedaCliente();
    });

    const righe = document.getElementById('clienteRighe');
    righe?.addEventListener('dragstart', (e) => {
        const riga = e.target.closest?.('[data-id]');
        if (riga) e.dataTransfer.setData('requisitoCliente', riga.dataset.id);
    });
    righe?.addEventListener('click', (e) => {
        const riga = e.target.closest('[data-id]');
        if (riga) mostraDettaglioCliente(riga.dataset.id);
    });

    installaEventiImport();
    aggiornaSchedaCliente();
}
