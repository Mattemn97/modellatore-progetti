/* --- UTILITÀ COMUNI: ID UNIVOCI, SLUG, DATA, ESCAPE HTML E RICHIESTA DI UN TESTO --- */

// Id interno difficile da far collidere anche in modelli grandi (nodi, fili)
export function generaId(prefisso) {
    const casuale = Math.random().toString(36).slice(2, 8);
    return `${prefisso}_${Date.now().toString(36)}${casuale}`;
}

// Trasforma un titolo in un id leggibile: minuscole, niente accenti, solo lettere, cifre e underscore
export function slugifyId(testo) {
    return String(testo ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// Data di oggi in ora locale, AAAA-MM-GG (export della matrice e dei documenti)
export function dataOggi() {
    const d = new Date();
    const due = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

// Da usare su ogni testo utente interpolato in un template innerHTML
export function escapeHtml(valore) {
    const sostituzioni = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(valore ?? '').replace(/[&<>"']/g, c => sostituzioni[c]);
}

// Chiede un testo all'utente. L'app desktop non ha prompt(): usa la sua finestra (preload, spec 0016)
export function chiediTesto(messaggio, predefinito = '') {
    const desktop = window.desktop;
    return desktop?.chiediTesto ? desktop.chiediTesto(String(messaggio), String(predefinito ?? '')) : prompt(messaggio, predefinito);
}
