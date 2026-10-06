// @vitest-environment happy-dom
/* --- TEST: REGOLE PURE DI COERENZA, GERARCHIA, MATRICE, DOCUMENTI E FILTRI (spec 0020 AC-5) --- */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Cliente, Grafo, Libreria, RequisitoCliente, RequisitoLibreria } from '../../src/renderer/tipi';

// I moduli dell'interfaccia cercano i loro elementi all'import: prima la pagina vera, poi l'import
type Moduli = {
    coerenza: typeof import('../../src/renderer/coerenza');
    gerarchia: typeof import('../../src/renderer/gerarchia');
    matrice: typeof import('../../src/renderer/matrice');
    documenti: typeof import('../../src/renderer/documenti');
    filtri: typeof import('../../src/renderer/filtri');
    stato: typeof import('../../src/renderer/state');
    model: typeof import('../../src/renderer/model');
    diagramma: typeof import('../../src/renderer/diagramma');
};
let m: Moduli;

beforeAll(async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'), 'utf-8');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
    globalThis.fetch = (async () => new Response('{}')) as typeof fetch;
    m = {
        stato: await import('../../src/renderer/state'),
        coerenza: await import('../../src/renderer/coerenza'),
        gerarchia: await import('../../src/renderer/gerarchia'),
        matrice: await import('../../src/renderer/matrice'),
        documenti: await import('../../src/renderer/documenti'),
        filtri: await import('../../src/renderer/filtri'),
        model: await import('../../src/renderer/model'),
        diagramma: await import('../../src/renderer/diagramma')
    };
    await m.stato.loadSettings();
});

const req = (id: string, tipologia: string | null, documento: string, metodo = 'Test'): RequisitoLibreria =>
    ({ id, titolo: `Titolo ${id}`, tipologia, metodoVerifica: metodo, testiExport: [{ testo: `Testo di ${id}`, documento }] });
const clienteReq = (idCliente: string, stato: 'attivo' | 'ritirato' = 'attivo'): RequisitoCliente => ({
    id: `CLI-${idCliente}`, idCliente, testo: `Frase ${idCliente}`, titolo: null, note: null, sezione: null, tipologia: null, stato, modificato: false, precedente: null
});

const LIB: Libreria = {
    sistema: { id: 'sistema', titolo: 'Sistema', descrizione: 'Il sistema', categoria: 'Sistema', sottocategoria: '', requisiti: [req('sys_cap', null, 'SSS'), req('sys_ele', 'Elettrica', 'IRS')] },
    alimentatore: { id: 'alimentatore', titolo: 'Alimentatore', descrizione: 'Fornisce 24V', categoria: 'Elettrica', sottocategoria: 'Potenza', requisiti: [req('ali_cap', null, 'SSDD', ''), req('ali_ele', 'Elettrica', 'IDD')] }
};

// Radice: CLI-1 → sistema.sys_cap; CLI-2 senza figli; CLI-3 ritirato con un filo.
// Dentro sistema: alimentatore; sys_cap → ali_cap; sys_ele senza figli; ali_ele senza padre
function modello(): { radice: Grafo; cliente: Cliente } {
    const radice: Grafo = {
        nodes: [{
            id: 'n_sys', type: 'sistema', label: 'Sistema 1', width: 160, height: 60, position: { x: 0, y: 0 },
            internal_graph: {
                nodes: [{ id: 'n_ali', type: 'alimentatore', label: 'Alim 1', width: 160, height: 60, position: { x: 0, y: 0 }, internal_graph: { nodes: [], edges: [] } }],
                edges: [{ id: 'e_int', source: 'n_sys', sourceHandle: 'sys_cap', sourceType: 'parent', target: 'n_ali', targetHandle: 'ali_cap', targetType: 'node', waypoints: [] }]
            }
        }],
        edges: [
            { id: 'e1', source: '__cliente__', sourceHandle: 'CLI-1', sourceType: 'parent', target: 'n_sys', targetHandle: 'sys_cap', targetType: 'node', waypoints: [] },
            { id: 'e3', source: '__cliente__', sourceHandle: 'CLI-3', sourceType: 'parent', target: 'n_sys', targetHandle: 'sys_cap', targetType: 'node', waypoints: [] }
        ]
    };
    return { radice, cliente: { prefisso: 'CLI-', ultimoImport: null, requisiti: [clienteReq('1'), clienteReq('2'), clienteReq('3', 'ritirato')] } };
}

describe('coerenza', () => {
    it('cliente senza figli, filo da ritirato, senza padre e senza figli con i loro percorsi', () => {
        const { radice, cliente } = modello();
        const r = m.coerenza.calcolaCoerenza(radice, LIB, cliente);
        const voci = r.problemi.map((p) => `${p.tipo}:${p.idVoce}:${p.percorso.join('/')}`);
        expect(voci).toEqual([
            'clienteSenzaFigli:2:',
            'senzaPadre:sys_ele:',
            'senzaPadre:ali_ele:n_sys',
            'senzaFigli:sys_ele:n_sys',
            'filoDaRitirato:3:'
        ]);
        expect(r.problemi.find((p) => p.tipo === 'filoDaRitirato')?.motivo).toBe('Requisito ritirato con 1 filo valido');
    });

    it('un blocco senza definizione e un filo verso un blocco sparito vanno in Da riparare', () => {
        const { radice, cliente } = modello();
        radice.nodes.push({ id: 'n_x', type: 'sconosciuto', label: 'X', width: 1, height: 1, position: { x: 0, y: 0 }, internal_graph: { nodes: [], edges: [] } });
        radice.edges.push({ id: 'e_rotto', source: 'n_sparito', sourceHandle: 'a', sourceType: 'node', target: 'n_sys', targetHandle: 'sys_ele', targetType: 'node', waypoints: [] });
        const tipi = m.coerenza.calcolaCoerenza(radice, LIB, cliente).problemi.map((p) => p.tipo);
        expect(tipi.slice(-2)).toEqual(['bloccoSenzaDefinizione', 'filoNonValido']);
    });

    it('senza libreria il risultato lo dice e non ha problemi', () => {
        const { radice, cliente } = modello();
        expect(m.coerenza.calcolaCoerenza(radice, {}, cliente)).toMatchObject({ libreriaAssente: true, problemi: [] });
    });
});

describe('gerarchia', () => {
    it('occorrenze per istanza, padri e figli, catena con fili e contatori', () => {
        const { radice, cliente } = modello();
        const indice = m.gerarchia.calcolaGerarchia(radice, LIB, cliente);
        expect([...indice.occorrenze.keys()]).toEqual([
            '__cliente__|CLI-1', '__cliente__|CLI-2', '__cliente__|CLI-3',
            'n_sys|sys_cap', 'n_sys|sys_ele', 'n_sys/n_ali|ali_cap', 'n_sys/n_ali|ali_ele'
        ]);
        const catena = m.gerarchia.catenaDi(indice, 'n_sys|sys_cap');
        expect(catena && [...catena.antenati]).toEqual(expect.arrayContaining(['__cliente__|CLI-1', '__cliente__|CLI-3']));
        expect(catena && [...catena.discendenti]).toEqual(['n_sys/n_ali|ali_cap']);
        expect(catena?.contatori.get('n_sys')).toBe(1);
        expect(m.gerarchia.catenaDi(indice, 'non|esiste')).toBeNull();
    });
});

describe('matrice', () => {
    it('gruppi padre → figli con stato e note, senza padre per istanza, filtro per documento e lato', () => {
        const { radice, cliente } = modello();
        const indice = m.gerarchia.calcolaGerarchia(radice, LIB, cliente);
        const mat = m.matrice.calcolaMatrice(indice, LIB, cliente, 'Radice');
        const riassunto = mat.gruppi.map((g) => `${g.padre.idMostrato}→${g.figli.map((f) => f.figlio.idMostrato).join(',')}:${g.stato}:${g.nota}`);
        expect(riassunto).toEqual([
            '1→sys_cap:coperto:',
            '2→:senzaFigli:Senza figli',
            '3→sys_cap:coperto:Ritirato',
            'sys_cap→ali_cap:coperto:',
            'sys_ele→:senzaFigli:Senza figli'
        ]);
        expect(mat.senzaPadre.map((v) => `${v.idMostrato}:${v.notaSenzaPadre}`)).toEqual(['sys_ele:Senza padre', 'ali_ele:Senza padre']);

        const soloSsdd = m.matrice.filtraMatrice(mat, { documento: 'SSDD', lato: 'figlio', classe: '', ricerca: '' });
        expect(soloSsdd.gruppi.map((g) => g.gruppo.padre.idMostrato)).toEqual(['sys_cap']);
        expect(soloSsdd.conteggi).toEqual({ padri: 1, derivazioni: 1, senzaFigli: 0, senzaPadre: 0 });
        const ricerca = m.matrice.filtraMatrice(mat, { documento: '', lato: 'entrambi', classe: '', ricerca: 'ali_ele' });
        expect(ricerca.senzaPadre.map((v) => v.id)).toEqual(['ali_ele']);
    });

    it('celle Markdown con barre e a capo', () => {
        expect(m.matrice.cellaMd('a|b\nc\\d')).toBe('a\\|b c\\\\d');
        expect(m.matrice.tabellaMd(['X', 'Y'], [[1, 'z']])).toEqual(['| X | Y |', '| --- | --- |', '| 1 | z |']);
    });
});

describe('documenti', () => {
    function genera(documento: string) {
        const { radice, cliente } = modello();
        const indice = m.gerarchia.calcolaGerarchia(radice, LIB, cliente);
        const dati = m.documenti.preparaDatiDocumenti(m.matrice.calcolaMatrice(indice, LIB, cliente, 'Radice'), LIB);
        return m.documenti.generaDocumento(dati, documento, { nome: 'Prova', data: '2026-10-05', libreria: { nomeFile: 'libreria.json', versione: '1.2.3' } });
    }

    it('SSS: capacità al capitolo 3.2, qualifica e tracciabilità con la sezione', () => {
        const g = genera('SSS');
        expect(g.riepilogo).toMatchObject({ requisiti: 1, capacita: 1, interfacce: 0, testi: 1, senzaMetodo: 0, senzaPadre: 0 });
        expect(g.testo).toContain('# SSS · Specifica del sistema/sottosistema · Prova');
        expect(g.testo).toContain('### 3.2 Requisiti di capacità del sistema');
        expect(g.testo).toContain('#### 3.2.1 sys_cap · Titolo sys_cap');
        expect(g.testo).toContain('- Deriva da: 1, 3');
        expect(g.testo).toMatch(/\| sys_cap \| Titolo sys_cap \| 3\.2\.1 \| {2}\| {2}\| {2}\| X \|/);
        expect(g.testo).toContain('Libreria: libreria.json v1.2.3');
    });

    it('IRS: interfacce per tipologia nel capitolo dei requisiti, senza padre in tracciabilità', () => {
        const g = genera('IRS');
        expect(g.testo).toContain('Identificazione delle interfacce e diagrammi');
        expect(g.testo).toContain('Interfaccia Elettrica');
        expect(g.testo).toContain('sys_ele · Titolo sys_ele');
        expect(g.riepilogo.senzaPadre).toBe(1);
    });

    it('SSDD: componenti per blocco con la descrizione; un metodo mancante si segnala', () => {
        const g = genera('SSDD');
        expect(g.testo).toContain('Componenti del sistema');
        expect(g.testo).toContain('Fornisce 24V');
        expect(g.riepilogo.senzaMetodo).toBe(1);
        expect(g.testo).toContain('- Metodo di verifica: non definito');
    });
});

describe('documenti ammessi per classe (spec 0027)', () => {
    const regola = { documenti: ['SSS', 'SSDD', 'IRS', 'IDD', 'SRS', 'SDD'], documentiPerClasse: { interfaccia: ['IRS', 'IDD'], capacita: ['SSS', 'SSDD', 'SRS', 'SDD'] } };

    it('capacità e interfaccia, documento non classificato, documento in due liste, lista vuota', () => {
        const mo = m.model;
        expect(mo.motivoNonAmmesso(req('c', null, ''), 'SSS', regola)).toBeNull();
        expect(mo.motivoNonAmmesso(req('c', null, ''), 'IRS', regola)).toBe('un requisito di capacità va solo in SSS, SSDD, SRS, SDD');
        expect(mo.motivoNonAmmesso(req('e', 'Elettrica', ''), ' IRS ', regola)).toBeNull();
        expect(mo.motivoNonAmmesso(req('e', 'Inventata', ''), 'SSS', regola)).toBe('un requisito di interfaccia va solo in IRS, IDD');
        expect(mo.motivoNonAmmesso(req('c', null, ''), 'XYZ', regola)).toBe('"XYZ" non è in documentiPerClasse di settings.json');
        expect(mo.motivoNonAmmesso(req('c', null, ''), '', regola)).toBeNull();
        const doppio = { ...regola, documentiPerClasse: { interfaccia: ['IRS', 'ICD'], capacita: ['SSS', 'ICD'] } };
        expect(mo.motivoNonAmmesso(req('c', null, ''), 'ICD', doppio)).toBeNull();
        expect(mo.motivoNonAmmesso(req('e', 'Segnale', ''), 'ICD', doppio)).toBeNull();
        expect(mo.documentiDellaClasse('interfaccia', doppio)).toEqual(['IRS', 'ICD']);
        const vuota = { ...regola, documentiPerClasse: { interfaccia: [], capacita: ['SSS', 'IRS'] } };
        expect(mo.motivoNonAmmesso(req('e', 'Segnale', ''), 'IRS', vuota)).toBe('nessun documento accetta requisiti di interfaccia');
    });

    it('settings.json: chiave mancante o sbagliata usa il predefinito, voci ripulite', () => {
        const unisci = m.stato.unisciDocumentiPerClasse;
        expect(unisci(undefined)).toEqual(regola.documentiPerClasse);
        expect(unisci({ capacita: 'SSS', interfaccia: [' ICD ', '', 'ICD', 'Cliente'] })).toEqual({ interfaccia: ['ICD'], capacita: regola.documentiPerClasse.capacita });
        expect(unisci({ interfaccia: [] }).interfaccia).toEqual([]);
    });

    it('testi non ammessi per blocco, in ordine di titolo, requisito e testo', () => {
        const lib: Libreria = {
            b2: { id: 'b2', titolo: 'Blocco 10', descrizione: '', categoria: '', sottocategoria: '', requisiti: [req('x', null, 'XYZ')] },
            b1: { id: 'b1', titolo: 'Blocco 2', descrizione: '', categoria: '', sottocategoria: '', requisiti: [req('ok', null, 'SSS'), req('i', 'Elettrica', 'SSS')] }
        };
        expect(m.model.testiNonAmmessi(lib, regola).map((t) => `${t.blockId}:${t.reqId}:${t.documento}`)).toEqual(['b1:i:SSS', 'b2:x:XYZ']);
    });

    it('generatore: esclusione, rinvio, niente Altri requisiti, documenti padre ammessi, selettore', () => {
        // sys_cap ha in più un testo IRS (non ammesso), sys_ele un testo SSS (non ammesso), ali_cap un testo XYZ
        const lib: Libreria = JSON.parse(JSON.stringify(LIB));
        lib.sistema!.requisiti[0]!.testiExport.push({ testo: 'Capacità in IRS', documento: 'IRS' });
        lib.sistema!.requisiti[1]!.testiExport.push({ testo: 'Interfaccia in SSS', documento: 'SSS' });
        lib.alimentatore!.requisiti[0]!.testiExport.push({ testo: 'Fuori standard', documento: 'XYZ' });
        const { radice, cliente } = modello();
        const dati = m.documenti.preparaDatiDocumenti(m.matrice.calcolaMatrice(m.gerarchia.calcolaGerarchia(radice, lib, cliente), lib, cliente, 'Radice'), lib);
        const intest = { nome: 'Prova', data: '2026-10-06', libreria: { nomeFile: 'libreria.json', versione: null } };

        const sss = m.documenti.generaDocumento(dati, 'SSS', intest);
        expect(sss.testo).not.toContain('Interfaccia in SSS');
        expect(sss.testo).toContain('### 3.3 Requisiti di interfaccia esterna del sistema\n\nI requisiti di interfaccia sono nei documenti IRS, IDD.');
        expect(sss.riepilogo.esclusi).toBe(1);

        const irs = m.documenti.generaDocumento(dati, 'IRS', intest);
        expect(irs.testo).not.toContain('Altri requisiti');
        expect(irs.testo).not.toContain('Capacità in IRS');

        // ali_cap deriva da sys_cap: documenti padre solo SSS (IRS non è ammesso per una capacità)
        const ssdd = m.documenti.generaDocumento(dati, 'SSDD', intest);
        expect(ssdd.testo).toMatch(/\| ali_cap \|.*\| sys_cap Titolo sys_cap \| SSS \|/);
        expect(ssdd.testo).toContain('## 2. Documenti di riferimento\n\n- SSS');
        expect(m.documenti.vociDocumento()).toEqual(['SSS', 'SSDD', 'IRS', 'IDD', 'SRS', 'SDD']);
    });
});

describe('diagrammi (spec 0029)', () => {
    it('livello interno: blocco, blocchi tondi del padre, filo di derivazione tratteggiato; livello vuoto null', () => {
        const { radice, cliente } = modello();
        const sistema = radice.nodes[0]!;
        const d = m.diagramma.svgDiagramma(sistema.internal_graph, sistema, LIB, cliente);
        expect(d).not.toBeNull();
        expect(d!.svg).toContain('>Alim 1</text>');
        expect(d!.svg.match(/r="28"/g)).toHaveLength(2);
        expect(d!.svg).toContain('stroke-dasharray="8,4"');
        expect(d!.svg).not.toContain('class=');
        expect(d!.larghezza).toBeGreaterThan(160);
        // Alla radice i requisiti cliente senza posizione non si disegnano, né i loro fili
        const r = m.diagramma.svgDiagramma(radice, null, LIB, cliente)!;
        expect(r.svg).toContain('>Sistema 1</text>');
        expect(r.svg).not.toContain('<path');
        expect(m.diagramma.svgDiagramma({ nodes: [], edges: [] }, null, LIB, cliente)).toBeNull();
        expect([...m.diagramma.interniDeiBlocchi(radice).keys()]).toEqual(['sistema']);
    });

    it('documenti con le figure: radice nei componenti e nell\'identificazione, interno del blocco', () => {
        const { radice, cliente } = modello();
        const dati = m.documenti.preparaDatiDocumenti(m.matrice.calcolaMatrice(m.gerarchia.calcolaGerarchia(radice, LIB, cliente), LIB, cliente, 'Radice'), LIB);
        const intest = { nome: 'Prova', data: '2026-10-06', libreria: { nomeFile: 'libreria.json', versione: null } };
        const opzioni = { radice: true, blocchi: new Set(['alimentatore']) };
        const ssdd = m.documenti.generaDocumento(dati, 'SSDD', intest, opzioni).testo;
        expect(ssdd).toContain('![Diagramma: Prova](diagramma:radice)');
        expect(ssdd).toContain('![Diagramma interno: Alimentatore](diagramma:blocco:alimentatore)');
        const irs = m.documenti.generaDocumento(dati, 'IRS', intest, opzioni).testo;
        expect(irs).toContain('![Diagramma: Prova](diagramma:radice)');
        expect(irs).not.toContain('_Diagrammi da completare._');
        // Senza opzioni (export .md) nulla cambia
        expect(m.documenti.generaDocumento(dati, 'IRS', intest).testo).toContain('_Diagrammi da completare._');
    });
});

describe('filtri', () => {
    it('classe e documento sui requisiti, categoria e sottocategoria sui blocchi', () => {
        const f = m.filtri;
        f.impostaFiltriPerTest({ classi: ['Elettrica'] });
        expect(f.requisitoIncluso(LIB.sistema!.requisiti[1])).toBe(true);
        expect(f.requisitoIncluso(LIB.sistema!.requisiti[0])).toBe(false);
        expect(f.bloccoIncluso(LIB.sistema)).toBe(true);
        f.impostaFiltriPerTest({ documenti: ['Cliente'] });
        expect(f.requisitoIncluso(clienteReq('9'))).toBe(true);
        expect(f.requisitoIncluso(LIB.sistema!.requisiti[0])).toBe(false);
        f.impostaFiltriPerTest({ sottocategorie: ['Potenza'] });
        expect(f.bloccoPassa(LIB.alimentatore)).toBe(true);
        expect(f.bloccoPassa(LIB.sistema)).toBe(false);
        expect(f.classePassa(null)).toBe(true);
        f.impostaFiltriPerTest({});
        expect(f.filtriAttivi()).toBe(0);
    });
});
