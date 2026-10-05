/* --- TOUR GUIDATO: RIFLETTORE, FUMETTO, TASTIERA E RIPRISTINO DELLA VISTA (spec 0012) --- */
import { TOUR } from './aiuto-testi.js';
import { mostraScheda } from './cliente.js';

const CHIAVE_TOUR_VISTO = 'modellatore.tourVisto';
const MARGINE_RIFLETTORE = 6;
const DISTANZA_FUMETTO = 12;
const BORDO_FINESTRA = 8;
// Durata della transizione dei pannelli laterali (style.css), più un poco
const ATTESA_PANNELLI = 350;

// Stato di sola vista: { nome, passi, indice, ripristino } oppure null
let tour = null;
let elementi = null;
let timerRiposiziona = null;

export function tourAttivo() {
    return tour !== null;
}

/* --- ELEMENTI DEL TOUR --- */

function creaElementi() {
    if (elementi) return elementi;
    const overlay = document.createElement('div');
    overlay.id = 'tourOverlay';
    overlay.className = 'tour-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
        <div id="tourRiflettore" class="tour-riflettore"></div>
        <div id="tourFumetto" class="tour-fumetto" role="dialog" aria-modal="true" aria-labelledby="tourTitolo">
            <button type="button" class="tour-chiudi" data-tour="chiudi" aria-label="Chiudi il tour">✕</button>
            <div class="tour-conteggio"></div>
            <h4 id="tourTitolo" class="tour-titolo"></h4>
            <p class="tour-testo"></p>
            <div class="tour-pulsanti">
                <button type="button" class="tour-salta" data-tour="salta">Salta il tour</button>
                <button type="button" class="pulsante-progetto" data-tour="indietro">Indietro</button>
                <button type="button" class="pulsante-progetto pulsante-menu" data-tour="avanti">Avanti</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    // Nessun clic o pressione arriva all'app sotto (chiuderebbe i Filtri, deselezionerebbe, ecc.)
    ['mousedown', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(tipo =>
        overlay.addEventListener(tipo, (e) => {
            e.stopPropagation();
            if (tipo !== 'click' && !e.target.closest('button')) e.preventDefault();
        }));
    overlay.addEventListener('click', (e) => {
        const azione = e.target.closest('[data-tour]')?.dataset.tour;
        if (azione === 'avanti') avanti();
        else if (azione === 'indietro') indietro();
        else if (azione === 'salta' || azione === 'chiudi') chiudiTour();
    });

    elementi = {
        overlay,
        riflettore: overlay.querySelector('#tourRiflettore'),
        fumetto: overlay.querySelector('#tourFumetto'),
        conteggio: overlay.querySelector('.tour-conteggio'),
        titolo: overlay.querySelector('.tour-titolo'),
        testo: overlay.querySelector('.tour-testo'),
        indietro: overlay.querySelector('[data-tour="indietro"]'),
        avanti: overlay.querySelector('[data-tour="avanti"]')
    };
    return elementi;
}

/* --- AREE E PREPARAZIONE --- */

// Un'area c'è se esiste e ha una dimensione sullo schermo
function trovaArea(selettore) {
    if (!selettore) return null;
    const el = document.querySelector(selettore);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? el : null;
}

function schedaAttiva() {
    return document.querySelector('.scheda-pannello.attiva')?.dataset.scheda || 'libreria';
}

function statoVista() {
    return {
        sinistro: document.getElementById('libraryPanel')?.classList.contains('collapsed') ?? false,
        destro: document.getElementById('propertiesPanel')?.classList.contains('collapsed') ?? false,
        scheda: schedaAttiva()
    };
}

// Restituisce true se ha cambiato qualcosa (i pannelli hanno una transizione)
function prepara(nome) {
    if (!nome) return false;
    const apri = (id) => {
        const pannello = document.getElementById(id);
        if (!pannello?.classList.contains('collapsed')) return false;
        pannello.classList.remove('collapsed');
        return true;
    };
    if (nome === 'pannelloSinistro') return apri('libraryPanel');
    if (nome === 'pannelloDestro') return apri('propertiesPanel');
    if (nome.startsWith('scheda:')) {
        const aperto = apri('libraryPanel');
        const scheda = nome.slice('scheda:'.length);
        if (schedaAttiva() !== scheda) mostraScheda(scheda);
        return aperto;
    }
    console.warn(`Tour: preparazione sconosciuta "${nome}"`);
    return false;
}

function ripristina(stato) {
    if (!stato) return;
    document.getElementById('libraryPanel')?.classList.toggle('collapsed', stato.sinistro);
    document.getElementById('propertiesPanel')?.classList.toggle('collapsed', stato.destro);
    if (schedaAttiva() !== stato.scheda) mostraScheda(stato.scheda);
}

/* --- POSIZIONE DI RIFLETTORE E FUMETTO --- */

const limita = (v, min, max) => Math.max(min, Math.min(v, max));

function posiziona() {
    if (!tour) return;
    const { overlay, riflettore, fumetto } = elementi;
    const passo = tour.passi[tour.indice];
    const area = trovaArea(passo.area);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = fumetto.offsetWidth;
    const h = fumetto.offsetHeight;

    overlay.classList.toggle('tour-senza-area', !area);
    if (!area) {
        riflettore.hidden = true;
        fumetto.style.left = `${Math.max(BORDO_FINESTRA, (W - w) / 2)}px`;
        fumetto.style.top = `${Math.max(BORDO_FINESTRA, (H - h) / 2)}px`;
        return;
    }

    // Rettangolo dell'area ritagliato sulla finestra, più il margine
    const r = area.getBoundingClientRect();
    const sx = Math.max(0, r.left - MARGINE_RIFLETTORE);
    const sy = Math.max(0, r.top - MARGINE_RIFLETTORE);
    const ex = Math.min(W, r.right + MARGINE_RIFLETTORE);
    const ey = Math.min(H, r.bottom + MARGINE_RIFLETTORE);
    riflettore.hidden = false;
    Object.assign(riflettore.style, { left: `${sx}px`, top: `${sy}px`, width: `${ex - sx}px`, height: `${ey - sy}px` });

    // Destra, sinistra, sotto, sopra: il primo lato in cui il fumetto entra tutto, altrimenti quello con più spazio
    const centroX = (sx + ex) / 2 - w / 2;
    const centroY = (sy + ey) / 2 - h / 2;
    const lati = [
        { spazio: W - ex, serve: w, x: ex + DISTANZA_FUMETTO, y: centroY },
        { spazio: sx, serve: w, x: sx - DISTANZA_FUMETTO - w, y: centroY },
        { spazio: H - ey, serve: h, x: centroX, y: ey + DISTANZA_FUMETTO },
        { spazio: sy, serve: h, x: centroX, y: sy - DISTANZA_FUMETTO - h }
    ];
    const scelto = lati.find(l => l.spazio >= l.serve + DISTANZA_FUMETTO + BORDO_FINESTRA)
        || lati.reduce((a, b) => (b.spazio - b.serve > a.spazio - a.serve ? b : a));
    fumetto.style.left = `${limita(scelto.x, BORDO_FINESTRA, Math.max(BORDO_FINESTRA, W - w - BORDO_FINESTRA))}px`;
    fumetto.style.top = `${limita(scelto.y, BORDO_FINESTRA, Math.max(BORDO_FINESTRA, H - h - BORDO_FINESTRA))}px`;
}

function mostraPasso() {
    const passo = tour.passi[tour.indice];
    const cambiato = prepara(passo.prepara);
    const { conteggio, titolo, testo, indietro, avanti } = elementi;
    conteggio.textContent = `Passo ${tour.indice + 1} di ${tour.passi.length}`;
    titolo.textContent = passo.titolo;
    testo.textContent = passo.testo;
    indietro.disabled = tour.indice === 0;
    avanti.textContent = tour.indice === tour.passi.length - 1 ? 'Fine' : 'Avanti';

    trovaArea(passo.area)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    posiziona();
    clearTimeout(timerRiposiziona);
    // I pannelli si aprono con una transizione: si rimisura quando è finita
    if (cambiato) timerRiposiziona = setTimeout(posiziona, ATTESA_PANNELLI);
    avanti.focus({ preventScroll: true });
}

/* --- NAVIGAZIONE --- */

function avanti() {
    if (!tour) return;
    if (tour.indice >= tour.passi.length - 1) {
        chiudiTour();
        return;
    }
    tour.indice++;
    mostraPasso();
}

function indietro() {
    if (!tour || tour.indice === 0) return;
    tour.indice--;
    mostraPasso();
}

// Fase di cattura su window: i tasti del tour non arrivano agli altri gestori (Esc della Gerarchia, Ctrl+Z, Shift)
function suTasto(e) {
    if (!tour) return;
    e.stopPropagation();
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        avanti();
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        indietro();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        chiudiTour();
    } else if (e.key === 'Tab') {
        // Il fuoco gira tra i pulsanti del fumetto
        const pulsanti = [...elementi.fumetto.querySelectorAll('button:not(:disabled)')];
        const i = pulsanti.indexOf(document.activeElement);
        const prossimo = e.shiftKey ? (i <= 0 ? pulsanti.length - 1 : i - 1) : (i + 1) % pulsanti.length;
        e.preventDefault();
        pulsanti[prossimo]?.focus();
    } else if (e.key !== ' ') {
        e.preventDefault();
    }
}

function suRidimensiona() {
    posiziona();
}

export function avviaTour(nome) {
    const lista = TOUR[nome];
    if (!lista) {
        console.warn(`Tour sconosciuto: "${nome}"`);
        return;
    }
    if (tour) chiudiTour();
    creaElementi();

    // Nei mini tour i passi senza area in questo momento vengono saltati (il primo, senza area, resta sempre)
    const passi = nome === 'principale' ? lista : lista.filter(p => !p.area || trovaArea(p.area));
    tour = { nome, passi, indice: 0, ripristino: nome === 'principale' ? statoVista() : null, fuocoPrima: document.activeElement };

    elementi.overlay.hidden = false;
    window.addEventListener('keydown', suTasto, true);
    window.addEventListener('resize', suRidimensiona);
    document.addEventListener('scroll', suRidimensiona, true);
    mostraPasso();
}

export function chiudiTour() {
    if (!tour) return;
    const chiuso = tour;
    tour = null;
    clearTimeout(timerRiposiziona);
    elementi.overlay.hidden = true;
    window.removeEventListener('keydown', suTasto, true);
    window.removeEventListener('resize', suRidimensiona);
    document.removeEventListener('scroll', suRidimensiona, true);
    ripristina(chiuso.ripristino);
    if (chiuso.nome === 'principale') segnaTourVisto();
    if (chiuso.fuocoPrima?.isConnected) chiuso.fuocoPrima.focus?.({ preventScroll: true });
}

/* --- PRIMO AVVIO --- */

export function tourGiaVisto() {
    try {
        return localStorage.getItem(CHIAVE_TOUR_VISTO) === '1';
    } catch {
        return false;
    }
}

function segnaTourVisto() {
    try {
        localStorage.setItem(CHIAVE_TOUR_VISTO, '1');
    } catch {
        // Senza localStorage il tour ripartirà al prossimo avvio
    }
}
