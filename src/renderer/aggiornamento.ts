/* --- AGGIORNAMENTO AUTOMATICO: BANNER, INSTALLAZIONE E RIAVVIO (spec 0015, versione desktop spec 0025) --- */

import { svuota } from './progetto.js';
import { chiamaApi } from './api.js';
import { escapeHtml } from './utils.js';

type FaseInstallazione = 'download' | 'verifica' | 'installazione' | 'riavvio';

// Risposta di GET /api/aggiornamento
interface StatoAggiornamento {
    stato: string;
    attuale?: string;
    nuova?: string | null;
    note?: string | null;
    installabile?: boolean;
    pagina?: string | null;
    motivo?: string | null;
}

const CHIAVE_RIMANDATO = 'modellatore.aggiornamentoRimandato';
const INTERVALLO_CONTROLLO_MS = 2000;
const DURATA_CONTROLLO_MS = 30000;
const INTERVALLO_INSTALLAZIONE_MS = 1000;
const ATTESA_RIAVVIO_MS = 60000;
const ETICHETTE_FASE: Record<FaseInstallazione, string> = { download: 'Scaricamento…', verifica: 'Verifica…', installazione: 'Installazione…', riavvio: 'Riavvio…' };
const MSG_RIAVVIO_MUTO = 'Il riavvio non risponde: chiudi il programma e riaprilo dal menu Start.';

let ultimoStato: StatoAggiornamento | null = null;      // ultima risposta di GET /api/aggiornamento
let noteAperte = false;
let attesaRiavvio: { nuova: string; inizio: number } | null = null;    // mentre il server cambia processo
let silenzioso = false;      // messaggio fisso al posto del banner normale

function etichettaFase(stato: string): string | undefined {
    return ETICHETTE_FASE[stato as FaseInstallazione];
}

function leggiRimandato(): string | null {
    try { return sessionStorage.getItem(CHIAVE_RIMANDATO); } catch { return null; }
}

function scriviRimandato(versione: string): void {
    try { sessionStorage.setItem(CHIAVE_RIMANDATO, versione); } catch { /* solo fino al ricaricamento */ }
}

async function leggiStato(): Promise<StatoAggiornamento | null> {
    const r = await chiamaApi<StatoAggiornamento>('GET', '/api/aggiornamento');
    return r.ok ? r.dati : null;
}

function banner(): HTMLElement | null {
    return document.getElementById('bannerAggiornamento');
}

function mostra(html: string, classe = ''): void {
    const el = banner();
    if (!el) return;
    el.className = `banner-aggiornamento ${classe}`.trim();
    el.innerHTML = html;
    el.hidden = !html;
}

function disegna(): void {
    const s = ultimoStato;
    if (silenzioso) return;
    if (!s) return mostra('');
    const fase = etichettaFase(s.stato);
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
    const note = noteAperte && s.note ? '<div class="note-aggiornamento"></div>' : '';
    mostra(`<div class="riga-aggiornamento">${testo}${novita}${azione}${chiudi}</div>${note}`, errore ? 'banner-aggiornamento-errore' : '');
    // Le note della Release sono testo, mai HTML
    const box = banner()?.querySelector('.note-aggiornamento');
    if (box) box.textContent = s.note ?? '';
}

async function aggiornaStato(): Promise<StatoAggiornamento | null> {
    ultimoStato = await leggiStato();
    disegna();
    return ultimoStato;
}

async function attendi(ms: number): Promise<void> {
    return new Promise((risolvi) => setTimeout(risolvi, ms));
}

async function seguiInstallazione(nuova: string): Promise<void> {
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
        } else if (!etichettaFase(s.stato)) {
            return;
        }
    }
}

async function installa(): Promise<void> {
    const s = ultimoStato;
    if (!s?.nuova || !s.installabile) return;
    const nuova = s.nuova;
    const conferma = confirm(`Aggiornare alla versione ${nuova}?\n\n`
        + 'Progetti, librerie e impostazioni non vengono toccati.\n'
        + 'Le modifiche non salvate di un blocco nell\'ispettore vanno perse.\n'
        + 'L\'app si riavvia da sola: la pagina si ricarica quando la nuova versione è pronta.');
    if (!conferma) return;
    // Il progetto deve essere salvato: con un conflitto o un errore di salvataggio l'aggiornamento non parte
    if (!(await svuota())) return;
    const r = await chiamaApi('POST', '/api/aggiornamento/installa', { versione: nuova });
    if (!r.ok) {
        alert(`Aggiornamento non avviato: ${r.messaggio}`);
        await aggiornaStato();
        return;
    }
    ultimoStato = { ...s, stato: 'download' };
    disegna();
    void seguiInstallazione(nuova);
}

const AZIONI: Record<string, () => void | Promise<void>> = {
    novita() { noteAperte = !noteAperte; disegna(); },
    installa,
    pagina() { if (ultimoStato?.pagina) window.open(ultimoStato.pagina, '_blank', 'noopener'); },
    rimanda() {
        if (ultimoStato?.stato === 'errore') ultimoStato = { ...ultimoStato, stato: 'chiuso' };
        else if (ultimoStato?.nuova) scriviRimandato(ultimoStato.nuova);
        disegna();
    }
};

export async function avviaAggiornamenti(): Promise<void> {
    banner()?.addEventListener('click', (e) => {
        const pulsante = (e.target as Element).closest<HTMLButtonElement>('[data-aggiornamento]');
        if (pulsante && !pulsante.disabled) void AZIONI[pulsante.dataset.aggiornamento ?? '']?.();
    });
    // Il controllo su GitHub gira in un thread del server: si rilegge lo stato finché finisce
    const inizio = Date.now();
    let s = await aggiornaStato();
    while (s?.stato === 'controllo' && Date.now() - inizio < DURATA_CONTROLLO_MS) {
        await attendi(INTERVALLO_CONTROLLO_MS);
        s = await aggiornaStato();
    }
    if (s && etichettaFase(s.stato) && s.nuova) void seguiInstallazione(s.nuova);
}
