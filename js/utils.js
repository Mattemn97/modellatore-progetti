/* --- UTILITÀ COMUNI: ID UNIVOCI, SLUG ED ESCAPE HTML --- */

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

// Da usare su ogni testo utente interpolato in un template innerHTML
export function escapeHtml(valore) {
    const sostituzioni = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(valore ?? '').replace(/[&<>"']/g, c => sostituzioni[c]);
}
