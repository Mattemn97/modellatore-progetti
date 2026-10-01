/* --- GERARCHIA DEI REQUISITI: INDICE DELLE OCCORRENZE, CATENA DELLA SCELTA, SCHEDA GERARCHIA ED EVIDENZE SUL CANVAS --- */

// Spec 0005. Un'occorrenza è un requisito in un'istanza precisa: chiave = percorso dei nodi dalla radice al blocco
// che lo possiede (compreso) + '|' + id del requisito; per un requisito cliente '__cliente__|<id>'.
// Indice e catena si rifanno una volta per fotogramma a modalità accesa; modalità, scelta e risultato vivono
// solo in questo modulo e non finiscono mai nel file del progetto.

import { appState, appSettings, pathStack, getCurrentLevel, setActiveNodeId } from './state.js';
import { render, centraVista, evidenziaCliente } from './renderer.js';
import { selectNode, openLibraryBlock, mostraDettaglioCliente } from './inspector.js';
import { mostraScheda, impostaSelezioneCliente } from './cliente.js';
import { coerenzaAttiva, spegniCoerenza } from './coerenza.js';
import { apriPercorso, modaleAperta } from './progetto.js';
import { visitaDerivazioni, getColoreRequisito, titoloRequisito, ID_CLIENTE } from './model.js';
import { escapeHtml } from './utils.js';

const MSG_SPARITO = "Questo elemento non c'è più";
const COLORE_RITIRATO = '#9e9e9e';

let modalitaAttiva = false;
let chiaveScelta = null;
// Eccezioni a mano alla regola dei rami aperti (AC-8): valgono solo per la scelta corrente
const ramiAperti = new Set();
const ramiChiusi = new Set();

// Ultimo calcolo: letto da renderer e scheda
let ultimoIndice = null;
let ultimaCatena = null;
let ultimaImprontaCatena = null;
let ultimoHtmlScheda = null;

let fotogrammaRichiesto = false;
let schedaDaAggiornare = false;

// Un numero per ogni oggetto livello, così l'impronta cambia quando Annulla o Ricarica sostituiscono il modello
const idLivelli = new WeakMap();
let prossimoIdLivello = 1;

function idLivello(graph) {
    if (!idLivelli.has(graph)) idLivelli.set(graph, prossimoIdLivello++);
    return idLivelli.get(graph);
}

/* --- CHIAVI --- */

function chiaveDi(percorso, reqId) {
    return `${percorso.join('/')}|${reqId}`;
}

function chiaveCliente(reqId) {
    return `${ID_CLIENTE}|${reqId}`;
}

// Gli id dei nodi non contengono '|' (generaId), quindi la prima '|' separa il percorso dall'id del requisito
function scomponiChiave(chiave) {
    const i = chiave.indexOf('|');
    const testa = chiave.slice(0, i);
    return { cliente: testa === ID_CLIENTE, percorso: testa ? testa.split('/') : [], reqId: chiave.slice(i + 1) };
}

function idAperti() {
    return pathStack.slice(1).map(l => l.id);
}

// Chiave di un pin o di un blocco tondo del livello corrente: il pin di un nodo ha percorso [...idAperti, nodo],
// un blocco tondo idAperti (alla radice è un requisito cliente). Così pin e blocco tondo dello stesso requisito coincidono
export function chiaveSulCanvas(ownerType, ownerId, reqId) {
    const aperti = idAperti();
    if (ownerType === 'parent') return aperti.length === 0 ? chiaveCliente(reqId) : chiaveDi(aperti, reqId);
    return chiaveDi([...aperti, ownerId], reqId);
}

/* --- CALCOLO --- */

// Indice completo delle occorrenze del modello, con padri e figli dai soli fili di derivazione validi (AC-4, AC-5).
// Non cambia mai il modello
// percorsiConContenuto: percorsi dei blocchi con almeno un blocco con definizione dentro (la condizione della Coerenza
// per "senza figli"), usati dalla matrice (spec 0006)
export function calcolaGerarchia(radice, libreria, cliente) {
    const occorrenze = new Map();
    const filiPerLivello = new Map();
    const percorsiConContenuto = new Set();
    if (!libreria || Object.keys(libreria).length === 0) {
        return { occorrenze, filiPerLivello, percorsiConContenuto, libreriaAssente: true };
    }

    function registra(chiave, percorso, etichette, req, eCliente) {
        if (occorrenze.has(chiave)) return; // due nodi con lo stesso id nello stesso livello: una sola occorrenza
        occorrenze.set(chiave, {
            chiave, percorso, etichette, reqId: req.id, req, cliente: eCliente, padri: new Set(), figli: new Set()
        });
    }

    (cliente?.requisiti || []).forEach(req => registra(chiaveCliente(req.id), [], [], req, true));

    visitaDerivazioni(radice, libreria, cliente, {
        filo(ctx, edge, esito) {
            if (esito.stato !== 'valido' || !esito.padre) return;
            const padre = ctx.tipoPadre === null ? chiaveCliente(esito.padre.reqId) : chiaveDi(ctx.percorso, esito.padre.reqId);
            const figlio = chiaveDi([...ctx.percorso, esito.figlio.ownerId], esito.figlio.reqId);
            if (!filiPerLivello.has(ctx.graph)) filiPerLivello.set(ctx.graph, new Map());
            filiPerLivello.get(ctx.graph).set(edge.id, { padre, figlio });
        },
        nodo(ctx, nodo, def) {
            if (!def) return;
            if (ctx.percorso.length > 0) percorsiConContenuto.add(ctx.percorso.join('/'));
            const percorso = [...ctx.percorso, nodo.id];
            const etichette = [...ctx.etichette, nodo.label || nodo.id];
            def.requisiti.forEach(req => registra(chiaveDi(percorso, req.id), percorso, etichette, req, false));
        }
    });

    // I fili di un livello arrivano prima dei suoi nodi: si collegano a indice completo
    filiPerLivello.forEach(fili => fili.forEach(({ padre, figlio }) => {
        const p = occorrenze.get(padre);
        const f = occorrenze.get(figlio);
        if (!p || !f) return;
        p.figli.add(figlio);
        f.padri.add(padre);
    }));

    return { occorrenze, filiPerLivello, percorsiConContenuto, libreriaAssente: false };
}

// Tutte le chiavi raggiungibili da 'partenza' seguendo 'lato' ('padri' o 'figli'), partenza esclusa
function raggiungibili(occorrenze, partenza, lato) {
    const visti = new Set();
    const pila = [partenza];
    while (pila.length) {
        const occ = occorrenze.get(pila.pop());
        occ?.[lato].forEach(k => {
            if (visti.has(k) || k === partenza) return;
            visti.add(k);
            pila.push(k);
        });
    }
    return visti;
}

// Antenati, discendenti, fili e contatori della chiave scelta; null se la chiave non è nell'indice
export function catenaDi(indice, chiave) {
    const occorrenze = indice.occorrenze;
    const scelta = occorrenze.get(chiave);
    if (!scelta) return null;
    const antenati = raggiungibili(occorrenze, chiave, 'padri');
    const discendenti = raggiungibili(occorrenze, chiave, 'figli');

    const fili = new Map();
    indice.filiPerLivello.forEach((filiLivello, graph) => filiLivello.forEach(({ padre, figlio }, edgeId) => {
        const versoAntenati = (figlio === chiave || antenati.has(figlio)) && antenati.has(padre);
        const versoDiscendenti = (padre === chiave || discendenti.has(padre)) && discendenti.has(figlio);
        if (!versoAntenati && !versoDiscendenti) return;
        if (!fili.has(graph)) fili.set(graph, new Set());
        fili.get(graph).add(edgeId);
    }));

    // Ogni occorrenza della catena conta in ogni blocco che la contiene strettamente (non nei suoi pin)
    const contatori = new Map();
    [chiave, ...antenati, ...discendenti].forEach(k => {
        const percorso = occorrenze.get(k).percorso;
        for (let i = 0; i < percorso.length - 1; i++) {
            const prefisso = percorso.slice(0, i + 1).join('/');
            contatori.set(prefisso, (contatori.get(prefisso) || 0) + 1);
        }
    });

    const colore = scelta.cliente && scelta.req.stato === 'ritirato' ? COLORE_RITIRATO : getColoreRequisito(scelta.req);
    return { scelta: chiave, antenati, discendenti, fili, contatori, colore };
}

function improntaCatena() {
    const sparita = sceltaSparita();
    const parti = [chiaveScelta ?? '', sparita, ultimoIndice?.libreriaAssente ?? ''];
    if (ultimaCatena) {
        const c = ultimaCatena;
        parti.push([...c.antenati].join(','), [...c.discendenti].join(','), c.colore,
            [...c.fili].map(([graph, ids]) => `${idLivello(graph)}:${[...ids].join(',')}`).join(';'),
            [...c.contatori].map(([k, n]) => `${k}=${n}`).join(','));
    }
    return parti.join('\n');
}

// Rifà indice e catena dal modello di adesso; true se ciò che si vede sul canvas è cambiato
export function ricalcolaGerarchia() {
    ultimoIndice = calcolaGerarchia(pathStack[0].graph, appState.library, appState.cliente);
    ultimaCatena = chiaveScelta !== null && !ultimoIndice.libreriaAssente ? catenaDi(ultimoIndice, chiaveScelta) : null;
    const impronta = improntaCatena();
    const cambiata = impronta !== ultimaImprontaCatena;
    ultimaImprontaCatena = impronta;
    return cambiata;
}

// La scelta sparita non è uno stato: una chiave scelta che l'indice di adesso non ha (AC-12)
function sceltaSparita() {
    return chiaveScelta !== null && !!ultimoIndice && !ultimoIndice.libreriaAssente && !ultimoIndice.occorrenze.has(chiaveScelta);
}

/* --- UN FOTOGRAMMA: CALCOLO, SCHEDA E UN SOLO render() IN PIÙ SE SERVE --- */

function richiediFotogramma() {
    if (fotogrammaRichiesto) return;
    fotogrammaRichiesto = true;
    requestAnimationFrame(() => {
        fotogrammaRichiesto = false;
        if (!modalitaAttiva) return;
        const cambiata = ricalcolaGerarchia();
        if (schedaDaAggiornare && schedaVisibile()) aggiornaSchedaGerarchia();
        if (cambiata) render();
    });
}

// Chiamata da render() a modalità accesa: al massimo una visita del modello per fotogramma (AC-11)
export function segnaGerarchiaDaRicalcolare() {
    richiediFotogramma();
}

// Chiamata da render(): la scheda si ridisegna una volta per fotogramma, solo se si vede e se è cambiata
export function segnaSchedaGerarchiaDaAggiornare() {
    if (!modalitaAttiva) return;
    schedaDaAggiornare = true;
    richiediFotogramma();
}

/* --- LETTURE PER IL RENDERER (AC-10) --- */

export function gerarchiaAttiva() {
    return modalitaAttiva;
}

// Vero se c'è una catena da mostrare: allora tutto ciò che non ne fa parte si attenua
export function catenaAttiva() {
    return modalitaAttiva && ultimaCatena !== null;
}

export function filoInCatena(graph, edgeId) {
    return catenaAttiva() && !!ultimaCatena.fili.get(graph)?.has(edgeId);
}

export function filiInCatena(graph) {
    return catenaAttiva() ? ultimaCatena.fili.get(graph) || new Set() : new Set();
}

export function occorrenzaInCatena(chiave) {
    if (!catenaAttiva()) return false;
    return chiave === ultimaCatena.scelta || ultimaCatena.antenati.has(chiave) || ultimaCatena.discendenti.has(chiave);
}

// Occorrenze della catena strettamente dentro il blocco con questo percorso
export function contatoreGerarchia(percorso) {
    if (!catenaAttiva()) return 0;
    return ultimaCatena.contatori.get(percorso.join('/')) || 0;
}

export function coloreCatena() {
    return ultimaCatena?.colore || COLORE_RITIRATO;
}

/* --- PULSANTE E MODALITÀ (AC-1) --- */

function aggiornaPulsante() {
    const pulsante = document.getElementById('btnGerarchia');
    if (!pulsante) return;
    pulsante.classList.toggle('attivo', modalitaAttiva);
    pulsante.setAttribute('aria-pressed', String(modalitaAttiva));
}

function svuotaScelta() {
    chiaveScelta = null;
    ramiAperti.clear();
    ramiChiusi.clear();
}

function accendi() {
    if (modalitaAttiva) return;
    // Coerenza e Gerarchia non sono mai accese insieme
    if (coerenzaAttiva()) spegniCoerenza();
    modalitaAttiva = true;
    svuotaScelta();
    ultimaImprontaCatena = null;
    ultimoHtmlScheda = null;
    document.querySelector('.scheda-pannello[data-scheda="gerarchia"]').hidden = false;
    document.getElementById('libraryPanel')?.classList.remove('collapsed');
    ricalcolaGerarchia();
    mostraScheda('gerarchia');
    aggiornaPulsante();
}

// Spegne la modalità con linguetta, scheda, pulsante, scelta e risultato, senza render(): lo fa chi la chiama
export function spegniGerarchia() {
    if (!modalitaAttiva) return;
    modalitaAttiva = false;
    svuotaScelta();
    ultimoIndice = null;
    ultimaCatena = null;
    ultimaImprontaCatena = null;
    const scheda = document.getElementById('schedaGerarchia');
    const eraAperta = !scheda.hidden;
    document.querySelector('.scheda-pannello[data-scheda="gerarchia"]').hidden = true;
    if (eraAperta) mostraScheda('libreria');
    scheda.hidden = true;
    aggiornaPulsante();
}

export function cambiaModalitaGerarchia() {
    if (modalitaAttiva) spegniGerarchia();
    else accendi();
    render();
}

/* --- SCELTA --- */

// Nuova scelta: calcola subito, così la gerarchia si vede senza attendere il fotogramma
export function scegli(chiave) {
    if (chiave !== chiaveScelta) {
        ramiAperti.clear();
        ramiChiusi.clear();
    }
    chiaveScelta = chiave;
    ricalcolaGerarchia();
    if (schedaVisibile()) aggiornaSchedaGerarchia(true);
    render();
}

// Premi e rilascia su un pin, una porta o un blocco tondo a modalità accesa (AC-2)
export function scegliDaCanvas(owner, req) {
    const chiave = chiaveSulCanvas(owner.ownerType, owner.ownerId, req.id);
    evidenziaCliente(null);
    if (owner.ownerType === 'node') {
        impostaSelezioneCliente(null);
        const nodo = getCurrentLevel().graph.nodes.find(n => n.id === owner.ownerId);
        if (nodo) selectNode(nodo);
    } else if (pathStack.length > 1) {
        // Blocco tondo di un livello interno: il blocco che contiene il livello, aperto in libreria senza istanza
        impostaSelezioneCliente(null);
        setActiveNodeId(null);
        openLibraryBlock(getCurrentLevel().parentNode.type);
    } else {
        mostraDettaglioCliente(req.id);
    }
    scegli(chiave);
}

// Dal dettaglio di un requisito cliente: accende la modalità se serve, senza cambiare livello né vista (AC-3)
export function mostraGerarchiaCliente(reqId) {
    mostraGerarchiaDi(chiaveCliente(reqId));
}

// Da una riga della matrice (spec 0006, AC-10): accende la modalità, apre la scheda e va all'istanza come un clic
// su una riga della scheda. Pannello e scheda sono espliciti perché accendi() esce subito a modalità già accesa
export function apriGerarchiaSu(chiave) {
    accendi();
    document.getElementById('libraryPanel')?.classList.remove('collapsed');
    mostraScheda('gerarchia');
    vaiAOccorrenza(chiave);
}

export function mostraGerarchiaDi(chiave) {
    accendi();
    document.getElementById('libraryPanel')?.classList.remove('collapsed');
    mostraScheda('gerarchia');
    scegli(chiave);
}

// ✕ ed Esc: scheda senza scelta, canvas come oggi, modalità accesa (AC-13)
export function togliScelta() {
    svuotaScelta();
    ricalcolaGerarchia();
    if (schedaVisibile()) aggiornaSchedaGerarchia(true);
    render();
}

// Apertura, creazione o import di un progetto: la scelta si toglie senza messaggio; il render() lo fa chi chiama
export function azzeraSceltaGerarchia() {
    svuotaScelta();
    ultimaCatena = null;
}

// Dopo un Salva nell'ispettore che ha rinominato id di requisiti del blocco 'blockId': la scelta segue il nuovo id (AC-12)
export function rinominaSceltaGerarchia(blockId, mappaRinomina) {
    if (chiaveScelta === null) return;
    const { cliente, percorso, reqId } = scomponiChiave(chiaveScelta);
    if (cliente || percorso.length === 0 || !mappaRinomina[reqId]) return;
    let graph = pathStack[0].graph;
    let nodo = null;
    for (const id of percorso) {
        nodo = (graph?.nodes || []).find(n => n.id === id);
        if (!nodo) return;
        graph = nodo.internal_graph;
    }
    if (nodo.type === blockId) chiaveScelta = chiaveDi(percorso, mappaRinomina[reqId]);
}

/* --- NAVIGAZIONE DA UNA RIGA (AC-9) --- */

function centroBlocco(nodo) {
    return {
        x: nodo.position.x + (nodo.width || appSettings.node.width) / 2,
        y: nodo.position.y + (nodo.height || appSettings.node.height) / 2
    };
}

export function vaiAOccorrenza(chiave) {
    // Sempre dall'indice di adesso, mai da oggetti tenuti da prima del clic
    ricalcolaGerarchia();
    const occ = ultimoIndice.occorrenze.get(chiave);
    const idDiPrima = idAperti();
    const sparito = () => {
        apriPercorso(idDiPrima);
        alert(MSG_SPARITO);
        ricalcolaGerarchia();
        if (schedaVisibile()) aggiornaSchedaGerarchia(true);
        render();
    };
    if (!occ) return sparito();

    impostaSelezioneCliente(null);
    evidenziaCliente(null);

    // Requisito cliente: la radice; il dettaglio centra ed evidenzia da sé se è sul canvas
    if (occ.cliente) {
        apriPercorso([]);
        setActiveNodeId(null);
        scegli(chiave);
        mostraDettaglioCliente(occ.reqId);
        return;
    }

    if (!apriPercorso(occ.percorso.slice(0, -1))) return sparito();
    const nodo = getCurrentLevel().graph.nodes.find(n => n.id === occ.percorso.at(-1));
    if (!nodo) return sparito();
    selectNode(nodo);
    const centro = centroBlocco(nodo);
    centraVista(centro.x, centro.y);
    scegli(chiave);
}

/* --- SCHEDA GERARCHIA (AC-6, AC-7, AC-8) --- */

function schedaVisibile() {
    const scheda = document.getElementById('schedaGerarchia');
    return modalitaAttiva && !!scheda && !scheda.hidden;
}

function plurale(n, uno, molti) {
    return `${n} ${n === 1 ? uno : molti}`;
}

// Una voce dell'albero: la sua chiave e la voce sopra di lei sul ramo (null per le righe di profondità 1)
function sulRamo(voce, chiave) {
    for (let v = voce; v; v = v.su) if (v.chiave === chiave) return true;
    return false;
}

function viciniDi(voce, lato) {
    const occ = ultimoIndice.occorrenze.get(voce.chiave);
    if (!occ) return [];
    return [...occ[lato]].filter(k => !sulRamo(voce, k));
}

// Profondità massima D con le righe delle due sezioni fino a D entro il limite; la profondità 1 si vede sempre.
// Conta senza costruire le righe e si ferma appena il totale supera il limite
function profonditaAperta(radice, limite) {
    const partenza = { chiave: radice, su: null };
    let fronti = [
        { lato: 'padri', voci: [partenza] },
        { lato: 'figli', voci: [partenza] }
    ];
    let totale = 0;
    let profondita = 0;
    for (;;) {
        const prossimi = fronti.map(f => ({
            lato: f.lato,
            voci: f.voci.flatMap(v => viciniDi(v, f.lato).map(k => ({ chiave: k, su: v })))
        }));
        const righe = prossimi.reduce((n, f) => n + f.voci.length, 0);
        if (righe === 0) return Math.max(1, profondita);
        totale += righe;
        if (totale > limite) return Math.max(1, profondita);
        profondita++;
        fronti = prossimi;
    }
}

function rigaAperta(ramo, profondita, D) {
    if (ramiAperti.has(ramo)) return true;
    if (ramiChiusi.has(ramo)) return false;
    return profondita < D;
}

function etichettaBlocco(occ) {
    return occ.cliente ? 'Cliente' : occ.etichette.at(-1) || '';
}

function suggerimento(occ) {
    return [pathStack[0].label, ...occ.etichette].join(' › ');
}

function idMostrato(occ) {
    return occ.cliente ? occ.req.idCliente : occ.reqId;
}

function contenutoRiga(occ) {
    const ritirato = occ.cliente && occ.req.stato === 'ritirato';
    return `<span class="pallino-classe" style="background:${escapeHtml(getColoreRequisito(occ.req))}"></span>
        <span class="riga-gerarchia-id">${escapeHtml(idMostrato(occ))}</span>
        <span class="riga-gerarchia-titolo">${escapeHtml(titoloRequisito(occ.req))}</span>
        <span class="riga-gerarchia-blocco">${escapeHtml(etichettaBlocco(occ))}</span>
        ${ritirato ? '<span class="segno-rit" title="Ritirato">ritirato</span>' : ''}`;
}

// Righe di una sezione, solo quelle visibili: sotto un ramo chiuso non si costruisce nulla
function righeSezione(sezione, radice, lato, D) {
    const righe = [];
    function aggiungi(voce, profondita, chiaviRamo) {
        const occ = ultimoIndice.occorrenze.get(voce.chiave);
        if (!occ) return;
        const ramo = `${sezione}:${JSON.stringify(chiaviRamo)}`;
        const vicini = viciniDi(voce, lato);
        const aperta = vicini.length > 0 && rigaAperta(ramo, profondita, D);
        const segno = vicini.length === 0 ? '<span class="segno-ramo"></span>'
            : `<button class="segno-ramo" data-ramo="${escapeHtml(ramo)}" data-aperto="${aperta}" aria-expanded="${aperta}" title="${aperta ? 'Chiudi' : 'Apri'}">${aperta ? '▾' : '▸'}</button>`;
        const ritirato = occ.cliente && occ.req.stato === 'ritirato';
        righe.push(`<div class="riga-gerarchia${ritirato ? ' riga-gerarchia-ritirata' : ''}" data-chiave="${escapeHtml(voce.chiave)}"
            style="padding-left:${(profondita - 1) * 14 + 4}px" title="${escapeHtml(suggerimento(occ))}">${segno}${contenutoRiga(occ)}</div>`);
        if (aperta) vicini.forEach(k => aggiungi({ chiave: k, su: voce }, profondita + 1, [...chiaviRamo, k]));
    }
    const partenza = { chiave: radice, su: null };
    viciniDi(partenza, lato).forEach(k => aggiungi({ chiave: k, su: partenza }, 1, [k]));
    return righe.join('');
}

function htmlScheda() {
    const indice = ultimoIndice;
    if (indice.libreriaAssente) {
        return `<div class="empty-props">Libreria non caricata: la gerarchia riparte quando la carichi</div>`;
    }
    if (chiaveScelta === null) {
        return `<div class="empty-props">Clicca un pin, una porta o un blocco tondo, oppure usa 🌳 Mostra gerarchia nel dettaglio di un requisito cliente</div>`;
    }
    if (sceltaSparita() || !ultimaCatena) {
        return `<div class="empty-props">Il requisito scelto non c'è più</div>`;
    }

    const occ = indice.occorrenze.get(chiaveScelta);
    const c = ultimaCatena;
    const D = profonditaAperta(chiaveScelta, appSettings.gerarchia.righeAperte);
    const antenati = c.antenati.size
        ? righeSezione('antenati', chiaveScelta, 'padri', D)
        : `<div class="vuoto-gerarchia">${occ.cliente ? 'È un requisito cliente: la catena parte da qui' : 'Nessun antenato'}</div>`;
    const discendenti = c.discendenti.size
        ? righeSezione('discendenti', chiaveScelta, 'figli', D)
        : `<div class="vuoto-gerarchia">Nessun discendente</div>`;
    const ritirato = occ.cliente && occ.req.stato === 'ritirato';

    return `<div class="sezione-gerarchia">
            <div class="titolo-sezione-gerarchia"><span>Antenati</span><span class="conteggio-gerarchia" title="Occorrenze diverse">${escapeHtml(plurale(c.antenati.size, 'occorrenza', 'occorrenze'))}</span></div>
            ${antenati}
        </div>
        <div class="barra-gerarchia${ritirato ? ' riga-gerarchia-ritirata' : ''}" title="${escapeHtml(suggerimento(occ))}">
            ${contenutoRiga(occ)}
            <button id="btnTogliSceltaGerarchia" class="togli-gerarchia" title="Togli la scelta (Esc)">✕</button>
        </div>
        <div class="sezione-gerarchia">
            <div class="titolo-sezione-gerarchia"><span>Discendenti</span><span class="conteggio-gerarchia" title="Occorrenze diverse">${escapeHtml(plurale(c.discendenti.size, 'occorrenza', 'occorrenze'))}</span></div>
            ${discendenti}
        </div>`;
}

// forza: ridisegna anche se il contenuto non è cambiato (apertura della scheda, nuova scelta, rami)
export function aggiornaSchedaGerarchia(forza = false) {
    schedaDaAggiornare = false;
    const contenitore = document.getElementById('gerarchiaContenuto');
    if (!contenitore || !modalitaAttiva) return;
    if (!ultimoIndice) ricalcolaGerarchia();
    const html = htmlScheda();
    if (!forza && html === ultimoHtmlScheda) return;
    ultimoHtmlScheda = html;
    contenitore.innerHTML = html;
}

function cambiaRamo(ramo, aperto) {
    if (aperto) {
        ramiAperti.delete(ramo);
        ramiChiusi.add(ramo);
    } else {
        ramiChiusi.delete(ramo);
        ramiAperti.add(ramo);
    }
    aggiornaSchedaGerarchia(true);
}

/* --- INIZIALIZZAZIONE --- */

export function initGerarchia() {
    document.getElementById('btnGerarchia')?.addEventListener('click', cambiaModalitaGerarchia);

    document.getElementById('gerarchiaContenuto')?.addEventListener('click', (e) => {
        if (e.target.closest('#btnTogliSceltaGerarchia')) {
            togliScelta();
            return;
        }
        const segno = e.target.closest('[data-ramo]');
        if (segno) {
            e.stopPropagation();
            cambiaRamo(segno.dataset.ramo, segno.dataset.aperto === 'true');
            return;
        }
        const riga = e.target.closest('.riga-gerarchia[data-chiave]');
        if (riga) vaiAOccorrenza(riga.dataset.chiave);
    });

    // Esc toglie la scelta: mai dentro un campo di testo, con una finestra aperta, a modalità spenta o senza scelta
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !modalitaAttiva || chiaveScelta === null) return;
        if (e.target.closest?.('input, textarea, select, [contenteditable]') || modaleAperta()) return;
        e.preventDefault();
        togliScelta();
    });

    aggiornaPulsante();
}
