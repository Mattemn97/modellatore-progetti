/* --- PAGINA DI BENVENUTO: SCELTA E PREPARAZIONE DELLA CARTELLA DI LAVORO (spec 0019) --- */

const cartelle = window.desktop?.cartelle;
const elLavoro = document.getElementById('cartellaLavoro');
const elLibrerie = document.getElementById('cartellaLibrerie');
const elMotivo = document.getElementById('motivo');
const elErrore = document.getElementById('errore');
const btnUsa = document.getElementById('btnUsa');
const btnScegli = document.getElementById('btnScegli');

// La proposta mostrata: la cartella di lavoro e le librerie dentro (shared)
let proposta = { lavoro: '', librerie: null };

function mostra() {
    elLavoro.textContent = proposta.lavoro;
    elLibrerie.textContent = proposta.librerie ?? `${proposta.lavoro.replace(/[\\/]+$/, '')}\\shared`;
}

function errore(testo) {
    elErrore.textContent = testo;
    elErrore.hidden = !testo;
}

function occupato(si) {
    btnUsa.disabled = si;
    btnScegli.disabled = si;
}

async function usa() {
    occupato(true);
    errore('');
    try {
        // Dalla pagina di benvenuto creare le cartelle è la richiesta stessa: niente seconda conferma
        const esito = await cartelle.applica(proposta, true);
        if (esito?.esito === 'errore') errore(esito.messaggio);
        // Con esito ok il programma apre l'editor da solo
    } catch (e) {
        errore(`Impossibile usare la cartella: ${e.message}`);
    } finally {
        occupato(false);
    }
}

async function scegli() {
    errore('');
    const scelta = await cartelle.scegli('Scegli la cartella di lavoro', proposta.lavoro);
    if (!scelta) return;
    // Cambiando la cartella di lavoro le librerie tornano dentro di lei
    proposta = { lavoro: scelta, librerie: null };
    mostra();
}

async function avvia() {
    if (!cartelle) {
        errore('Questa pagina funziona solo dentro il programma.');
        occupato(true);
        return;
    }
    const stato = await cartelle.stato();
    proposta = { lavoro: stato.proposta.lavoro, librerie: stato.proposta.librerie };
    // Librerie nella posizione predefinita: si mostrano come "dentro la cartella di lavoro"
    if (proposta.librerie.replace(/[\\/]+$/, '').toLowerCase() === `${proposta.lavoro.replace(/[\\/]+$/, '')}\\shared`.toLowerCase()) proposta.librerie = null;
    if (stato.motivo) {
        elMotivo.textContent = stato.motivo;
        elMotivo.hidden = false;
    }
    mostra();
    btnUsa.addEventListener('click', usa);
    btnScegli.addEventListener('click', scegli);
}

avvia();
