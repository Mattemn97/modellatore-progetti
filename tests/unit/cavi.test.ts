// @vitest-environment happy-dom
/* --- TEST: CAVI FISICI, REGOLE, PULIZIA, GEOMETRIA ED ELENCO (spec 0036) --- */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Filo, Grafo, Libreria, Nodo, RequisitoLibreria } from '../../src/renderer/tipi';

type Moduli = {
    cavi: typeof import('../../src/renderer/cavi');
    diagramma: typeof import('../../src/renderer/diagramma');
    matrioska: typeof import('../../src/renderer/matrioska');
};
let m: Moduli;

beforeAll(async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'), 'utf-8');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
    globalThis.fetch = (async () => new Response('{}')) as typeof fetch;
    const stato = await import('../../src/renderer/state');
    await stato.loadSettings();
    m = {
        cavi: await import('../../src/renderer/cavi'),
        diagramma: await import('../../src/renderer/diagramma'),
        matrioska: await import('../../src/renderer/matrioska')
    };
});

const req = (id: string, tipologia: string | null = null): RequisitoLibreria => ({ id, titolo: `Titolo ${id}`, tipologia, metodoVerifica: 'Test', testiExport: [] });
const nodo = (id: string, type: string, x = 0, y = 0): Nodo =>
    ({ id, type, label: id.toUpperCase(), width: 220, height: 60, position: { x, y }, internal_graph: { nodes: [], edges: [] }, pinPositions: {} });
const filo = (id: string, source: string, sourceHandle: string, target: string, targetHandle: string, extra: Partial<Filo> = {}): Filo =>
    ({ id, source, sourceHandle, sourceType: 'node', target, targetHandle, targetType: 'node', waypoints: [], ...extra });

const LIB: Libreria = {
    psu: { id: 'psu', titolo: 'Alimentatore', descrizione: '', categoria: 'Energia', sottocategoria: '', requisiti: [req('psu_out', 'Elettrica'), req('psu_can', 'Segnale'), req('psu_cap')] },
    ecu: { id: 'ecu', titolo: 'Centralina', descrizione: '', categoria: 'Controllo', sottocategoria: '', requisiti: [req('ecu_in', 'Elettrica'), req('ecu_can', 'Segnale'), req('ecu_cap')] }
};

// Due blocchi con due fili di interfaccia, uno di capacità e un terzo blocco
function progetto(): Grafo {
    return {
        nodes: [nodo('a', 'psu', 0), nodo('b', 'ecu', 400), nodo('c', 'ecu', 400, 300)],
        edges: [
            filo('e1', 'a', 'psu_out', 'b', 'ecu_in'),
            filo('e2', 'b', 'ecu_can', 'a', 'psu_can'),
            filo('e3', 'a', 'psu_cap', 'b', 'ecu_cap'),
            filo('e4', 'a', 'psu_out', 'c', 'ecu_in')
        ]
    };
}

describe('regole dei cavi (AC-2, AC-5)', () => {
    it('cablabili solo i fili di interfaccia fra i due blocchi, in tutti e due i versi', () => {
        const g = progetto();
        expect(m.cavi.filiFraBlocchi(g, LIB, 'a', 'b').map((e) => e.id)).toEqual(['e1', 'e2']);
        expect(m.cavi.filoCablabile(g, g.edges[2]!, LIB)).toBe(false);
        expect(m.cavi.filoCablabile(g, { ...g.edges[0]!, sourceType: 'parent' }, LIB)).toBe(false);
    });

    it('un cavo nuovo prende i fili ancora senza cavo e la prima sigla libera', () => {
        const g = progetto();
        const w1 = m.cavi.creaCavo(g, g, LIB, 'a', 'b')!;
        expect(w1.sigla).toBe('W001');
        expect(w1.fili).toEqual(['e1', 'e2']);
        const w2 = m.cavi.creaCavo(g, g, LIB, 'b', 'a')!;
        expect(w2.sigla).toBe('W002');
        expect(w2.fili).toEqual([]);
        expect(m.cavi.creaCavo(g, g, LIB, 'a', 'a')).toBeNull();
        expect(m.cavi.creaCavo(g, g, LIB, 'a', 'zz')).toBeNull();
    });

    it('un filo sta in un cavo solo: assegnarlo lo sposta', () => {
        const g = progetto();
        const w1 = m.cavi.creaCavo(g, g, LIB, 'a', 'b')!;
        const w2 = m.cavi.creaCavo(g, g, LIB, 'a', 'b')!;
        m.cavi.assegnaFilo(g, 'e2', w2.id);
        expect(w1.fili).toEqual(['e1']);
        expect(w2.fili).toEqual(['e2']);
        expect(m.cavi.cavoDelFilo(g, 'e2')?.sigla).toBe('W002');
        m.cavi.assegnaFilo(g, 'e2', null);
        expect(m.cavi.cavoDelFilo(g, 'e2')).toBeNull();
    });

    it('eliminare l\'ultimo cavo toglie la chiave: il file resta come prima (AC-1)', () => {
        const g = progetto();
        const w1 = m.cavi.creaCavo(g, g, LIB, 'a', 'b')!;
        m.cavi.eliminaCavo(g, w1.id);
        expect('cavi' in g).toBe(false);
    });

    it('la sigla libera guarda tutti i livelli', () => {
        const g = progetto();
        g.nodes[0]!.internal_graph.cavi = [{ id: 'x', sigla: 'W001', da: 'p', a: 'q', fili: [] }];
        expect(m.cavi.siglaLibera(g)).toBe('W002');
    });
});

describe('riallineaCavi', () => {
    it('toglie fili spariti o non più fra i due blocchi e i cavi con un blocco sparito, a ogni livello', () => {
        const g = progetto();
        m.cavi.creaCavo(g, g, LIB, 'a', 'b');
        m.cavi.creaCavo(g, g, LIB, 'a', 'c');
        g.nodes[1]!.internal_graph = { nodes: [], edges: [], cavi: [{ id: 'k', sigla: 'W009', da: 'p', a: 'q', fili: [] }] };
        g.edges = g.edges.filter((e) => e.id !== 'e1');
        expect(m.cavi.riallineaCavi(g)).toBe(true);
        expect(g.cavi!.map((c) => c.fili)).toEqual([['e2'], ['e4']]);
        expect('cavi' in g.nodes[1]!.internal_graph).toBe(false);
        g.nodes = g.nodes.filter((n) => n.id !== 'c');
        m.cavi.riallineaCavi(g);
        expect(g.cavi!.map((c) => c.sigla)).toEqual(['W001']);
        expect(m.cavi.riallineaCavi(g)).toBe(false);
    });

    it('non guarda la libreria: un tipo mancante non svuota i cavi', () => {
        const g = progetto();
        m.cavi.creaCavo(g, g, LIB, 'a', 'b');
        g.nodes[0]!.type = 'sparito';
        m.cavi.riallineaCavi(g);
        expect(g.cavi![0]!.fili).toEqual(['e1', 'e2']);
    });
});

describe('geometria (AC-4)', () => {
    it('i capi stanno sui lati affacciati, distribuiti lungo il bordo', () => {
        const g = progetto();
        m.cavi.creaCavo(g, g, LIB, 'a', 'b');
        m.cavi.creaCavo(g, g, LIB, 'a', 'b');
        const contesto = m.diagramma.contestoFili(g, null, LIB, null);
        const geo = m.cavi.geometriaCavi(g, contesto);
        const c1 = g.cavi![0]!;
        const c2 = g.cavi![1]!;
        const larghezza = contesto.forma('a')!.larghezza;
        expect(geo.get(c1.id)![0]!.da.punto.x).toBe(larghezza);
        expect(geo.get(c1.id)![0]!.da.direzione).toBe('destra');
        expect(geo.get(c1.id)![0]!.a.punto.x).toBe(400);
        expect(geo.get(c1.id)![0]!.a.direzione).toBe('sinistra');
        expect(geo.get(c1.id)![0]!.da.punto.y).not.toBe(geo.get(c2.id)![0]!.da.punto.y);
        const punti = m.cavi.percorsoCavo(geo.get(c1.id)![0]!, contesto);
        expect(punti[0]).toEqual(geo.get(c1.id)![0]!.da.punto);
        expect(punti[punti.length - 1]).toEqual(geo.get(c1.id)![0]!.a.punto);
    });
});

describe('elenco e cablaggio (AC-7)', () => {
    it('una riga per cavo con livello, componenti e fili dal lato A', () => {
        const g = progetto();
        const w = m.cavi.creaCavo(g, g, LIB, 'a', 'b')!;
        w.tipo = 'STP';
        const righe = m.cavi.elencoCavi(g, 'Progetto');
        expect(righe).toHaveLength(1);
        expect(righe[0]).toMatchObject({ livello: 'Progetto', da: 'A', a: 'B', fili: ['psu_out ↔ ecu_in', 'psu_can ↔ ecu_can'] });
        expect(m.cavi.statoCablaggio(g, LIB)).toEqual({ cavi: 1, cablabili: 3, cablati: 2 });
    });
});

describe('matrioska (AC-8)', () => {
    it('i cavi dell\'interno si copiano con i nuovi id di nodi e fili', () => {
        const interno = progetto();
        m.cavi.creaCavo(interno, interno, LIB, 'a', 'b');
        const lib: Libreria = { ...LIB, rack: { id: 'rack', titolo: 'Rack', descrizione: '', categoria: '', sottocategoria: '', requisiti: [], interno } };
        const { grafo } = m.matrioska.istanziaInterno('rack', 'n1', lib);
        expect(grafo.cavi).toHaveLength(1);
        const cavo = grafo.cavi![0]!;
        const ids = new Set(grafo.nodes.map((n) => n.id));
        expect(ids.has(cavo.da) && ids.has(cavo.a)).toBe(true);
        expect(cavo.fili).toHaveLength(2);
        cavo.fili.forEach((id) => expect(grafo.edges.some((e) => e.id === id)).toBe(true));
        expect(cavo.id).not.toBe(interno.cavi![0]!.id);
    });
});

describe('cavi a più tratti, avviso e immagine (spec 0037)', () => {
    it('un passaggio dà due tratti; la pulizia toglie i passaggi spariti; la copia matrioska li rimappa', () => {
        const g = progetto();
        const w = m.cavi.creaCavo(g, g, LIB, 'a', 'b')!;
        w.via = [{ nodo: 'c', connettore: 'J1' }, { nodo: 'a' }, { nodo: 'zz' }];
        m.cavi.riallineaCavi(g);
        expect(w.via).toEqual([{ nodo: 'c', connettore: 'J1' }]);
        expect(m.cavi.tappeCavo(w)).toEqual(['a', 'c', 'b']);
        const contesto = m.diagramma.contestoFili(g, null, LIB, null);
        expect(m.cavi.geometriaCavi(g, contesto).get(w.id)).toHaveLength(2);
        expect(m.cavi.elencoCavi(g)[0]!.tappe).toEqual(['A', 'C', 'B']);
        const copia = m.cavi.rimappaCavi(g.cavi, (id) => (id === 'c' ? undefined : `${id}2`), (id) => id);
        expect(copia[0]!.via).toBeUndefined();
    });

    it('interfaccia Elettrica senza cavo: avviso solo se il progetto usa i cavi', async () => {
        const { calcolaCoerenza } = await import('../../src/renderer/coerenza');
        const g = progetto();
        const senzaCavo = () => calcolaCoerenza(g, LIB, null).problemi.filter((p) => p.tipo === 'senzaCavo').map((p) => p.edgeId);
        expect(senzaCavo()).toEqual([]);
        m.cavi.creaCavo(g, g, LIB, 'a', 'b');
        // e1 è nel cavo, e2 è Segnale (non richiesto), e4 Elettrica senza cavo
        expect(senzaCavo()).toEqual(['e4']);
    });

    it('immagine: lo strato Cavi disegna i cavi e nessun filo', () => {
        const g = progetto();
        m.cavi.creaCavo(g, g, LIB, 'a', 'b');
        const fili = m.diagramma.svgDiagramma(g, null, LIB, null)!.svg;
        const cavi = m.diagramma.svgDiagramma(g, null, LIB, null, undefined, { strato: 'cavi' })!.svg;
        expect(fili).toContain('stroke-dasharray="8');
        expect(fili).not.toContain('W001');
        expect(cavi).toContain('W001');
        expect(cavi).not.toContain('stroke-dasharray="8');
    });
});
