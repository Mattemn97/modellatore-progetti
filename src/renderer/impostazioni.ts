/* --- FINESTRA IMPOSTAZIONI: CARTELLA DI LAVORO, CARTELLA DELLE LIBRERIE E settings.json (spec 0019) --- */

import { escapeHtml } from './utils.js';
import { iconaAiuto } from './aiuto.js';
import { svuota } from './progetto.js';
import type { Desktop } from './tipi.js';

type Cartelle = Desktop['cartelle'];
interface Scelta {
    lavoro: string;
    librerie: string | null;
}

const cartelle = window.desktop?.cartelle;
const modale = document.getElementById('impostazioniModal');
const contenuto = document.getElementById('impostazioniContenuto');

// Valori mostrati nella finestra, applicati solo con Applica
let bozza: Scelta = { lavoro: '', librerie: null };
let inUso: Scelta = { lavoro: '', librerie: null };
let fileSettings: string | null = null;

const predefinitaLibrerie = (lavoro: string): string => `${lavoro.replace(/[\\/]+$/, '')}\\shared`;
const stessaCartella = (a: string, b: string): boolean => a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase();

export function impostazioniAperte(): boolean {
    return !!modale && modale.style.display !== 'none';
}

function chiudi(): void {
    if (modale) modale.style.display = 'none';
}

function disegna(messaggio = ''): void {
    if (!contenuto) return;
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
        <div class="campo-impostazioni">
            <strong>Dati della versione 1${iconaAiuto('impostazioni.importaV1')}</strong>
            <div class="pulsanti-impostazioni">
                <button class="pulsante-progetto" data-imp="importaV1" data-aiuto="impostazioni.importaV1Pulsante">Importa dalla versione 1…</button>
            </div>
            <div class="nota-impostazioni">Copia progetti, librerie, changelog, versioni, cestino e settings.json di una vecchia installazione nelle cartelle qui sopra. La cartella vecchia non viene toccata.</div>
        </div>
        ${messaggio ? `<div class="elenco-avviso" id="impMessaggio">${escapeHtml(messaggio)}</div>` : ''}
        <div class="pulsanti-impostazioni piede-impostazioni">
            <button class="pulsante-progetto pulsante-menu" data-imp="applica" data-aiuto="impostazioni.applica" ${cambiate ? '' : 'disabled'}>Applica</button>
            <button class="pulsante-progetto" data-imp="chiudi">Chiudi</button>
        </div>`;
}

async function apri(c: Cartelle): Promise<void> {
    const stato = await c.stato();
    if (!stato?.cartelle) return;
    const lib = stessaCartella(stato.cartelle.librerie, predefinitaLibrerie(stato.cartelle.lavoro)) ? null : stato.cartelle.librerie;
    inUso = { lavoro: stato.cartelle.lavoro, librerie: lib };
    bozza = { ...inUso };
    fileSettings = stato.settings;
    disegna();
    if (modale) modale.style.display = 'flex';
}

async function apriPercorso(c: Cartelle, percorso: string): Promise<void> {
    const errore = await c.apri(percorso);
    if (errore) alert(`Impossibile aprire "${percorso}": ${errore}`);
}

async function applica(c: Cartelle): Promise<void> {
    // Prima si salva il progetto aperto: poi la pagina si ricarica sulle cartelle nuove
    if (!await svuota()) {
        disegna('Il progetto non è salvato (errore o conflitto): risolvi prima il problema nel banner.');
        return;
    }
    let esito = await c.applica(bozza, false);
    if (esito?.esito === 'da-creare') {
        const elenco = esito.cartelle.map((cartella) => `• ${cartella}`).join('\n');
        if (!confirm(`Queste cartelle non esistono o sono vuote:\n${elenco}\n\nCrearle e prepararle (progetti, librerie di esempio e settings.json)?`)) return;
        esito = await c.applica(bozza, true);
    }
    if (esito?.esito === 'errore') disegna(esito.messaggio);
    // Con esito ok il programma ricarica l'editor sulle cartelle nuove
}

// Import dalla 1.x: anteprima, conferma, scelta sui file diversi, poi copia e ricarica (voce 22)
async function importaV1(c: Cartelle): Promise<void> {
    const scelta = await c.scegli('Scegli la cartella della versione 1 (quella con start.exe)', '');
    if (!scelta) return;
    const analisi = await c.analizzaV1(scelta);
    if ('errore' in analisi) return disegna(analisi.errore);
    const totale = analisi.nuovi + analisi.diversi.length;
    if (totale === 0) return disegna(`Niente da importare: i ${analisi.uguali} file della versione 1 sono già tutti qui, uguali.`);
    const righe = [`Dalla cartella:\n${scelta}`, '', `${analisi.nuovi} file nuovi da copiare.`];
    if (analisi.uguali) righe.push(`${analisi.uguali} file già presenti e uguali (saltati).`);
    if (analisi.diversi.length) righe.push(`${analisi.diversi.length} file già presenti ma diversi: dopo ti chiedo cosa farne.`);
    if (!confirm(`${righe.join('\n')}\n\nContinuare?`)) return;
    let sovrascrivi = false;
    if (analisi.diversi.length) {
        const mostrati = analisi.diversi.slice(0, 15).map((f) => `• ${f}`).join('\n');
        const altri = analisi.diversi.length > 15 ? `\n… e altri ${analisi.diversi.length - 15}` : '';
        sovrascrivi = confirm(`Questi file esistono già con un contenuto diverso:\n${mostrati}${altri}\n\nOK: sostituiscili con quelli della versione 1.\nAnnulla: lasciali come sono e copia solo i file nuovi.`);
    }
    // Prima si salva il progetto aperto: dopo la copia l'editor si ricarica
    if (!await svuota()) return disegna('Il progetto non è salvato (errore o conflitto): risolvi prima il problema nel banner.');
    const esito = await c.importaV1(scelta, sovrascrivi);
    if ('errore' in esito) return disegna(esito.errore);
    alert(`Import completato: ${esito.copiati} file copiati, ${esito.saltati} lasciati come erano.`);
}

async function azione(c: Cartelle, nome: string): Promise<void> {
    const librerie = bozza.librerie ?? predefinitaLibrerie(bozza.lavoro);
    if (nome === 'chiudi') return chiudi();
    if (nome === 'apriLavoro') return apriPercorso(c, bozza.lavoro);
    if (nome === 'apriLibrerie') return apriPercorso(c, librerie);
    if (nome === 'apriSettings') return apriPercorso(c, fileSettings ?? '');
    if (nome === 'predefinitaLibrerie') { bozza.librerie = null; return disegna(); }
    if (nome === 'applica') return applica(c);
    if (nome === 'importaV1') return importaV1(c);
    if (nome === 'cambiaLavoro') {
        const scelta = await c.scegli('Scegli la cartella di lavoro', bozza.lavoro);
        if (scelta) bozza.lavoro = scelta;
        return disegna();
    }
    if (nome === 'cambiaLibrerie') {
        const scelta = await c.scegli('Scegli la cartella delle librerie', librerie);
        if (scelta) bozza.librerie = stessaCartella(scelta, predefinitaLibrerie(bozza.lavoro)) ? null : scelta;
        return disegna();
    }
}

export function initImpostazioni(): void {
    const pulsante = document.getElementById('btnImpostazioni');
    // Nel browser (1.x) non ci sono cartelle da scegliere
    if (!cartelle || !modale || !contenuto) {
        if (pulsante) pulsante.hidden = true;
        return;
    }
    const c = cartelle;
    pulsante?.addEventListener('click', () => { void apri(c); });
    document.getElementById('btnChiudiImpostazioni')?.addEventListener('click', chiudi);
    contenuto.addEventListener('click', (e) => {
        const bottone = (e.target as Element).closest<HTMLButtonElement>('[data-imp]');
        if (bottone && !bottone.disabled) void azione(c, bottone.dataset.imp ?? '');
    });
}
