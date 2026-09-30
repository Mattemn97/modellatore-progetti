/* --- MODELLO DATI: BLOCCHI, REQUISITI, TESTI DA ESPORTARE, REGOLE DI COLLEGAMENTO E MIGRAZIONE --- */

// Formato della libreria (chiave = id del blocco):
// { [id]: { id, titolo, descrizione, categoria, sottocategoria,
//           requisiti: [{ id, titolo, tipologia, metodoVerifica,
//                         testiExport: [{ testo, documento }] }] } }
// Un requisito con tipologia è di interfaccia; con tipologia null è di capacità.

import { appSettings } from './state.js';
import { generaId } from './utils.js';

export const CAPACITA = 'Capacità';

export function isInterfaccia(req) {
    return Boolean(req && req.tipologia);
}

// Classe usata da filtri e colori: la tipologia per l'interfaccia, 'Capacità' altrimenti
export function getClasseRequisito(req) {
    return isInterfaccia(req) ? req.tipologia : CAPACITA;
}

export function getTipologie() {
    return Object.keys(appSettings?.requirements?.typeColors || {});
}

export function getColoreRequisito(req) {
    const colori = appSettings.requirements;
    if (!isInterfaccia(req)) return colori.capabilityColor;
    return colori.typeColors[req.tipologia] || '#555';
}

export function descriviRequisito(req) {
    const righe = [
        `${req.id} · ${req.titolo || '(senza titolo)'}`,
        isInterfaccia(req) ? `Interfaccia: ${req.tipologia}` : 'Capacità',
        `Verifica: ${req.metodoVerifica || 'non definita'}`
    ];
    req.testiExport.forEach(t => righe.push(`[${t.documento || '?'}] ${t.testo}`));
    return righe.join('\n');
}

/* --- MIGRAZIONE: accetta il formato vecchio (name/category/requirements/type),
       la bozza con chiavi con spazi ("metodo di verifica", export_text) e il formato nuovo --- */

function primoDefinito(...valori) {
    return valori.find(v => v !== undefined && v !== null);
}

function comeTesto(valore) {
    return String(valore ?? '').trim();
}

export function normalizzaTestoExport(raw) {
    return {
        testo: comeTesto(primoDefinito(raw?.testo, raw?.description)),
        documento: comeTesto(primoDefinito(raw?.documento, raw?.['documento di riferimento']))
    };
}

export function normalizzaRequisito(raw) {
    let tipologia = comeTesto(primoDefinito(raw.tipologia, raw.type)) || null;

    // La bozza usava un flag "interfaccia" esplicito: ora decide solo la tipologia
    if (raw.interfaccia !== undefined) {
        const eInterfaccia = raw.interfaccia === true || raw.interfaccia === 'true';
        if (!eInterfaccia) {
            tipologia = null;
        } else if (!tipologia) {
            tipologia = getTipologie()[0] || null;
            console.warn(`Requisito '${raw.id}': era di interfaccia senza tipologia, assegnata '${tipologia}'. Controllala.`);
        }
    }

    let testi = primoDefinito(raw.testiExport, raw.export_text);
    if (!Array.isArray(testi)) {
        // Nel formato vecchio la descrizione era un solo testo senza documento
        testi = raw.description ? [{ testo: raw.description, documento: '' }] : [];
    }

    return {
        id: comeTesto(primoDefinito(raw.id, generaId('req'))),
        titolo: comeTesto(primoDefinito(raw.titolo, raw.title, raw.name)),
        tipologia,
        metodoVerifica: comeTesto(primoDefinito(raw.metodoVerifica, raw['metodo di verifica'])),
        testiExport: testi.map(normalizzaTestoExport)
    };
}

export function normalizzaBlocco(chiave, raw) {
    let categoria = comeTesto(primoDefinito(raw.categoria, raw.category));
    let sottocategoria = comeTesto(primoDefinito(raw.sottocategoria, raw['sotto-categoria']));

    // Formato vecchio: "Elettrica/Controllo" in un solo campo
    if (!sottocategoria && categoria.includes('/')) {
        const [prima, ...resto] = categoria.split('/');
        categoria = prima.trim();
        sottocategoria = resto.join('/').trim();
    }

    const requisiti = primoDefinito(raw.requisiti, raw.requirements, raw.req);

    return {
        id: chiave,
        titolo: comeTesto(primoDefinito(raw.titolo, raw.title, raw.name, chiave)),
        descrizione: comeTesto(primoDefinito(raw.descrizione, raw.description)),
        categoria,
        sottocategoria,
        requisiti: Array.isArray(requisiti) ? requisiti.map(normalizzaRequisito) : []
    };
}

// Accetta { library: {...} }, { libreria: {...} } oppure la mappa nuda
export function normalizzaLibreria(dati) {
    const mappa = dati?.library || dati?.libreria || dati;
    if (!mappa || typeof mappa !== 'object' || Array.isArray(mappa)) {
        throw new Error('Il file non contiene una libreria di blocchi valida.');
    }
    const libreria = {};
    Object.entries(mappa).forEach(([chiave, raw]) => {
        if (raw && typeof raw === 'object') libreria[chiave] = normalizzaBlocco(chiave, raw);
    });
    return libreria;
}

// Id requisito usati in più punti della libreria (devono essere univoci)
export function trovaIdRequisitiDuplicati(libreria) {
    const visti = new Map();
    const duplicati = [];
    Object.values(libreria).forEach(blocco => {
        blocco.requisiti.forEach(req => {
            if (visti.has(req.id)) duplicati.push(`${req.id} (${visti.get(req.id)} e ${blocco.id})`);
            else visti.set(req.id, blocco.id);
        });
    });
    return duplicati;
}

// Primo id libero del tipo base_001, base_002, ... non presente in libreria né in 'occupatiExtra'
export function idRequisitoLibero(libreria, base, occupatiExtra = []) {
    const occupati = new Set(occupatiExtra);
    Object.values(libreria).forEach(b => b.requisiti.forEach(r => occupati.add(r.id)));
    for (let n = 1; ; n++) {
        const candidato = `${base}_${String(n).padStart(3, '0')}`;
        if (!occupati.has(candidato)) return candidato;
    }
}

/* --- REGOLE DI COLLEGAMENTO --- */

// Un estremo di un filo: { ownerId, reqId, ownerType: 'node' | 'parent', req }
// Restituisce il motivo per cui il collegamento non è ammesso, oppure null
export function verificaCompatibilita(a, b) {
    if (!a.req || !b.req) return 'Uno dei due requisiti non esiste più.';
    if (a.ownerType === b.ownerType && a.ownerId === b.ownerId && a.reqId === b.reqId) {
        return 'Non puoi collegare un requisito a se stesso.';
    }
    if (a.ownerType === 'parent' && b.ownerType === 'parent') {
        return 'Due requisiti del blocco padre non si collegano tra loro.';
    }
    if (isInterfaccia(a.req) !== isInterfaccia(b.req)) {
        return 'Un requisito di interfaccia si collega solo a un altro requisito di interfaccia, uno di capacità solo a un altro di capacità.';
    }
    if (isInterfaccia(a.req) && a.req.tipologia !== b.req.tipologia) {
        return `Tipologie diverse: '${a.req.tipologia}' e '${b.req.tipologia}'.`;
    }
    return null;
}

export function verificaCollegamento(a, b, edges) {
    const errore = verificaCompatibilita(a, b);
    if (errore) return errore;
    const stessoEstremo = (edgeId, edgeHandle, edgeType, e) =>
        edgeId === e.ownerId && edgeHandle === e.reqId && edgeType === e.ownerType;
    const esiste = edges.some(edge =>
        (stessoEstremo(edge.source, edge.sourceHandle, edge.sourceType, a) && stessoEstremo(edge.target, edge.targetHandle, edge.targetType, b)) ||
        (stessoEstremo(edge.source, edge.sourceHandle, edge.sourceType, b) && stessoEstremo(edge.target, edge.targetHandle, edge.targetType, a))
    );
    return esiste ? 'Questi due requisiti sono già collegati.' : null;
}

// Un filo che parte da un requisito del blocco padre è una derivazione padre → figlio
export function isDerivazione(edge) {
    return edge.sourceType === 'parent' || edge.targetType === 'parent';
}

/* --- AGGIORNAMENTO DEI RIFERIMENTI DOPO LA MODIFICA DI UN BLOCCO DI LIBRERIA --- */

// Percorre tutto il modello (ogni livello annidato) e, per ogni riferimento ai requisiti del blocco 'blockId':
// rinomina gli id cambiati (mappaRinomina: vecchioId → nuovoId), toglie le posizioni dei pin non più validi
// e rimuove i fili che puntano a requisiti eliminati o non più compatibili. Restituisce i fili rimossi.
export function aggiornaRiferimentiRequisiti(radice, libreria, blockId, mappaRinomina) {
    const rinomina = id => mappaRinomina[id] || id;
    const requisitiBlocco = libreria[blockId]?.requisiti || [];
    const trovaNelBlocco = id => requisitiBlocco.find(r => r.id === id);
    let filiRimossi = 0;

    function riallineaMappa(mappa, tieni) {
        if (!mappa) return mappa;
        const nuova = {};
        Object.entries(mappa).forEach(([id, valore]) => {
            const nuovoId = rinomina(id);
            if (tieni(trovaNelBlocco(nuovoId))) nuova[nuovoId] = valore;
        });
        return nuova;
    }

    function visita(graph, tipoPadre) {
        const tipoEstremo = (ownerId, ownerType) =>
            ownerType === 'parent' ? tipoPadre : graph.nodes.find(n => n.id === ownerId)?.type;
        const reqEstremo = (ownerId, reqId, ownerType) =>
            libreria[tipoEstremo(ownerId, ownerType)]?.requisiti.find(r => r.id === reqId) || null;

        if (tipoPadre === blockId) {
            graph.parentReqPositions = riallineaMappa(graph.parentReqPositions, req => Boolean(req));
        }

        graph.edges = graph.edges.filter(edge => {
            const tocca = tipoEstremo(edge.source, edge.sourceType) === blockId ||
                          tipoEstremo(edge.target, edge.targetType) === blockId;
            if (!tocca) return true;

            if (tipoEstremo(edge.source, edge.sourceType) === blockId) edge.sourceHandle = rinomina(edge.sourceHandle);
            if (tipoEstremo(edge.target, edge.targetType) === blockId) edge.targetHandle = rinomina(edge.targetHandle);

            const a = { ownerId: edge.source, reqId: edge.sourceHandle, ownerType: edge.sourceType, req: reqEstremo(edge.source, edge.sourceHandle, edge.sourceType) };
            const b = { ownerId: edge.target, reqId: edge.targetHandle, ownerType: edge.targetType, req: reqEstremo(edge.target, edge.targetHandle, edge.targetType) };
            const valido = verificaCompatibilita(a, b) === null;
            if (!valido) filiRimossi++;
            return valido;
        });

        graph.nodes.forEach(node => {
            if (node.type === blockId) {
                // Le porte sul bordo esistono solo per i requisiti di interfaccia
                node.pinPositions = riallineaMappa(node.pinPositions, req => isInterfaccia(req));
            }
            if (node.internal_graph) visita(node.internal_graph, node.type);
        });
    }

    visita(radice, null);
    return filiRimossi;
}
