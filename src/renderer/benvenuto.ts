/* --- PAGINA DI BENVENUTO: SCELTA E PREPARAZIONE DELLA CARTELLA DI LAVORO (spec 0019) --- */

import { messaggioDi } from './utils.js';
import type { Desktop } from './tipi.js';

const cartelle = window.desktop?.cartelle;
const elLavoro = document.getElementById('cartellaLavoro')!;
const elLibrerie = document.getElementById('cartellaLibrerie')!;
const elMotivo = document.getElementById('motivo')!;
const elErrore = document.getElementById('errore')!;
const btnUsa = document.getElementById('btnUsa') as HTMLButtonElement;
const btnScegli = document.getElementById('btnScegli') as HTMLButtonElement;

// La proposta mostrata: la cartella di lavoro e le librerie dentro (shared)
let proposta: { lavoro: string; librerie: string | null } = { lavoro: '', librerie: null };

function mostra(): void {
    elLavoro.textContent = proposta.lavoro;
    elLibrerie.textContent = proposta.librerie ?? `${proposta.lavoro.replace(/[\\/]+$/, '')}\\shared`;
}

function errore(testo: string): void {
    elErrore.textContent = testo;
    elErrore.hidden = !testo;
}

function occupato(si: boolean): void {
    btnUsa.disabled = si;
    btnScegli.disabled = si;
}

async function usa(c: Desktop['cartelle']): Promise<void> {
    occupato(true);
    errore('');
    try {
        // Dalla pagina di benvenuto creare le cartelle è la richiesta stessa: niente seconda conferma
        const esito = await c.applica(proposta, true);
        if (esito?.esito === 'errore') errore(esito.messaggio);
        // Con esito ok il programma apre l'editor da solo
    } catch (e) {
        errore(`Impossibile usare la cartella: ${messaggioDi(e)}`);
    } finally {
        occupato(false);
    }
}

async function scegli(c: Desktop['cartelle']): Promise<void> {
    errore('');
    const scelta = await c.scegli('Scegli la cartella di lavoro', proposta.lavoro);
    if (!scelta) return;
    // Cambiando la cartella di lavoro le librerie tornano dentro di lei
    proposta = { lavoro: scelta, librerie: null };
    mostra();
}

async function avvia(): Promise<void> {
    if (!cartelle) {
        errore('Questa pagina funziona solo dentro il programma.');
        occupato(true);
        return;
    }
    const c = cartelle;
    const stato = await c.stato();
    proposta = { lavoro: stato.proposta.lavoro, librerie: stato.proposta.librerie };
    // Librerie nella posizione predefinita: si mostrano come "dentro la cartella di lavoro"
    if (stato.proposta.librerie.replace(/[\\/]+$/, '').toLowerCase() === `${proposta.lavoro.replace(/[\\/]+$/, '')}\\shared`.toLowerCase()) proposta.librerie = null;
    if (stato.motivo) {
        elMotivo.textContent = stato.motivo;
        elMotivo.hidden = false;
    }
    mostra();
    btnUsa.addEventListener('click', () => { void usa(c); });
    btnScegli.addEventListener('click', () => { void scegli(c); });
}

void avvia();
