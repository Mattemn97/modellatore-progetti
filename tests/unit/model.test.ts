/* --- TEST: REGOLE DEL MODELLO (src/renderer/model.ts, spec 0020 AC-5) --- */
import { beforeAll, describe, expect, it } from 'vitest';
import {
    aggiornaRiferimentiRequisiti, getClasseRequisito, idRequisitoLibero, normalizzaLibreria, trovaIdRequisitiDuplicati,
    verificaCollegamento, verificaCompatibilita, visitaDerivazioni, type Estremo, type EsitoFilo
} from '../../src/renderer/model';
import * as stato from '../../src/renderer/state';
import type { Cliente, Grafo, Libreria, Requisito, RequisitoLibreria } from '../../src/renderer/tipi';

const req = (id: string, tipologia: string | null): RequisitoLibreria => ({ id, titolo: id, tipologia, metodoVerifica: 'Test', testiExport: [] });
const estremo = (ownerId: string, r: Requisito | null, ownerType: 'node' | 'parent' = 'node'): Estremo => ({ ownerId, reqId: r?.id ?? 'x', ownerType, req: r });

const LIB: Libreria = {
    a: { id: 'a', titolo: 'A', descrizione: '', categoria: '', sottocategoria: '', requisiti: [req('a1', 'Elettrica'), req('a2', null)] },
    b: { id: 'b', titolo: 'B', descrizione: '', categoria: '', sottocategoria: '', requisiti: [req('b1', 'Elettrica'), req('b2', null), req('b3', 'Segnale')] }
};

beforeAll(async () => {
    // getTipologie e i colori leggono le impostazioni: quelle predefinite bastano
    globalThis.fetch = (async () => new Response('{}')) as typeof fetch;
    await stato.loadSettings();
});

describe('regole di collegamento', () => {
    it('interfaccia con interfaccia della stessa tipologia, capacità con capacità', () => {
        expect(verificaCompatibilita(estremo('n1', req('a1', 'Elettrica')), estremo('n2', req('b1', 'Elettrica')))).toBeNull();
        expect(verificaCompatibilita(estremo('n1', req('a2', null)), estremo('n2', req('b2', null)))).toBeNull();
        expect(verificaCompatibilita(estremo('n1', req('a1', 'Elettrica')), estremo('n2', req('b2', null)))).toMatch(/interfaccia/);
        expect(verificaCompatibilita(estremo('n1', req('a1', 'Elettrica')), estremo('n2', req('b3', 'Segnale')))).toMatch(/Tipologie diverse/);
    });

    it('niente fili su se stesso, tra due blocchi tondi o verso requisiti spariti', () => {
        const r = req('a1', 'Elettrica');
        expect(verificaCompatibilita(estremo('n1', r), estremo('n1', r))).toMatch(/se stesso/);
        expect(verificaCompatibilita(estremo('p', r, 'parent'), estremo('p', req('x', 'Elettrica'), 'parent'))).toMatch(/blocco padre/);
        expect(verificaCompatibilita(estremo('n1', null), estremo('n2', r))).toMatch(/non esiste più/);
    });

    it('un filo nuovo non duplica uno esistente né parte da un requisito cliente ritirato', () => {
        const a = estremo('n1', req('a1', 'Elettrica'));
        const b = estremo('n2', req('b1', 'Elettrica'));
        const filo = { id: 'e', source: 'n2', sourceHandle: 'b1', sourceType: 'node' as const, target: 'n1', targetHandle: 'a1', targetType: 'node' as const, waypoints: [] };
        expect(verificaCollegamento(a, b, [filo])).toMatch(/già collegati/);
        const ritirato: Requisito = { id: 'CLI-1', idCliente: '1', testo: 't', titolo: null, note: null, sezione: null, tipologia: null, stato: 'ritirato', modificato: false, precedente: null };
        expect(verificaCollegamento(estremo('__cliente__', ritirato, 'parent'), estremo('n1', req('a2', null)), [])).toMatch(/ritirato/);
    });

    it('classe: tipologia o Capacità', () => {
        expect(getClasseRequisito(req('x', 'Segnale'))).toBe('Segnale');
        expect(getClasseRequisito(req('x', null))).toBe('Capacità');
    });
});

describe('conversione dei formati vecchi', () => {
    it('name/category/requirements/type e la bozza con chiavi con spazi', () => {
        const lib = normalizzaLibreria({
            vecchio: { name: 'Vecchio', category: 'Elettrica/Controllo', requirements: [{ id: 'v1', name: 'R', type: 'Elettrica', description: 'testo' }] },
            bozza: { titolo: 'Bozza', requisiti: [{ id: 'b1', titolo: 'T', interfaccia: 'true', 'metodo di verifica': 'Analisi', export_text: [{ description: 'x', 'documento di riferimento': 'SSS' }] }] }
        });
        expect(lib.vecchio).toEqual({
            id: 'vecchio', titolo: 'Vecchio', descrizione: '', categoria: 'Elettrica', sottocategoria: 'Controllo',
            requisiti: [{ id: 'v1', titolo: 'R', tipologia: 'Elettrica', metodoVerifica: '', testiExport: [{ testo: 'testo', documento: '' }] }]
        });
        // Interfaccia senza tipologia: la prima tipologia delle impostazioni
        expect(lib.bozza?.requisiti[0]).toEqual({ id: 'b1', titolo: 'T', tipologia: 'Elettrica', metodoVerifica: 'Analisi', testiExport: [{ testo: 'x', documento: 'SSS' }] });
    });

    it('accetta { library } e { libreria }, rifiuta ciò che non è una mappa', () => {
        expect(Object.keys(normalizzaLibreria({ library: { x: { titolo: 'X' } } }))).toEqual(['x']);
        expect(Object.keys(normalizzaLibreria({ libreria: { y: { titolo: 'Y' } } }))).toEqual(['y']);
        expect(() => normalizzaLibreria([1])).toThrow(/libreria di blocchi valida/);
        expect(() => normalizzaLibreria(null)).toThrow();
    });

    it('id dei requisiti: duplicati e primo libero', () => {
        const doppia: Libreria = { ...LIB, c: { ...LIB.a!, id: 'c' } };
        expect(trovaIdRequisitiDuplicati(doppia)).toEqual(['a1 (a e c)', 'a2 (a e c)']);
        expect(idRequisitoLibero({ x: { ...LIB.a!, requisiti: [req('x_001', null)] } }, 'x', ['x_002'])).toBe('x_003');
    });
});

// Radice: cliente CLI-1 → nodo n1 (a2); n1 contiene n2 (b) con a2 → b2
function modello(): { radice: Grafo; cliente: Cliente } {
    const radice: Grafo = {
        nodes: [{
            id: 'n1', type: 'a', label: 'A1', width: 160, height: 60, position: { x: 0, y: 0 },
            internal_graph: {
                nodes: [{ id: 'n2', type: 'b', label: 'B1', width: 160, height: 60, position: { x: 0, y: 0 }, internal_graph: { nodes: [], edges: [] } }],
                edges: [{ id: 'e2', source: 'n1', sourceHandle: 'a2', sourceType: 'parent', target: 'n2', targetHandle: 'b2', targetType: 'node', waypoints: [] }]
            }
        }],
        edges: [{ id: 'e1', source: '__cliente__', sourceHandle: 'CLI-1', sourceType: 'parent', target: 'n1', targetHandle: 'a2', targetType: 'node', waypoints: [] }]
    };
    const cliente: Cliente = {
        prefisso: 'CLI-', ultimoImport: null,
        requisiti: [{ id: 'CLI-1', idCliente: '1', testo: 't', titolo: null, note: null, sezione: null, tipologia: null, stato: 'attivo', modificato: false, precedente: null }]
    };
    return { radice, cliente };
}

describe('visita delle derivazioni', () => {
    it('livelli in profondità, fili con esito, padre e figlio', () => {
        const { radice, cliente } = modello();
        const eventi: string[] = [];
        visitaDerivazioni(radice, LIB, cliente, {
            inizioLivello: (ctx) => eventi.push(`livello ${ctx.percorso.join('/') || 'radice'} padre ${ctx.tipoPadre}`),
            filo: (_ctx, edge, esito: EsitoFilo) => eventi.push(`filo ${edge.id} ${esito.stato} ${esito.padre?.reqId}→${esito.figlio?.reqId}`),
            nodo: (_ctx, nodo, def) => eventi.push(`nodo ${nodo.id} ${def?.id}`)
        });
        expect(eventi).toEqual([
            'livello radice padre null', 'filo e1 valido CLI-1→a2', 'nodo n1 a',
            'livello n1 padre a', 'filo e2 valido a2→b2', 'nodo n2 b',
            // Anche un livello interno vuoto si visita
            'livello n1/n2 padre b'
        ]);
    });

    it('un filo verso un blocco sparito è non valido, verso uno senza definizione è ignorato', () => {
        const { radice, cliente } = modello();
        radice.edges.push({ id: 'e3', source: 'nessuno', sourceHandle: 'a1', sourceType: 'node', target: 'n1', targetHandle: 'a1', targetType: 'node', waypoints: [] });
        const esiti: Record<string, string> = {};
        visitaDerivazioni(radice, { a: LIB.a! }, cliente, { filo: (_c, e, es) => { esiti[e.id] = es.stato; } });
        expect(esiti).toEqual({ e1: 'valido', e3: 'nonValido', e2: 'ignorato' });
    });
});

describe('aggiornamento dei riferimenti dopo un Salva', () => {
    it('rinomina gli id nei fili e toglie i fili diventati incompatibili', () => {
        const { radice } = modello();
        const lib: Libreria = { ...LIB, a: { ...LIB.a!, requisiti: [req('a1', 'Elettrica'), req('a9', null)] } };
        const trovaPadre = (_t: string | null, id: string): Requisito | null => (id === 'CLI-1' ? req('CLI-1', null) : null);
        const rimossi = aggiornaRiferimentiRequisiti(radice, lib, 'a', { a2: 'a9' }, trovaPadre);
        expect(rimossi).toBe(0);
        expect(radice.edges[0]?.targetHandle).toBe('a9');
        expect(radice.nodes[0]?.internal_graph.edges[0]?.sourceHandle).toBe('a9');
        // a9 diventa di interfaccia: il filo con il cliente (capacità) non è più valido
        const libInterfaccia: Libreria = { ...lib, a: { ...lib.a!, requisiti: [req('a9', 'Elettrica')] } };
        expect(aggiornaRiferimentiRequisiti(radice, libInterfaccia, 'a', {}, trovaPadre)).toBe(2);
        expect(radice.edges).toEqual([]);
    });
});
