/* --- AIUTO CONTESTUALE: SUGGERIMENTI DELLE (i), MENU AIUTO E PRIMO AVVIO DEL TOUR (spec 0012) --- */
import { SUGGERIMENTI } from './aiuto-testi.js';
import { avviaTour, tourAttivo, tourGiaVisto } from './tour.js';
import { modaleAperta } from './progetto.js';
import { escapeHtml } from './utils.js';

const CHIAVE_ICONE_NASCOSTE = 'modellatore.iconeAiutoNascoste';
const RITARDO_MOUSE = 300;
const DISTANZA = 8;
const BORDO_FINESTRA = 8;
const CONTROLLO_FINESTRE_MS = 500;

let suggerimento = null;
let triggerAttivo = null;
let timerMostra = null;
const chiaviAvvisate = new Set();

function voce(chiave) {
    const v = SUGGERIMENTI[chiave];
    if (!v && !chiaviAvvisate.has(chiave)) {
        chiaviAvvisate.add(chiave);
        console.warn(`Aiuto: nessun testo per la chiave "${chiave}"`);
    }
    return v;
}

// Icona (i) da mettere accanto all'etichetta di un campo nei template
export function iconaAiuto(chiave) {
    const titolo = SUGGERIMENTI[chiave]?.titolo || chiave;
    return `<span class="icona-aiuto" data-aiuto="${escapeHtml(chiave)}" tabindex="0" role="button" aria-label="${escapeHtml(`Informazioni: ${titolo}`)}">i</span>`;
}

/* --- SUGGERIMENTO --- */

// Il title del browser comparirebbe insieme al suggerimento: si sposta in data-titolo-nativo e diventa una riga in più.
// Il codice che aggiorna title (motivi di un pulsante disabilitato) continua a funzionare: al passaggio dopo si sposta di nuovo
function spostaTitle(el) {
    if (!el.hasAttribute('title')) return;
    el.dataset.titoloNativo = el.getAttribute('title');
    el.removeAttribute('title');
}

function posiziona(el) {
    const r = el.getBoundingClientRect();
    const w = suggerimento.offsetWidth;
    const h = suggerimento.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let top = r.top - DISTANZA - h;
    if (top < BORDO_FINESTRA) top = Math.min(r.bottom + DISTANZA, H - h - BORDO_FINESTRA);
    const left = Math.max(BORDO_FINESTRA, Math.min(r.left + r.width / 2 - w / 2, W - w - BORDO_FINESTRA));
    suggerimento.style.left = `${left}px`;
    suggerimento.style.top = `${Math.max(BORDO_FINESTRA, top)}px`;
}

function mostra(el) {
    clearTimeout(timerMostra);
    if (!el.isConnected || tourAttivo()) return;
    const v = voce(el.dataset.aiuto);
    if (!v) return;
    nascondi();
    suggerimento.replaceChildren();
    const titolo = document.createElement('strong');
    titolo.textContent = v.titolo;
    const testo = document.createElement('div');
    testo.textContent = v.testo;
    suggerimento.append(titolo, testo);
    const nativo = el.dataset.titoloNativo;
    if (nativo && nativo !== v.testo) {
        const extra = document.createElement('div');
        extra.className = 'suggerimento-stato';
        extra.textContent = nativo;
        suggerimento.append(extra);
    }
    suggerimento.hidden = false;
    posiziona(el);
    el.setAttribute('aria-describedby', 'suggerimento');
    triggerAttivo = el;
}

function nascondi() {
    clearTimeout(timerMostra);
    if (suggerimento) suggerimento.hidden = true;
    triggerAttivo?.removeAttribute('aria-describedby');
    triggerAttivo = null;
}

function installaSuggerimenti() {
    suggerimento = document.createElement('div');
    suggerimento.id = 'suggerimento';
    suggerimento.className = 'suggerimento';
    suggerimento.setAttribute('role', 'tooltip');
    suggerimento.hidden = true;
    document.body.appendChild(suggerimento);

    // Un solo ascoltatore delegato: vale anche per il contenuto ridisegnato con innerHTML
    document.addEventListener('mouseover', (e) => {
        const el = e.target.closest?.('[data-aiuto]');
        if (!el || el === triggerAttivo) return;
        spostaTitle(el);
        clearTimeout(timerMostra);
        timerMostra = setTimeout(() => mostra(el), RITARDO_MOUSE);
    });
    document.addEventListener('mouseout', (e) => {
        const el = e.target.closest?.('[data-aiuto]');
        if (!el || el.contains(e.relatedTarget)) return;
        if (el === triggerAttivo || !triggerAttivo) nascondi();
    });
    document.addEventListener('focusin', (e) => {
        const el = e.target.closest?.('[data-aiuto]');
        if (!el) return;
        spostaTitle(el);
        mostra(el);
    });
    document.addEventListener('focusout', (e) => {
        if (e.target.closest?.('[data-aiuto]') === triggerAttivo) nascondi();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && triggerAttivo) nascondi();
    });
    // Una (i) dentro un <label> non deve attivare il campo
    document.addEventListener('click', (e) => {
        if (e.target.closest?.('.icona-aiuto')) e.preventDefault();
    });
    document.addEventListener('mousedown', nascondi, true);
    document.addEventListener('scroll', nascondi, true);
    window.addEventListener('resize', nascondi);
}

/* --- ICONE NASCOSTE --- */

function iconeNascoste() {
    try {
        return localStorage.getItem(CHIAVE_ICONE_NASCOSTE) === '1';
    } catch {
        return false;
    }
}

function impostaIcone(nascoste) {
    document.body.classList.toggle('senza-icone-aiuto', nascoste);
    const voceMenu = document.querySelector('#menuAiuto [data-aiuto-azione="icone"]');
    voceMenu?.setAttribute('aria-checked', nascoste ? 'false' : 'true');
    try {
        if (nascoste) localStorage.setItem(CHIAVE_ICONE_NASCOSTE, '1');
        else localStorage.removeItem(CHIAVE_ICONE_NASCOSTE);
    } catch {
        // Senza localStorage la scelta vale fino al ricaricamento
    }
}

/* --- MENU AIUTO E PULSANTI DEI MINI TOUR --- */

function installaMenu() {
    const pulsante = document.getElementById('btnMenuAiuto');
    const menu = document.getElementById('menuAiuto');
    if (!pulsante || !menu) return;
    pulsante.addEventListener('click', () => { menu.hidden = !menu.hidden; });
    // Il menu Progetto ferma la propagazione del suo clic: lo si ascolta direttamente
    document.getElementById('btnMenuProgetto')?.addEventListener('click', () => { menu.hidden = true; });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#btnMenuAiuto')) menu.hidden = true;
    });
    menu.addEventListener('click', (e) => {
        const azione = e.target.closest('[data-aiuto-azione]')?.dataset.aiutoAzione;
        if (!azione) return;
        menu.hidden = true;
        if (azione === 'tour') avviaTour('principale');
        else if (azione === 'icone') impostaIcone(!document.body.classList.contains('senza-icone-aiuto'));
    });

    // Pulsanti ❓ delle finestre e dei Filtri; in cattura perché il pannello Filtri ferma la propagazione dei clic
    document.addEventListener('click', (e) => {
        const avvio = e.target.closest?.('[data-tour-avvia]');
        if (!avvio) return;
        nascondi();
        avviaTour(avvio.dataset.tourAvvia);
    }, true);
}

/* --- AVVIO --- */

export function initAiuto() {
    installaSuggerimenti();
    installaMenu();
    impostaIcone(iconeNascoste());
}

// Dopo l'avvio dei progetti: il tour parte da solo la prima volta, appena nessuna finestra è aperta
export function avviaTourPrimoAvvio() {
    if (tourGiaVisto()) return;
    const prova = () => {
        if (tourGiaVisto() || tourAttivo()) return true;
        if (modaleAperta()) return false;
        avviaTour('principale');
        return true;
    };
    if (prova()) return;
    const timer = setInterval(() => { if (prova()) clearInterval(timer); }, CONTROLLO_FINESTRE_MS);
}
