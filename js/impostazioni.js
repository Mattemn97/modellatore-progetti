/* --- FINESTRA IMPOSTAZIONI: CARTELLA DI LAVORO, CARTELLA DELLE LIBRERIE E settings.json (spec 0019) --- */

import { escapeHtml } from './utils.js';
import { iconaAiuto } from './aiuto.js';
import { svuota } from './progetto.js';

const cartelle = window.desktop?.cartelle;
const modale = document.getElementById('impostazioniModal');
const contenuto = document.getElementById('impostazioniContenuto');

// Valori mostrati nella finestra, applicati solo con Applica
let bozza = { lavoro: '', librerie: null };
let inUso = { lavoro: '', librerie: null };
let fileSettings = null;

const predefinitaLibrerie = (lavoro) => `${lavoro.replace(/[\\/]+$/, '')}\\shared`;
const stessaCartella = (a, b) => a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase();

export function impostazioniAperte() {
    return !!modale && modale.style.display !== 'none';
}

function chiudi() {
    modale.style.display = 'none';
}

function disegna(messaggio = '') {
    const librerie = bozza.librerie ?? predefinitaLibrerie(bozza.lavoro);
    const cambiate = !stessaCartella(bozza.lavoro, inUso.lavoro)
        || !stessaCartella(librerie, inUso.librerie ?? predefinitaLibrerie(inUso.lavoro));
    contenuto.innerHTML = `
        <div class="campo-impostazioni">
            <strong>Cartella di lavoro${iconaAiuto('impostazioni.lavoro')}</strong>
            <div class="percorso-impostazioni" id="impLavoro">${escapeHtml(bozza.lavoro)}</div>
            <div class="pulsanti-impostazioni">
                <button class="pulsante-progetto" data-imp="cambiaLavoro" data-aiuto="impostazioni.cambia">Cambia…</button>
                <button class="pulsante-progetto" data-imp="apriLavoro" data-aiuto="impostazioni.apri">Apri in Esplora risorse</button>
            </div>
        </div>
        <div class="campo-impostazioni">
            <strong>Cartella delle librerie${iconaAiuto('impostazioni.librerie')}</strong>
            <div class="percorso-impostazioni" id="impLibrerie">${escapeHtml(librerie)}${bozza.librerie ? '' : ' <em>(predefinita)</em>'}</div>
            <div class="pulsanti-impostazioni">
                <button class="pulsante-progetto" data-imp="cambiaLibrerie" data-aiuto="impostazioni.cambia">Cambia…</button>
                <button class="pulsante-progetto" data-imp="predefinitaLibrerie" data-aiuto="impostazioni.predefinita" ${bozza.librerie ? '' : 'disabled'}>Usa quella predefinita</button>
                <button class="pulsante-progetto" data-imp="apriLibrerie" data-aiuto="impostazioni.apri">Apri in Esplora risorse</button>
            </div>
        </div>
        <div class="campo-impostazioni">
            <strong>Impostazioni dell'editor${iconaAiuto('impostazioni.settings')}</strong>
            <div class="percorso-impostazioni">${escapeHtml(fileSettings ?? '')}</div>
            <div class="pulsanti-impostazioni">
                <button class="pulsante-progetto" data-imp="apriSettings" data-aiuto="impostazioni.apriSettings">Apri settings.json</button>
            </div>
            <div class="nota-impostazioni">Griglia, colori, tipologie, metodi di verifica e documenti: si modificano nel file e valgono dal prossimo avvio.</div>
        </div>
        ${messaggio ? `<div class="elenco-avviso" id="impMessaggio">${escapeHtml(messaggio)}</div>` : ''}
        <div class="pulsanti-impostazioni piede-impostazioni">
            <button class="pulsante-progetto pulsante-menu" data-imp="applica" data-aiuto="impostazioni.applica" ${cambiate ? '' : 'disabled'}>Applica</button>
            <button class="pulsante-progetto" data-imp="chiudi">Chiudi</button>
        </div>`;
}

async function apri() {
    const stato = await cartelle.stato();
    if (!stato?.cartelle) return;
    const lib = stessaCartella(stato.cartelle.librerie, predefinitaLibrerie(stato.cartelle.lavoro)) ? null : stato.cartelle.librerie;
    inUso = { lavoro: stato.cartelle.lavoro, librerie: lib };
    bozza = { ...inUso };
    fileSettings = stato.settings;
    disegna();
    modale.style.display = 'flex';
}

async function apriPercorso(percorso) {
    const errore = await cartelle.apri(percorso);
    if (errore) alert(`Impossibile aprire "${percorso}": ${errore}`);
}

async function applica() {
    // Prima si salva il progetto aperto: poi la pagina si ricarica sulle cartelle nuove
    if (!await svuota()) {
        disegna('Il progetto non è salvato (errore o conflitto): risolvi prima il problema nel banner.');
        return;
    }
    let esito = await cartelle.applica(bozza, false);
    if (esito?.esito === 'da-creare') {
        const elenco = esito.cartelle.map(c => `• ${c}`).join('\n');
        if (!confirm(`Queste cartelle non esistono o sono vuote:\n${elenco}\n\nCrearle e prepararle (progetti, librerie di esempio e settings.json)?`)) return;
        esito = await cartelle.applica(bozza, true);
    }
    if (esito?.esito === 'errore') disegna(esito.messaggio);
    // Con esito ok il programma ricarica l'editor sulle cartelle nuove
}

async function azione(nome) {
    const librerie = bozza.librerie ?? predefinitaLibrerie(bozza.lavoro);
    if (nome === 'chiudi') return chiudi();
    if (nome === 'apriLavoro') return apriPercorso(bozza.lavoro);
    if (nome === 'apriLibrerie') return apriPercorso(librerie);
    if (nome === 'apriSettings') return apriPercorso(fileSettings);
    if (nome === 'predefinitaLibrerie') { bozza.librerie = null; return disegna(); }
    if (nome === 'applica') return applica();
    if (nome === 'cambiaLavoro') {
        const scelta = await cartelle.scegli('Scegli la cartella di lavoro', bozza.lavoro);
        if (scelta) bozza.lavoro = scelta;
        return disegna();
    }
    if (nome === 'cambiaLibrerie') {
        const scelta = await cartelle.scegli('Scegli la cartella delle librerie', librerie);
        if (scelta) bozza.librerie = stessaCartella(scelta, predefinitaLibrerie(bozza.lavoro)) ? null : scelta;
        return disegna();
    }
}

export function initImpostazioni() {
    const pulsante = document.getElementById('btnImpostazioni');
    // Nel browser (1.x) non ci sono cartelle da scegliere
    if (!cartelle || !modale) {
        if (pulsante) pulsante.hidden = true;
        return;
    }
    pulsante?.addEventListener('click', apri);
    document.getElementById('btnChiudiImpostazioni')?.addEventListener('click', chiudi);
    contenuto.addEventListener('click', (e) => {
        const bottone = e.target.closest('[data-imp]');
        if (bottone && !bottone.disabled) azione(bottone.dataset.imp);
    });
}
