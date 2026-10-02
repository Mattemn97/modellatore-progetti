/* --- FILTRI DEL CANVAS: CLASSE, DOCUMENTO, CATEGORIA, SOTTOCATEGORIA, ATTENUA O NASCONDI --- */

// Spec 0008. Stato di sola vista: vive in questo modulo, mai in appState, quindi non entra nel file del progetto.
// Dentro un gruppo basta una voce scelta, tra gruppi servono tutte; un gruppo senza voci scelte non filtra.

import { appState, appSettings } from './state.js';
import { render } from './renderer.js';
import { CAPACITA, getTipologie, getClasseRequisito, isRequisitoCliente } from './model.js';
import { escapeHtml } from './utils.js';
import { iconaAiuto } from './aiuto.js';

const DOC_CLIENTE = 'Cliente';
const GRUPPI = [
    { id: 'classi', titolo: 'Classe' },
    { id: 'documenti', titolo: 'Documento' },
    { id: 'categorie', titolo: 'Categoria', vuota: '(senza categoria)' },
    { id: 'sottocategorie', titolo: 'Sottocategoria', vuota: '(senza sottocategoria)' }
];

const stato = { classi: new Set(), documenti: new Set(), categorie: new Set(), sottocategorie: new Set(), modo: 'attenua' };
let ultimoRiepilogo = { blocchi: 0, fili: 0 };

const pulito = valore => String(valore ?? '').trim();

/* --- REGOLE (AC-3, AC-4) --- */

function documentiDi(req) {
    if (isRequisitoCliente(req)) return [DOC_CLIENTE];
    return (req.testiExport || []).map(t => pulito(t.documento)).filter(Boolean);
}

export function filtriAttivi() {
    return GRUPPI.filter(g => stato[g.id].size > 0).length;
}

export function modoNascondi() {
    return stato.modo === 'nascondi';
}

// Filtri di requisito: Classe e Documento
export function requisitoIncluso(req) {
    if (!req) return false;
    if (stato.classi.size && !stato.classi.has(getClasseRequisito(req))) return false;
    if (stato.documenti.size && !documentiDi(req).some(d => stato.documenti.has(d))) return false;
    return true;
}

// Filtri di blocco: Categoria e Sottocategoria ('' = senza)
export function bloccoPassa(def) {
    if (!def) return false;
    if (stato.categorie.size && !stato.categorie.has(pulito(def.categoria))) return false;
    if (stato.sottocategorie.size && !stato.sottocategorie.has(pulito(def.sottocategoria))) return false;
    return true;
}

// Incluso: passa i filtri di blocco e, con filtri di requisito attivi, ha almeno un requisito che li passa
export function bloccoIncluso(def) {
    if (!bloccoPassa(def)) return false;
    if (!stato.classi.size && !stato.documenti.size) return true;
    return (def.requisiti || []).some(requisitoIncluso);
}

// Coerenza: solo il gruppo Classe; un problema senza classe passa sempre (AC-7)
export function classePassa(classe) {
    return classe === null || classe === undefined || !stato.classi.size || stato.classi.has(classe);
}

export function descriviClassi() {
    return vociDi('classi').filter(v => stato.classi.has(v)).join(', ');
}

/* --- VOCI (AC-2) --- */

function ordinaAlfabetico(valori) {
    return [...valori].sort((a, b) => a.localeCompare(b, 'it'));
}

function vociDi(gruppo) {
    const blocchi = Object.values(appState.library || {});
    if (gruppo === 'classi') return [CAPACITA, ...getTipologie()];
    if (gruppo === 'documenti') {
        const daSettings = (appSettings.documenti || []).map(pulito).filter(Boolean);
        const noti = new Set([...daSettings, DOC_CLIENTE]);
        const extra = new Set();
        blocchi.forEach(def => (def.requisiti || []).forEach(req => (req.testiExport || []).forEach(t => {
            const d = pulito(t.documento);
            if (d && !noti.has(d)) extra.add(d);
        })));
        return [...new Set(daSettings), ...ordinaAlfabetico(extra), DOC_CLIENTE];
    }
    const campo = gruppo === 'categorie' ? 'categoria' : 'sottocategoria';
    const valori = new Set(blocchi.map(def => pulito(def[campo])));
    const conVuota = valori.delete('');
    return [...ordinaAlfabetico(valori), ...(conVuota ? [''] : [])];
}

/* --- PANNELLO (AC-1, AC-2, AC-8) --- */

const pannello = document.getElementById('pannelloFiltri');
const pulsante = document.getElementById('btnFiltri');

function aggiornaPulsante() {
    if (!pulsante) return;
    const n = filtriAttivi();
    pulsante.textContent = n ? `🔎 Filtri (${n})` : '🔎 Filtri';
    pulsante.setAttribute('aria-pressed', n ? 'true' : 'false');
}

function testoRiepilogo() {
    if (!filtriAttivi()) return 'Nessun filtro attivo';
    return `In questo livello: ${ultimoRiepilogo.blocchi} blocchi e ${ultimoRiepilogo.fili} fili esclusi`;
}

function disegnaPannello() {
    if (!pannello) return;
    const colonne = GRUPPI.map(g => {
        const voci = vociDi(g.id).map(v => `
            <label class="voce-filtro">
                <input type="checkbox" data-gruppo="${g.id}" value="${escapeHtml(v)}"${stato[g.id].has(v) ? ' checked' : ''}>
                <span>${escapeHtml(v === '' ? g.vuota : v)}</span>
            </label>`).join('');
        return `<fieldset class="gruppo-filtro"><legend>${g.titolo}${iconaAiuto(`filtri.${g.id}`)}</legend><div class="lista-filtro">${voci || '<span class="empty-props">Nessuna voce</span>'}</div></fieldset>`;
    }).join('');
    pannello.innerHTML = `
        <div class="griglia-filtri">${colonne}</div>
        <div class="piede-filtri">
            <span>Elementi esclusi${iconaAiuto('filtri.modo')}:</span>
            <label><input type="radio" name="modoFiltri" value="attenua"${stato.modo === 'attenua' ? ' checked' : ''}> Attenua</label>
            <label><input type="radio" name="modoFiltri" value="nascondi"${stato.modo === 'nascondi' ? ' checked' : ''}> Nascondi</label>
            <button type="button" id="btnAzzeraFiltri" class="pulsante-progetto" data-aiuto="filtri.azzera">Azzera filtri</button>
            <button type="button" class="pulsante-tour-finestra" data-tour-avvia="filtri" data-aiuto="finestra.tour" aria-label="Guida dei filtri">❓ Guida</button>
            <span id="riepilogoFiltri" class="riepilogo-filtri"></span>
        </div>`;
    document.getElementById('riepilogoFiltri').textContent = testoRiepilogo();
}

function pannelloAperto() {
    return !!pannello && !pannello.hidden;
}

function apriPannello() {
    riallineaFiltri();
    disegnaPannello();
    pannello.hidden = false;
}

function chiudiPannello() {
    if (pannello) pannello.hidden = true;
}

// Chiamata da render() con i conteggi del livello appena disegnato, senza Gerarchia
export function aggiornaRiepilogoFiltri(blocchi, fili) {
    ultimoRiepilogo = { blocchi, fili };
    aggiornaPulsante();
    if (!pannelloAperto()) return;
    const riga = document.getElementById('riepilogoFiltri');
    if (riga) riga.textContent = testoRiepilogo();
}

// Voci ricalcolate quando la libreria cambia: una scelta sparita si toglie (AC-9). Mai dentro render()
export function riallineaFiltri() {
    if (!appSettings) return;
    let cambiato = false;
    GRUPPI.forEach(g => {
        const voci = new Set(vociDi(g.id));
        [...stato[g.id]].forEach(v => {
            if (!voci.has(v)) {
                stato[g.id].delete(v);
                cambiato = true;
            }
        });
    });
    if (pannelloAperto()) disegnaPannello();
    aggiornaPulsante();
    if (cambiato) render();
}

/* --- INIZIALIZZAZIONE --- */

export function initFiltri() {
    if (!pannello || !pulsante) return;
    aggiornaPulsante();
    pulsante.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pannelloAperto()) chiudiPannello();
        else apriPannello();
    });
    pannello.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!e.target.closest('#btnAzzeraFiltri')) return;
        GRUPPI.forEach(g => stato[g.id].clear());
        disegnaPannello();
        aggiornaPulsante();
        render();
    });
    pannello.addEventListener('change', (e) => {
        const casella = e.target;
        if (casella.name === 'modoFiltri') {
            stato.modo = casella.value === 'nascondi' ? 'nascondi' : 'attenua';
        } else if (casella.dataset.gruppo) {
            const insieme = stato[casella.dataset.gruppo];
            if (casella.checked) insieme.add(casella.value);
            else insieme.delete(casella.value);
        } else {
            return;
        }
        aggiornaPulsante();
        render();
    });
    // Un clic fuori dal pannello e dal pulsante lo chiude
    document.addEventListener('mousedown', (e) => {
        if (!pannelloAperto()) return;
        if (pannello.contains(e.target) || pulsante.contains(e.target)) return;
        chiudiPannello();
    });
}
