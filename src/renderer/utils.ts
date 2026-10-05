/* --- UTILITÀ COMUNI: ID UNIVOCI, SLUG, DATA, ESCAPE HTML, ELEMENTI DEL DOM E RICHIESTA DI UN TESTO --- */

// Id interno difficile da far collidere anche in modelli grandi (nodi, fili)
export function generaId(prefisso: string): string {
    const casuale = Math.random().toString(36).slice(2, 8);
    return `${prefisso}_${Date.now().toString(36)}${casuale}`;
}

// Segni diacritici combinanti (U+0300-U+036F) lasciati da normalize('NFD')
const DIACRITICI = new RegExp('[\\u0300-\\u036f]', 'g');

// Trasforma un titolo in un id leggibile: minuscole, niente accenti, solo lettere, cifre e underscore
export function slugifyId(testo: unknown): string {
    return String(testo ?? '')
        .normalize('NFD').replace(DIACRITICI, '')
        .toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// Data di oggi in ora locale, AAAA-MM-GG (export della matrice e dei documenti)
export function dataOggi(): string {
    const d = new Date();
    const due = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

const SOSTITUZIONI: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Da usare su ogni testo utente interpolato in un template innerHTML
export function escapeHtml(valore: unknown): string {
    return String(valore ?? '').replace(/[&<>"']/g, (c) => SOSTITUZIONI[c] ?? c);
}

// Elemento della pagina con il suo tipo; un id sbagliato è un errore di programmazione, non un caso da gestire
export function elemento<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Elemento #${id} mancante nella pagina`);
    return el as T;
}

// Come elemento(), ma per le parti facoltative della pagina
export function elementoSe<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

// Messaggio di un errore qualsiasi
export function messaggioDi(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

// Chiede un testo all'utente. L'app desktop non ha prompt(): usa la sua finestra (preload, spec 0016)
export function chiediTesto(messaggio: string, predefinito = ''): string | null {
    const desktop = window.desktop;
    return desktop?.chiediTesto ? desktop.chiediTesto(String(messaggio), String(predefinito ?? '')) : prompt(messaggio, predefinito);
}
