/* --- PANNELLI AGGANCIABILI: LAYOUT DOCKVIEW, MENU FINESTRA E SALVATAGGIO (spec 0021) --- */
// I contenitori di index.html restano gli stessi: quando un pannello si vede il suo nodo entra nel pannello,
// altrimenti torna in #pannelliParcheggiati (nascosto). Così getElementById li trova sempre.
import {
    createDockview, themeLight,
    type DockviewApi, type IContentRenderer, type IDockviewPanel, type AddPanelPositionOptions
} from 'dockview-core';

export const PANNELLI = ['libreria', 'cliente', 'coerenza', 'gerarchia', 'canvas', 'ispettore', 'matrice', 'documenti', 'changelog'] as const;
export type IdPannello = typeof PANNELLI[number];

const TITOLI: Record<IdPannello, string> = {
    libreria: 'Libreria', cliente: 'Cliente', coerenza: 'Coerenza',
    gerarchia: 'Gerarchia', canvas: 'Canvas', ispettore: 'Ispettore',
    matrice: 'Matrice', documenti: 'Documenti', changelog: 'Changelog'
};

// Contenitore di ogni pannello in index.html
const NODI: Record<IdPannello, string> = {
    libreria: 'schedaLibreria', cliente: 'schedaCliente', coerenza: 'schedaCoerenza',
    gerarchia: 'schedaGerarchia', canvas: 'canvasContainer', ispettore: 'propertiesPanel',
    matrice: 'pannelloMatrice', documenti: 'pannelloDocumenti', changelog: 'pannelloChangelog'
};

// Le finestre di oggi diventate pannelli (spec 0022): stanno insieme in un gruppo sotto il Canvas
const SOTTO_IL_CANVAS: IdPannello[] = ['matrice', 'documenti', 'changelog'];
const QUOTA_SOTTO = 0.4;

// Pannelli che seguono una modalità spenta all'avvio: non si riaprono dal layout salvato (AC-5)
const LEGATI_A_MODALITA: IdPannello[] = ['coerenza', 'gerarchia'];

const CHIAVE_LAYOUT = 'modellatore.layout';
const VERSIONE_LAYOUT = 1;
const LARGHEZZA_MINIMA_LATERALE = 180;
const LARGHEZZA_MINIMA_CANVAS = 300;
const QUOTA_LATERALE = 0.2;

let api: DockviewApi | null = null;
let chiusuraDaCodice = false;
let timerSalvataggio: ReturnType<typeof setTimeout> | undefined;
const allaChiusuraDi = new Map<IdPannello, () => void>();
const allaVistaDi = new Map<IdPannello, () => void>();
const apertureDalMenu = new Map<IdPannello, () => void>();

export function eIdPannello(id: string): id is IdPannello {
    return (PANNELLI as readonly string[]).includes(id);
}

/* --- CONVALIDA DEL LAYOUT SALVATO (AC-4) --- */

function eOggetto(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null && !Array.isArray(x);
}

// Pura: accetta solo { versione: 1, layout: { grid, panels } } con pannelli noti e il Canvas presente
export function layoutValido(dato: unknown): boolean {
    if (!eOggetto(dato) || dato.versione !== VERSIONE_LAYOUT || !eOggetto(dato.layout)) return false;
    const { grid, panels } = dato.layout;
    if (!eOggetto(grid) || !eOggetto(grid.root) || !eOggetto(panels)) return false;
    const id = Object.keys(panels);
    return id.includes('canvas') && id.every(eIdPannello);
}

function leggiLayout(): unknown {
    try {
        const testo = localStorage.getItem(CHIAVE_LAYOUT);
        return testo ? JSON.parse(testo) : null;
    } catch {
        return null;
    }
}

function scriviLayout(): void {
    if (!api) return;
    try {
        localStorage.setItem(CHIAVE_LAYOUT, JSON.stringify({ versione: VERSIONE_LAYOUT, layout: api.toJSON() }));
    } catch {
        // Senza localStorage il layout vale fino alla chiusura
    }
}

function cancellaLayout(): void {
    try {
        localStorage.removeItem(CHIAVE_LAYOUT);
    } catch {
        // niente da cancellare
    }
}

/* --- CONTENUTO DEI PANNELLI --- */

function parcheggio(): HTMLElement {
    const el = document.getElementById('pannelliParcheggiati');
    if (!el) throw new Error('Manca #pannelliParcheggiati in index.html');
    return el;
}

// Presi una volta all'avvio: un pannello tolto da dockview può portarsi via il nodo fuori dalla pagina
const nodi = new Map<IdPannello, HTMLElement>();
function nodo(id: IdPannello): HTMLElement | null {
    return nodi.get(id) ?? null;
}

// Il nodo sta nel pannello solo mentre si vede: un pannello dietro un'altra scheda viene staccato da dockview
function creaContenuto(id: IdPannello): IContentRenderer {
    const element = document.createElement('div');
    element.className = 'contenuto-pannello';
    element.dataset.pannello = id;
    const entra = () => {
        const n = nodo(id);
        if (!n) return;
        if (n.parentElement !== element) element.appendChild(n);
        // dockview chiama init prima di attaccare il pannello: il richiamo aspetta che il nodo sia nella pagina
        const avvisa = () => {
            if (!n.isConnected || n.parentElement !== element) return;
            try {
                allaVistaDi.get(id)?.();
            } catch (e) {
                console.error(`Pannello ${id}: aggiornamento non riuscito`, e);
            }
        };
        if (n.isConnected) avvisa();
        else requestAnimationFrame(avvisa);
    };
    const esce = () => {
        const n = nodo(id);
        if (n && n.parentElement === element) parcheggio().appendChild(n);
    };
    return {
        element,
        init: (parametri) => {
            if (parametri.api.isVisible) entra();
            parametri.api.onDidVisibilityChange((e) => (e.isVisible ? entra() : esce()));
        },
        dispose: esce
    };
}

function vincoli(id: IdPannello): { minimumWidth: number } {
    return { minimumWidth: id === 'canvas' ? LARGHEZZA_MINIMA_CANVAS : LARGHEZZA_MINIMA_LATERALE };
}

/* --- APERTURA E CHIUSURA --- */

// Riapertura: nel gruppo della Libreria se c'è, altrimenti a sinistra del Canvas (AC-3);
// Matrice, Documenti e Changelog insieme, sotto il Canvas (spec 0022, AC-1)
function posizioneDi(id: IdPannello): AddPanelPositionOptions | undefined {
    if (!api) return undefined;
    if (SOTTO_IL_CANVAS.includes(id)) {
        const vicino = SOTTO_IL_CANVAS.find((altro) => altro !== id && api?.getPanel(altro));
        if (vicino) return { referencePanel: vicino, direction: 'within' };
        return api.getPanel('canvas') ? { referencePanel: 'canvas', direction: 'below' } : undefined;
    }
    if (id !== 'libreria' && api.getPanel('libreria')) return { referencePanel: 'libreria', direction: 'within' };
    if (id === 'ispettore') return { referencePanel: 'canvas', direction: 'right' };
    if (api.getPanel('canvas')) return { referencePanel: 'canvas', direction: 'left' };
    return undefined;
}

function aggiungi(id: IdPannello, posizione: AddPanelPositionOptions | undefined, inattivo = false): IDockviewPanel | null {
    if (!api) return null;
    const sotto = SOTTO_IL_CANVAS.includes(id) && posizione && 'direction' in posizione && posizione.direction === 'below';
    return api.addPanel({
        id, component: id, title: TITOLI[id], inactive: inattivo, ...vincoli(id),
        ...(posizione ? { position: posizione } : {}),
        ...(sotto ? { initialHeight: Math.round(api.height * QUOTA_SOTTO) } : {})
    });
}

export function pannelloAperto(id: IdPannello): boolean {
    return !!api?.getPanel(id);
}

export function pannelloVisibile(id: IdPannello): boolean {
    return !!api?.getPanel(id)?.api.isVisible;
}

export function mostraPannello(id: IdPannello): void {
    if (!api) return;
    const pannello = api.getPanel(id) ?? aggiungi(id, posizioneDi(id));
    pannello?.api.setActive();
}

// Chiusura chiesta dal codice: non richiama allaChiusura (chi chiude sa già perché)
export function chiudiPannello(id: IdPannello): void {
    if (id === 'canvas') return;
    const pannello = api?.getPanel(id);
    if (!api || !pannello) return;
    chiusuraDaCodice = true;
    try {
        api.removePanel(pannello);
    } finally {
        chiusuraDaCodice = false;
    }
}

export function commutaPannello(id: IdPannello): void {
    if (pannelloAperto(id)) chiudiPannello(id);
    else mostraPannello(id);
}

// Cosa fare quando l'utente chiude il pannello (✕ o menu Finestra)
export function allaChiusura(id: IdPannello, funzione: () => void): void {
    allaChiusuraDi.set(id, funzione);
}

// Cosa fare quando il pannello torna visibile (oggi: ridisegnare la scheda)
export function allaVista(id: IdPannello, funzione: () => void): void {
    allaVistaDi.set(id, funzione);
}

/* --- DISPOSIZIONE PREDEFINITA (AC-1) --- */

function disposizionePredefinita(): void {
    if (!api) return;
    aggiungi('canvas', undefined);
    const larghezza = Math.round(api.width * QUOTA_LATERALE);
    const libreria = aggiungi('libreria', { referencePanel: 'canvas', direction: 'left' });
    aggiungi('cliente', { referencePanel: 'libreria', direction: 'within' }, true);
    const ispettore = aggiungi('ispettore', { referencePanel: 'canvas', direction: 'right' });
    if (larghezza > 0) {
        libreria?.group.api.setSize({ width: larghezza });
        ispettore?.group.api.setSize({ width: larghezza });
    }
    api.getPanel('canvas')?.api.setActive();
}

// Svuota dockview senza richiamare allaChiusura e rimette tutti i nodi nel parcheggio
function senzaChiusure(azione: () => void): void {
    chiusuraDaCodice = true;
    try {
        azione();
    } finally {
        chiusuraDaCodice = false;
    }
}

function svuota(): void {
    senzaChiusure(() => api?.clear());
    nodi.forEach((n) => { if (!n.isConnected) parcheggio().appendChild(n); });
}

export function ripristinaLayout(): void {
    if (!api) return;
    const aperti = LEGATI_A_MODALITA.filter((id) => pannelloAperto(id));
    svuota();
    disposizionePredefinita();
    // Le modalità restano come sono: i loro pannelli tornano nel gruppo della Libreria
    aperti.forEach((id) => aggiungi(id, posizioneDi(id), true));
    cancellaLayout();
    scriviLayout();
}

function caricaLayout(): void {
    if (!api) return;
    const salvato = leggiLayout();
    if (layoutValido(salvato)) {
        try {
            senzaChiusure(() => api?.fromJSON((salvato as { layout: Parameters<DockviewApi['fromJSON']>[0] }).layout));
            senzaChiusure(() => LEGATI_A_MODALITA.forEach(chiudiPannello));
            if (api.getPanel('canvas')) return;
        } catch (e) {
            console.warn('Layout salvato non leggibile, uso quello predefinito', e);
        }
        svuota();
    }
    cancellaLayout();
    disposizionePredefinita();
}

/* --- MENU FINESTRA (AC-3) --- */

function aggiornaMenuFinestra(): void {
    document.querySelectorAll<HTMLElement>('#menuFinestra [data-pannello]').forEach((voce) => {
        const id = voce.dataset.pannello ?? '';
        voce.setAttribute('aria-checked', String(eIdPannello(id) && pannelloAperto(id)));
    });
}

function initMenuFinestra(): void {
    const pulsante = document.getElementById('btnMenuFinestra');
    const menu = document.getElementById('menuFinestra');
    if (!pulsante || !menu) return;
    const chiudi = () => { menu.hidden = true; };
    pulsante.addEventListener('click', (e) => {
        e.stopPropagation();
        aggiornaMenuFinestra();
        menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', (e) => {
        if (!menu.hidden && !menu.contains(e.target as Node)) chiudi();
    });
    menu.addEventListener('click', (e) => {
        const voce = (e.target as HTMLElement).closest<HTMLElement>('button');
        if (!voce) return;
        chiudi();
        if (voce.dataset.azione === 'ripristina') return ripristinaLayout();
        const id = voce.dataset.pannello ?? '';
        if (!eIdPannello(id)) return;
        // Uno aperto viene in primo piano; uno chiuso si riapre con la sua logica (le modalità si accendono)
        const apri = apertureDalMenu.get(id);
        if (!pannelloAperto(id) && apri) apri();
        else mostraPannello(id);
    });
}

// Chi apre un pannello dal menu quando serve anche altro (Coerenza e Gerarchia accendono la modalità)
export function aperturaDalMenu(id: IdPannello, funzione: () => void): void {
    apertureDalMenu.set(id, funzione);
}

/* --- AVVIO --- */

export function avviaPannelli(): void {
    const area = document.getElementById('areaPannelli');
    if (!area || api) return;
    PANNELLI.forEach((id) => {
        const el = document.getElementById(NODI[id]);
        if (el) nodi.set(id, el);
    });
    api = createDockview(area, {
        theme: themeLight,
        disableFloatingGroups: true,
        createComponent: ({ name }) => creaContenuto(eIdPannello(name) ? name : 'canvas')
    });
    caricaLayout();

    api.onDidRemovePanel((pannello) => {
        if (chiusuraDaCodice || !eIdPannello(pannello.id)) return;
        allaChiusuraDi.get(pannello.id)?.();
    });
    // Il Canvas non si chiude: la sua ✕ è nascosta dal CSS, e se sparisse lo rimettiamo
    api.onDidRemovePanel((pannello) => {
        if (pannello.id === 'canvas' && !chiusuraDaCodice) setTimeout(() => mostraPannello('canvas'));
    });
    api.onDidLayoutChange(() => {
        clearTimeout(timerSalvataggio);
        timerSalvataggio = setTimeout(scriviLayout, 300);
    });
    initMenuFinestra();
}
