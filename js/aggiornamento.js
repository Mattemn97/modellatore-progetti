/* --- AGGIORNAMENTO AUTOMATICO: BANNER, INSTALLAZIONE E RIAVVIO (spec 0015) --- */

import { chiamaApi, svuota } from './progetto.js';
import { escapeHtml } from './utils.js';

const CHIAVE_RIMANDATO = 'modellatore.aggiornamentoRimandato';
const INTERVALLO_CONTROLLO_MS = 2000;
const DURATA_CONTROLLO_MS = 30000;
const INTERVALLO_INSTALLAZIONE_MS = 1000;
const ATTESA_RIAVVIO_MS = 60000;
const ETICHETTE_FASE = { download: 'Scaricamento…', verifica: 'Verifica…', installazione: 'Installazione…', riavvio: 'Riavvio…' };
const MSG_RIAVVIO_MUTO = 'Il riavvio non risponde: chiudi la finestra nera e avvia di nuovo start.exe.';

let ultimoStato = null;      // ultima risposta di GET /api/aggiornamento
let noteAperte = false;
let attesaRiavvio = null;    // { nuova, inizio } mentre il server cambia processo
let silenzioso = false;      // messaggio fisso al posto del banner normale

function leggiRimandato() {
    try { return sessionStorage.getItem(CHIAVE_RIMANDATO); } catch { return null; }
}

function scriviRimandato(versione) {
    try { sessionStorage.setItem(CHIAVE_RIMANDATO, versione); } catch { /* solo fino al ricaricamento */ }
}

async function leggiStato() {
    const r = await chiamaApi('GET', '/api/aggiornamento');
    return r.ok ? r.dati : null;
}

function banner() {
    return document.getElementById('bannerAggiornamento');
}

function mostra(html, classe = '') {
    const el = banner();
    if (!el) return;
    el.className = `banner-aggiornamento ${classe}`.trim();
    el.innerHTML = html;
    el.hidden = !html;
}

function disegna() {
    const s = ultimoStato;
    if (silenzioso) return;
    if (!s) return mostra('');
    const fase = ETICHETTE_FASE[s.stato];
    if (fase) {
        return mostra(`<span>Aggiornamento alla versione ${escapeHtml(s.nuova || '')}: <strong>${fase}</strong></span>
            <button disabled>Aggiorna e riavvia</button>`);
    }
    const errore = s.stato === 'errore';
    const disponibile = s.stato === 'disponibile' && s.nuova && leggiRimandato() !== s.nuova;
    if (!disponibile && !errore) return mostra('');
    const testo = errore
        ? `<span><strong>Aggiornamento non riuscito.</strong> ${escapeHtml(s.motivo || '')}</span>`
        : `<span>È disponibile la versione <strong>${escapeHtml(s.nuova)}</strong> (hai la ${escapeHtml(s.attuale)}).</span>`;
    const novita = s.nuova && s.note ? `<button data-aggiornamento="novita" data-aiuto="aggiornamento.novita">${noteAperte ? 'Nascondi novità' : 'Novità'}</button>` : '';
    let azione = '';
    if (s.nuova && s.installabile) {
        azione = `<button data-aggiornamento="installa" data-aiuto="aggiornamento.installa">${errore ? 'Riprova' : 'Aggiorna e riavvia'}</button>`;
    } else if (s.pagina) {
        azione = `<button data-aggiornamento="pagina" data-aiuto="aggiornamento.pagina" data-titolo-nativo="${escapeHtml(s.motivo || '')}">Apri la pagina della versione</button>`;
    }
    const chiudi = `<button data-aggiornamento="rimanda" data-aiuto="aggiornamento.rimanda">${errore ? 'Chiudi' : 'Più tardi'}</button>`;
    const note = noteAperte && s.note ? `<div class="note-aggiornamento"></div>` : '';
    mostra(`<div class="riga-aggiornamento">${testo}${novita}${azione}${chiudi}</div>${note}`, errore ? 'banner-aggiornamento-errore' : '');
    // Le note della Release sono testo, mai HTML
    const box = banner()?.querySelector('.note-aggiornamento');
    if (box) box.textContent = s.note;
}

async function aggiornaStato() {
    ultimoStato = await leggiStato();
    disegna();
    return ultimoStato;
}

async function attendi(ms) {
    return new Promise(risolvi => setTimeout(risolvi, ms));
}

async function seguiInstallazione(nuova) {
    // Rilegge lo stato ogni secondo; durante il riavvio gli errori di rete sono attesi
    for (;;) {
        await attendi(INTERVALLO_INSTALLAZIONE_MS);
        const s = await leggiStato();
        // La versione nuova risponde: si ricarica, anche se lo stato riavvio è durato troppo poco per vederlo
        if (s && s.attuale === nuova) {
            location.reload();
            return;
        }
        // Server muto durante l'installazione: è il cambio di processo
        if (!s && !attesaRiavvio) attesaRiavvio = { nuova, inizio: Date.now() };
        if (attesaRiavvio) {
            if (s && s.stato === 'errore' && s.attuale !== nuova && s.motivo) {
                // Ripristino: la versione vecchia è di nuovo su e dice perché
                attesaRiavvio = null;
                ultimoStato = s;
                disegna();
                return;
            }
            if (Date.now() - attesaRiavvio.inizio > ATTESA_RIAVVIO_MS) {
                silenzioso = true;
                mostra(`<span><strong>${escapeHtml(MSG_RIAVVIO_MUTO)}</strong></span>`, 'banner-aggiornamento-errore');
                return;
            }
            continue;
        }
        if (!s) continue;
        ultimoStato = s;
        disegna();
        if (s.stato === 'riavvio') {
            attesaRiavvio = { nuova, inizio: Date.now() };
        } else if (!ETICHETTE_FASE[s.stato]) {
            return;
        }
    }
}

async function installa() {
    const s = ultimoStato;
    if (!s?.nuova || !s.installabile) return;
    const conferma = confirm(`Aggiornare alla versione ${s.nuova}?\n\n`
        + `Progetti, librerie e impostazioni non vengono toccati.\n`
        + `Le modifiche non salvate di un blocco nell'ispettore vanno perse.\n`
        + `L'app si riavvia da sola: la pagina si ricarica quando la nuova versione è pronta.`);
    if (!conferma) return;
    // Il progetto deve essere salvato: con un conflitto o un errore di salvataggio l'aggiornamento non parte
    if (!(await svuota())) return;
    const r = await chiamaApi('POST', '/api/aggiornamento/installa', { versione: s.nuova });
    if (!r.ok) {
        alert(`Aggiornamento non avviato: ${r.messaggio}`);
        await aggiornaStato();
        return;
    }
    ultimoStato = { ...s, stato: 'download' };
    disegna();
    seguiInstallazione(s.nuova);
}

const AZIONI = {
    novita() { noteAperte = !noteAperte; disegna(); },
    installa,
    pagina() { if (ultimoStato?.pagina) window.open(ultimoStato.pagina, '_blank', 'noopener'); },
    rimanda() {
        if (ultimoStato?.stato === 'errore') ultimoStato = { ...ultimoStato, stato: 'chiuso' };
        else if (ultimoStato?.nuova) scriviRimandato(ultimoStato.nuova);
        disegna();
    }
};

export async function avviaAggiornamenti() {
    banner()?.addEventListener('click', (e) => {
        const pulsante = e.target.closest('[data-aggiornamento]');
        if (pulsante && !pulsante.disabled) AZIONI[pulsante.dataset.aggiornamento]();
    });
    // Il controllo su GitHub gira in un thread del server: si rilegge lo stato finché finisce
    const inizio = Date.now();
    let s = await aggiornaStato();
    while (s?.stato === 'controllo' && Date.now() - inizio < DURATA_CONTROLLO_MS) {
        await attendi(INTERVALLO_CONTROLLO_MS);
        s = await aggiornaStato();
    }
    if (s && ETICHETTE_FASE[s.stato] && s.nuova) seguiInstallazione(s.nuova);
}
