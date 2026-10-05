/* --- FINESTRE STACCATE: RICERCA NEI LORO DOCUMENTI E SCORCIATOIE (spec 0023) --- */
// Una finestra staccata è una pagina vuota in cui la principale sposta i nodi di un pannello: il codice gira
// tutto qui. I moduli cercano gli elementi con document.getElementById & co.: le avvolgiamo una volta, così
// trovano anche quello che sta in una finestra staccata.

const documenti = new Set<Document>();
// Alla chiusura il documento della finestra può non essere più raggiungibile: lo teniamo da parte
const documentoDi = new Map<Window, Document>();

function cercaNegliAltri<T>(cerca: (d: Document) => T | null): T | null {
    for (const d of documenti) {
        const trovato = cerca(d);
        if (trovato) return trovato;
    }
    return null;
}

let installata = false;

export function installaRicercaNelleStaccate(): void {
    if (installata) return;
    installata = true;
    const perId = document.getElementById.bind(document);
    const uno = document.querySelector.bind(document);
    const tutti = document.querySelectorAll.bind(document);
    document.getElementById = (id: string) => perId(id) ?? cercaNegliAltri((d) => d.getElementById(id));
    document.querySelector = ((selettore: string) =>
        uno(selettore) ?? cercaNegliAltri((d) => d.querySelector(selettore))) as typeof document.querySelector;
    // Un array al posto della NodeList quando serve unire: i moduli usano solo forEach, length e l'indice
    document.querySelectorAll = ((selettore: string) => {
        const qui = tutti(selettore);
        if (!documenti.size) return qui;
        const altrove = [...documenti].flatMap((d) => [...d.querySelectorAll(selettore)]);
        return altrove.length ? [...qui, ...altrove] : qui;
    }) as typeof document.querySelectorAll;
}

// Ctrl+Z, Ctrl+Y e le altre scorciatoie premute nella finestra staccata arrivano alla principale
function inoltraScorciatoie(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
    const copia = new KeyboardEvent('keydown', {
        key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey,
        bubbles: true, cancelable: true
    });
    if (!document.dispatchEvent(copia)) e.preventDefault();
}

export function aggiungiStaccata(finestra: Window): void {
    const d = finestra.document;
    if (documenti.has(d)) return;
    documenti.add(d);
    documentoDi.set(finestra, d);
    d.addEventListener('keydown', inoltraScorciatoie);
}

export function togliStaccata(finestra: Window): void {
    const d = documentoDi.get(finestra);
    if (d) documenti.delete(d);
    documentoDi.delete(finestra);
}
