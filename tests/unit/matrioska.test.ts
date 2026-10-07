// @vitest-environment happy-dom
/* --- TEST: BLOCCHI MATRIOSKA, L'INTERNO STANDARD DI UN BLOCCO DI LIBRERIA (spec 0034) --- */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { rinominaTipoNegliInterni } from '../../src/main/api/librerie';
import type { Grafo, Libreria, RequisitoLibreria } from '../../src/renderer/tipi';

// I moduli dell'interfaccia cercano i loro elementi all'import: prima la pagina vera, poi l'import
let m: typeof import('../../src/renderer/matrioska');
let model: typeof import('../../src/renderer/model');

beforeAll(async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'), 'utf-8');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
    globalThis.fetch = (async () => new Response('{}')) as typeof fetch;
    const stato = await import('../../src/renderer/state');
    await stato.loadSettings();
    model = await import('../../src/renderer/model');
    m = await import('../../src/renderer/matrioska');
});

const req = (id: string, tipologia: string | null = null): RequisitoLibreria => ({ id, titolo: id, tipologia, metodoVerifica: 'Test', testiExport: [] });
const nodo = (id: string, type: string, internal_graph: Grafo = { nodes: [], edges: [] }) =>
    ({ id, type, label: type, width: 160, height: 60, position: { x: 100, y: 100 }, internal_graph, pinPositions: {} });

// Sistema contiene alimentatore e pompa: derivazione sys_cap → ali_cap, collegamento ali_ele → pom_ele
function libreria(): Libreria {
    return {
        sistema: { id: 'sistema', titolo: 'Sistema', descrizione: '', categoria: 'S', sottocategoria: '', requisiti: [req('sys_cap')] },
        alimentatore: { id: 'alimentatore', titolo: 'Alimentatore', descrizione: '', categoria: 'E', sottocategoria: '', requisiti: [req('ali_cap'), req('ali_ele', 'Elettrica')] },
        pompa: { id: 'pompa', titolo: 'Pompa', descrizione: '', categoria: 'E', sottocategoria: '', requisiti: [req('pom_ele', 'Elettrica')] },
        motore: { id: 'motore', titolo: 'Motore', descrizione: '', categoria: 'E', sottocategoria: '', requisiti: [req('mot_cap')] }
    };
}

function internoSistema(): Grafo {
    return {
        nodes: [nodo('n_ali', 'alimentatore'), nodo('n_pom', 'pompa')],
        edges: [
            { id: 'e1', source: 'n_vecchia_istanza', sourceHandle: 'sys_cap', sourceType: 'parent', target: 'n_ali', targetHandle: 'ali_cap', targetType: 'node', waypoints: [] },
            { id: 'e2', source: 'n_ali', sourceHandle: 'ali_ele', sourceType: 'node', target: 'n_pom', targetHandle: 'pom_ele', targetType: 'node', waypoints: [{ x: 5, y: 5 }] }
        ],
        parentReqPositions: { sys_cap: { x: 60, y: 60 } }
    };
}

describe('istanziaInterno', () => {
    it('copia con id nuovi; i blocchi tondi appartengono alla nuova istanza; il modello di libreria non cambia', () => {
        const lib = libreria();
        lib.sistema!.interno = internoSistema();
        const prima = JSON.stringify(lib);
        const { grafo, mancanti, filiTolti } = m.istanziaInterno('sistema', 'node_nuovo', lib);
        expect(mancanti).toEqual([]);
        expect(filiTolti).toBe(0);
        expect(grafo.nodes.map((n) => n.type)).toEqual(['alimentatore', 'pompa']);
        expect(grafo.nodes.map((n) => n.id)).not.toContain('n_ali');
        const [ali, pom] = grafo.nodes;
        expect(grafo.edges[0]).toMatchObject({ source: 'node_nuovo', sourceType: 'parent', target: ali!.id, targetHandle: 'ali_cap' });
        expect(grafo.edges[1]).toMatchObject({ source: ali!.id, target: pom!.id, waypoints: [{ x: 5, y: 5 }] });
        expect(grafo.edges[0]!.id).not.toBe('e1');
        expect(grafo.parentReqPositions).toEqual({ sys_cap: { x: 60, y: 60 } });
        expect(JSON.stringify(lib)).toBe(prima);
        // Due istanze non condividono oggetti
        const altra = m.istanziaInterno('sistema', 'node_altro', lib).grafo;
        expect(altra.nodes[0]!.id).not.toBe(ali!.id);
        expect(altra.nodes[0]!.position).not.toBe(ali!.position);
    });

    it('blocchi mancanti saltati con i loro fili, fili non più validi tolti', () => {
        const lib = libreria();
        lib.sistema!.interno = internoSistema();
        delete lib.pompa;
        lib.alimentatore!.requisiti = [req('ali_cap')];
        const { grafo, mancanti, filiTolti } = m.istanziaInterno('sistema', 'n', lib);
        expect(mancanti).toEqual(['pompa']);
        expect(grafo.nodes.map((n) => n.type)).toEqual(['alimentatore']);
        expect(filiTolti).toBe(1);
        expect(grafo.edges).toHaveLength(1);
    });

    it('matrioska: un figlio con l\'interno vuoto prende l\'interno standard del suo tipo, senza cicli', () => {
        const lib = libreria();
        lib.alimentatore!.interno = { nodes: [nodo('n_mot', 'motore')], edges: [] };
        lib.sistema!.interno = internoSistema();
        const { grafo } = m.istanziaInterno('sistema', 'n', lib);
        expect(grafo.nodes[0]!.internal_graph.nodes.map((n) => n.type)).toEqual(['motore']);
        // Un ciclo nella libreria (scritto a mano) non blocca: si ferma
        lib.motore!.interno = { nodes: [nodo('n_ali2', 'alimentatore')], edges: [] };
        const ciclo = m.istanziaInterno('sistema', 'n', lib).grafo;
        // sistema › alimentatore › motore › alimentatore: il secondo alimentatore resta vuoto
        const motore = ciclo.nodes[0]!.internal_graph.nodes[0]!;
        expect(motore.internal_graph.nodes.map((n) => n.type)).toEqual(['alimentatore']);
        expect(motore.internal_graph.nodes[0]!.internal_graph.nodes).toEqual([]);
    });

    it('un blocco senza interno standard dà un interno vuoto', () => {
        expect(m.istanziaInterno('pompa', 'n', libreria()).grafo).toEqual({ nodes: [], edges: [] });
    });
});

describe('controlli e riepiloghi', () => {
    it('contiene se stesso, anche attraverso l\'interno standard di un altro blocco', () => {
        const lib = libreria();
        expect(m.contieneSeStesso('sistema', internoSistema(), lib)).toBe(false);
        expect(m.contieneSeStesso('sistema', { nodes: [nodo('x', 'pompa', { nodes: [nodo('y', 'sistema')], edges: [] })], edges: [] }, lib)).toBe(true);
        lib.pompa!.interno = { nodes: [nodo('z', 'sistema')], edges: [] };
        expect(m.contieneSeStesso('sistema', internoSistema(), lib)).toBe(true);
    });

    it('tipi mancanti, blocchi che usano un tipo, riepilogo di tutti i livelli', () => {
        const lib = libreria();
        const interno = { nodes: [nodo('a', 'pompa', { nodes: [nodo('b', 'sconosciuto')], edges: [] })], edges: internoSistema().edges };
        expect(m.tipiMancanti(interno, lib)).toEqual(['sconosciuto']);
        lib.sistema!.interno = internoSistema();
        expect(m.interniCheUsano('pompa', lib)).toEqual(['Sistema']);
        expect(m.descriviRiassunto(m.riassuntoInterno(interno))).toBe('2 blocchi, 2 fili');
    });

    it('le rinomine dei requisiti del blocco seguono nel suo interno', () => {
        const lib = libreria();
        const nuovo = { ...lib.sistema!, requisiti: [req('sys_cap2')] };
        const { interno, filiTolti } = m.rinominaNellInterno('sistema', internoSistema(), { ...lib, sistema: nuovo }, { sys_cap: 'sys_cap2' });
        expect(filiTolti).toBe(0);
        expect(interno.edges[0]).toMatchObject({ sourceHandle: 'sys_cap2' });
        expect(interno.parentReqPositions).toEqual({ sys_cap2: { x: 60, y: 60 } });
    });

    it('normalizzaBlocco conserva l\'interno; senza interno il blocco resta quello della 2.1.0', () => {
        const conInterno = model.normalizzaBlocco('sistema', { titolo: 'Sistema', requisiti: [], interno: internoSistema() });
        expect(conInterno.interno?.nodes).toHaveLength(2);
        const senza = model.normalizzaBlocco('pompa', { titolo: 'Pompa', requisiti: [] });
        expect(senza).not.toHaveProperty('interno');
        expect(model.normalizzaBlocco('x', { titolo: 'X', requisiti: [], interno: 'rotto' })).not.toHaveProperty('interno');
    });
});

describe('rinomina di un blocco nel processo principale', () => {
    it('il tipo cambia a ogni livello degli interni, il resto e l\'ordine delle chiavi restano', () => {
        const interno = { nodes: [{ id: 'a', type: 'pompa', label: 'P', internal_graph: { nodes: [{ id: 'b', type: 'pompa' }], edges: [] } }], edges: [{ id: 'e' }] };
        const rinominato = rinominaTipoNegliInterni(interno, 'pompa', 'pompa2') as typeof interno;
        expect(rinominato.nodes[0]!.type).toBe('pompa2');
        expect(rinominato.nodes[0]!.internal_graph.nodes[0]!.type).toBe('pompa2');
        expect(Object.keys(rinominato.nodes[0]!)).toEqual(['id', 'type', 'label', 'internal_graph']);
        expect(rinominato.edges).toEqual([{ id: 'e' }]);
        expect(interno.nodes[0]!.type).toBe('pompa');
    });
});
