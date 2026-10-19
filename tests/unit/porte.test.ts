// @vitest-environment happy-dom
/* --- TEST: PORTE PROPAGATE DEI BLOCCHI MATRIOSKA E TABELLE IDV (spec 0035) --- */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Filo, Grafo, Libreria, Nodo, RequisitoLibreria } from '../../src/renderer/tipi';

// I moduli dell'interfaccia cercano i loro elementi all'import: prima la pagina vera, poi l'import
type Moduli = {
    porte: typeof import('../../src/renderer/porte');
    blocco: typeof import('../../src/renderer/blocco');
    model: typeof import('../../src/renderer/model');
    coerenza: typeof import('../../src/renderer/coerenza');
    diagramma: typeof import('../../src/renderer/diagramma');
    matrioska: typeof import('../../src/renderer/matrioska');
    tabelle: typeof import('../../src/renderer/tabelle');
};
let m: Moduli;

beforeAll(async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'), 'utf-8');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
    globalThis.fetch = (async () => new Response('{}')) as typeof fetch;
    const stato = await import('../../src/renderer/state');
    await stato.loadSettings();
    m = {
        porte: await import('../../src/renderer/porte'),
        blocco: await import('../../src/renderer/blocco'),
        model: await import('../../src/renderer/model'),
        coerenza: await import('../../src/renderer/coerenza'),
        diagramma: await import('../../src/renderer/diagramma'),
        matrioska: await import('../../src/renderer/matrioska'),
        tabelle: await import('../../src/renderer/tabelle')
    };
});

const req = (id: string, tipologia: string | null = null): RequisitoLibreria => ({ id, titolo: `Titolo ${id}`, tipologia, metodoVerifica: 'Test', testiExport: [] });
const nodo = (id: string, type: string, x = 0, internal_graph: Grafo = { nodes: [], edges: [] }): Nodo =>
    ({ id, type, label: `${type} ${id}`, width: 220, height: 60, position: { x, y: 0 }, internal_graph, pinPositions: {} });
const filo = (id: string, source: string, sourceHandle: string, target: string, targetHandle: string, extra: Partial<Filo> = {}): Filo =>
    ({ id, source, sourceHandle, sourceType: 'node', target, targetHandle, targetType: 'node', waypoints: [], ...extra });

// Rack contiene un alimentatore e una scheda; la scheda contiene un sensore (matrioska a due piani)
const LIB: Libreria = {
    rack: { id: 'rack', titolo: 'Rack', descrizione: '', categoria: 'Sistema', sottocategoria: '', requisiti: [req('rack_ele', 'Elettrica')] },
    alimentatore: { id: 'alimentatore', titolo: 'Alimentatore', descrizione: '', categoria: 'Elettrica', sottocategoria: 'Potenza', requisiti: [req('ali_out', 'Elettrica'), req('ali_cap')] },
    scheda: { id: 'scheda', titolo: 'Scheda', descrizione: '', categoria: 'Elettronica', sottocategoria: '', requisiti: [req('sch_in', 'Elettrica')] },
    sensore: { id: 'sensore', titolo: 'Sensore', descrizione: '', categoria: 'Misura', sottocategoria: '', requisiti: [req('sen_sig', 'Segnale')] },
    centralina: { id: 'centralina', titolo: 'Centralina', descrizione: '', categoria: 'Controllo', sottocategoria: '', requisiti: [req('cen_sig', 'Segnale'), req('cen_ele', 'Elettrica')] }
};

function modello(): { radice: Grafo; rack: Nodo; scheda: Nodo } {
    const scheda = nodo('n_sch', 'scheda', 300, { nodes: [nodo('n_sen', 'sensore')], edges: [] });
    const rack = nodo('n_rack', 'rack', 0, { nodes: [nodo('n_ali', 'alimentatore'), scheda], edges: [filo('e_dentro', 'n_ali', 'ali_out', 'n_sch', 'sch_in')] });
    const radice: Grafo = { nodes: [rack, nodo('n_cen', 'centralina', 600)], edges: [] };
    return { radice, rack, scheda };
}

describe('porte propagate (spec 0035)', () => {
    it('salgono le interfacce interne senza filo, anche da due piani sotto; le capacità e le porte usate no', () => {
        const { rack } = modello();
        const porte = m.porte.portePropagate(rack, LIB).map((p) => m.porte.chiavePorta(p.reqId, p.percorso));
        // ali_out e sch_in sono collegati dentro; ali_cap è una capacità; sen_sig sale dalla scheda e poi dal rack
        expect(porte).toEqual(['n_sch/n_sen:sen_sig']);
        const forma = m.blocco.formaBlocco(rack, LIB.rack!, LIB, { node: { width: 220, height: 60, selectedBorderColor: '' }, grid: { size: 20 } });
        expect(forma.righe.map((r) => [r.chiave, r.propagata])).toEqual([['rack_ele', false], ['n_sch/n_sen:sen_sig', true]]);
        expect(forma.righe[1]!.etichette).toEqual(['scheda n_sch', 'sensore n_sen']);
        expect(forma.inizioPropagate).toBe(m.blocco.ALTEZZA_TESTA + m.blocco.ALTEZZA_RIGA);
    });

    it('un filo alla radice verso la porta propagata è valido; collegarla dentro la toglie dal bordo e il filo va riparato', () => {
        const { radice, scheda } = modello();
        radice.edges.push(filo('e_su', 'n_cen', 'cen_sig', 'n_rack', 'sen_sig', { targetPercorso: ['n_sch', 'n_sen'] }));
        const prima = m.coerenza.calcolaCoerenza(radice, LIB, null).problemi.filter((p) => p.tipo === 'filoNonValido');
        expect(prima).toHaveLength(0);
        // Dentro la scheda il sensore si collega a una centralina: la porta non sale più
        scheda.internal_graph.nodes.push(nodo('n_cen2', 'centralina', 300));
        scheda.internal_graph.edges.push(filo('e_giu', 'n_sen', 'sen_sig', 'n_cen2', 'cen_sig'));
        const dopo = m.coerenza.calcolaCoerenza(radice, LIB, null).problemi.filter((p) => p.tipo === 'filoNonValido');
        expect(dopo.map((p) => p.edgeId)).toEqual(['e_su']);
        expect(dopo[0]!.motivo).toContain('è già collegata dentro');
        expect(m.porte.motivoPortaNonValida(radice.nodes[0]!, 'sen_sig', ['n_sch', 'gone'], LIB)).toContain("non c'è più");
    });

    it('regole: una porta propagata non va su un blocco tondo; lo stesso filo due volte no, con un percorso diverso sì', () => {
        const est = (ownerId: string, reqId: string, percorso: string[] = [], ownerType: 'node' | 'parent' = 'node') =>
            ({ ownerId, reqId, ownerType, percorso, req: ownerType === 'parent' ? LIB.rack!.requisiti[0]! : Object.values(LIB).flatMap((b) => b.requisiti).find((r) => r.id === reqId)! });
        expect(m.model.verificaCompatibilita(est('n_rack', 'ali_out', ['n_ali']), est('x', 'rack_ele', [], 'parent'))).toContain('blocco tondo');
        const esistenti = [filo('e', 'n_cen', 'cen_ele', 'n_rack', 'ali_out', { targetPercorso: ['n_ali'] })];
        expect(m.model.verificaCollegamento(est('n_cen', 'cen_ele'), est('n_rack', 'ali_out', ['n_ali']), esistenti)).toContain('già collegati');
        expect(m.model.verificaCollegamento(est('n_cen', 'cen_ele'), est('n_rack', 'ali_out', ['n_altro']), esistenti)).toBeNull();
    });

    it('il filo propagato ha il suo punto sul bordo del contenitore, alla riga della porta', () => {
        const { radice } = modello();
        radice.edges.push(filo('e_su', 'n_cen', 'cen_sig', 'n_rack', 'sen_sig', { targetPercorso: ['n_sch', 'n_sen'] }));
        const c = m.diagramma.contestoFili(radice, null, LIB, null);
        // La centralina sta a destra del rack: la porta propagata va sul lato destro, alla seconda riga
        expect(c.lato('n_rack', 'n_sch/n_sen:sen_sig')).toBe('right');
        expect(c.centro('node', 'n_rack', 'sen_sig', ['n_sch', 'n_sen'])).toEqual({ x: 220, y: m.blocco.ALTEZZA_TESTA + m.blocco.ALTEZZA_RIGA + m.blocco.ALTEZZA_FASCIA_PROPAGATE + m.blocco.ALTEZZA_RIGA / 2 });
        expect(m.diagramma.percorsoFilo(radice.edges[0]!, c)).not.toBeNull();
    });

    it('rinominare il requisito interno segue il filo propagato e il lato salvato; togliere l\'interfaccia toglie il filo', () => {
        const { radice, rack } = modello();
        radice.edges.push(filo('e_su', 'n_cen', 'cen_sig', 'n_rack', 'sen_sig', { targetPercorso: ['n_sch', 'n_sen'] }));
        rack.pinPositions = { 'n_sch/n_sen:sen_sig': { side: 'left', ratio: 0.5 }, rack_ele: { side: 'right', ratio: 0.5 } };
        const lib: Libreria = JSON.parse(JSON.stringify(LIB));
        lib.sensore!.requisiti[0]!.id = 'sen_out';
        expect(m.model.aggiornaRiferimentiRequisiti(radice, lib, 'sensore', { sen_sig: 'sen_out' })).toBe(0);
        expect(radice.edges[0]!.targetHandle).toBe('sen_out');
        expect(rack.pinPositions).toEqual({ 'n_sch/n_sen:sen_out': { side: 'left', ratio: 0.5 }, rack_ele: { side: 'right', ratio: 0.5 } });
        lib.sensore!.requisiti[0]!.tipologia = null;
        lib.centralina!.requisiti[0]!.tipologia = null;
        expect(m.model.aggiornaRiferimentiRequisiti(radice, lib, 'sensore', {})).toBe(1);
        expect(radice.edges).toHaveLength(0);
    });

    it('il lato salvato di una capacità resta dopo il Salva del blocco', () => {
        const { radice, rack } = modello();
        const ali = rack.internal_graph.nodes[0]!;
        ali.pinPositions = { ali_cap: { side: 'left', ratio: 0.5 } };
        m.model.aggiornaRiferimentiRequisiti(radice, LIB, 'alimentatore', {});
        expect(ali.pinPositions).toEqual({ ali_cap: { side: 'left', ratio: 0.5 } });
    });

    it('una nuova istanza di un matrioska rimappa i percorsi dei fili propagati e dei lati sugli id nuovi', () => {
        // Interno standard di un "quadro" che contiene un rack (con la sua scheda) e una centralina collegata alla porta propagata
        const { rack } = modello();
        const lib: Libreria = {
            ...LIB,
            quadro: {
                id: 'quadro', titolo: 'Quadro', descrizione: '', categoria: 'Sistema', sottocategoria: '', requisiti: [],
                interno: {
                    nodes: [{ ...rack, pinPositions: { 'n_sch/n_sen:sen_sig': { side: 'left', ratio: 0.5 } } }, nodo('n_cen', 'centralina', 600)],
                    edges: [filo('e_su', 'n_cen', 'cen_sig', 'n_rack', 'sen_sig', { targetPercorso: ['n_sch', 'n_sen'] })]
                }
            }
        };
        const { grafo, filiTolti } = m.matrioska.istanziaInterno('quadro', 'n_nuovo', lib);
        expect(filiTolti).toBe(0);
        const nuovoRack = grafo.nodes.find((n) => n.type === 'rack')!;
        const nuovaScheda = nuovoRack.internal_graph.nodes.find((n) => n.type === 'scheda')!;
        const nuovoSensore = nuovaScheda.internal_graph.nodes[0]!;
        expect(nuovoRack.id).not.toBe('n_rack');
        expect(grafo.edges[0]!.targetPercorso).toEqual([nuovaScheda.id, nuovoSensore.id]);
        expect(Object.keys(nuovoRack.pinPositions ?? {})).toEqual([`${nuovaScheda.id}/${nuovoSensore.id}:sen_sig`]);
    });
});

describe('tabelle IDV (spec 0035)', () => {
    it('componenti con porte libere e propagate, interfacce con i lati, requisiti con istanze e fili', () => {
        const { radice } = modello();
        radice.edges.push(filo('e_su', 'n_cen', 'cen_sig', 'n_rack', 'sen_sig', { targetPercorso: ['n_sch', 'n_sen'] }));
        const componenti = m.tabelle.elencoComponenti(radice, LIB, 'Progetto');
        expect(componenti.map((c) => [c.nodo.id, c.livello, c.porteLibere, c.propagate])).toEqual([
            ['n_rack', 'Progetto', 1, 1],
            ['n_cen', 'Progetto', 1, 0],
            ['n_ali', 'rack n_rack', 0, 0],
            ['n_sch', 'rack n_rack', 0, 1],
            // Il sensore è collegato due piani sopra, attraverso la porta propagata
            ['n_sen', 'rack n_rack › scheda n_sch', 0, 0]
        ]);
        const interfacce = m.tabelle.elencoInterfacce(radice, LIB, null, 'Progetto');
        const su = interfacce.find((r) => r.edge.id === 'e_su')!;
        expect([su.tipo, su.classe, su.propagata, su.valido, su.a.dentro]).toEqual(['interfaccia', 'Segnale', true, true, ['scheda n_sch', 'sensore n_sen']]);
        const requisiti = m.tabelle.elencoRequisiti(radice, LIB);
        expect(requisiti.find((r) => r.req.id === 'sen_sig')).toMatchObject({ istanze: 1, collegate: 1 });
        expect(requisiti.find((r) => r.req.id === 'rack_ele')).toMatchObject({ istanze: 1, collegate: 0 });
    });

    it('riepilogo della Dashboard e matrice N² del livello', () => {
        const { radice } = modello();
        radice.edges.push(filo('e_su', 'n_cen', 'cen_sig', 'n_rack', 'sen_sig', { targetPercorso: ['n_sch', 'n_sen'] }));
        const d = m.tabelle.riepilogoDashboard(radice, LIB, null);
        expect([d.blocchiLibreria, d.istanze, d.fili, d.derivazioni, d.propagate]).toEqual([5, 5, 2, 0, 2]);
        expect(d.perClasse.map((c) => [c.classe, c.fili])).toEqual([['Elettrica', 1], ['Segnale', 1]]);
        const n2 = m.tabelle.matriceN2(radice, LIB);
        expect([...n2.celle.get('n_rack|n_cen')!.entries()]).toEqual([['Segnale', 1]]);
    });
});
