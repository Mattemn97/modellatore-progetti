/* --- PAGINA HTML DEL DOCUMENTO DA STAMPARE IN PDF (spec 0028, logica pura) --- */
// Stessi blocchi del Word: frontespizio, registro delle revisioni, corpo dal Markdown; i diagrammi come SVG (spec 0029).
// Intestazione e piè di pagina li aggiunge printToPDF (testoIntestazione, piePaginaPdf).
import { corpoDocumento, leggiMarkdown, type BloccoMd, type Riga } from './markdown.js';
import { revisioneCorrente, type Logo, type RichiestaExport } from './modello.js';

export function escHtml(testo: string): string {
    return testo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function riga(r: Riga): string {
    return r.map((p) => {
        let h = escHtml(p.testo);
        if (p.codice) h = `<code>${h}</code>`;
        if (p.corsivo) h = `<em>${h}</em>`;
        if (p.grassetto) h = `<strong>${h}</strong>`;
        return h;
    }).join('');
}

// Un SVG del diagramma entra così com'è: lo scrive diagramma.ts con i testi già passati per l'escape.
// Per sicurezza si tolgono comunque script e gestori di eventi (la finestra di stampa ha JavaScript spento)
function svgSicuro(svg: string): string {
    return svg.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');
}

function corpo(blocchi: BloccoMd[], r: RichiestaExport): string {
    return blocchi.map((b) => {
        switch (b.tipo) {
            case 'titolo': {
                const n = Math.min(b.livello, 6);
                return `<h${n}>${riga(b.pezzi)}</h${n}>`;
            }
            case 'paragrafo':
                return `<p>${b.righe.map(riga).join('<br>')}</p>`;
            case 'elenco': {
                const tag = b.ordinato ? 'ol' : 'ul';
                return `<${tag}>${b.voci.map((v) => `<li>${riga(v)}</li>`).join('')}</${tag}>`;
            }
            case 'tabella':
                return `<table><thead><tr>${b.intestazione.map((c) => `<th>${riga(c)}</th>`).join('')}</tr></thead>`
                    + `<tbody>${b.righe.map((rr) => `<tr>${rr.map((c) => `<td>${riga(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
            case 'immagine': {
                const immagine = r.immagini[b.chiave];
                if (!immagine) return '';
                return `<figure>${svgSicuro(immagine.svg)}<figcaption>${escHtml(b.didascalia)}</figcaption></figure>`;
            }
        }
    }).join('\n');
}

const STILE = `
@page { size: A4; margin: 2.2cm 2cm 2cm 2cm; }
body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 11pt; color: #222; line-height: 1.35; }
h1, h2, h3, h4, h5, h6 { color: #1f3864; page-break-after: avoid; margin: 1.1em 0 0.4em; }
h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 14pt; } h4 { font-size: 12pt; } h5, h6 { font-size: 11pt; }
p { margin: 0 0 0.6em; }
table { border-collapse: collapse; width: 100%; margin: 0.4em 0 1em; font-size: 9pt; page-break-inside: auto; }
th, td { border: 1px solid #999; padding: 3px 5px; text-align: left; vertical-align: top; }
th { background: #e8eef4; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
code { font-family: Consolas, monospace; font-size: 0.95em; }
figure { margin: 0.8em 0; text-align: center; page-break-inside: avoid; }
figure svg { max-width: 100%; height: auto; }
figcaption { font-style: italic; font-size: 9pt; color: #444; margin-top: 0.3em; }
.frontespizio { text-align: center; page-break-after: always; padding-top: 4cm; }
.frontespizio img { max-width: 6cm; max-height: 4cm; margin-bottom: 1cm; }
.azienda { font-size: 16pt; font-weight: bold; margin-bottom: 1.5cm; }
.titolo { font-size: 22pt; font-weight: bold; color: #1f3864; margin-bottom: 0.4cm; }
.progetto { font-size: 16pt; margin-bottom: 2cm; }
.registro { page-break-after: always; }
.registro h1 { font-size: 14pt; }
`;

export function htmlDocumento(r: RichiestaExport, logo: Logo | null): string {
    const dati: Array<[string, string]> = [
        ['Data', r.intestazione.data],
        ['Libreria', r.intestazione.libreria],
        ['Revisione', revisioneCorrente(r.revisioni)]
    ];
    if (r.modello.classificazione.trim()) dati.push(['Classificazione', r.modello.classificazione.trim()]);
    const immagineLogo = logo ? `<img src="data:image/${logo.tipo};base64,${logo.dati.toString('base64')}" alt="Logo">` : '';
    const revisioni = r.revisioni.length
        ? r.revisioni.map((v) => `<tr><td>${escHtml(v.revisione)}</td><td>${escHtml(v.data)}</td><td>${escHtml(v.descrizione)}</td><td>${escHtml(v.autore)}</td></tr>`).join('')
        : '<tr><td>—</td><td></td><td></td><td></td></tr>';
    return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>${escHtml(`${r.intestazione.documento} · ${r.intestazione.progetto}`)}</title><style>${STILE}</style></head>
<body>
<section class="frontespizio">
${immagineLogo}
${r.modello.azienda.trim() ? `<div class="azienda">${escHtml(r.modello.azienda.trim())}</div>` : ''}
<div class="titolo">${escHtml(`${r.intestazione.documento} · ${r.intestazione.titolo}`)}</div>
<div class="progetto">${escHtml(r.intestazione.progetto)}</div>
${dati.map(([e, v]) => `<p><strong>${escHtml(e)}:</strong> ${escHtml(v)}</p>`).join('\n')}
</section>
<section class="registro">
<h1>Registro delle revisioni</h1>
<table><thead><tr><th style="width:12%">Revisione</th><th style="width:15%">Data</th><th>Descrizione</th><th style="width:20%">Autore</th></tr></thead><tbody>${revisioni}</tbody></table>
</section>
${corpo(corpoDocumento(leggiMarkdown(r.markdown)), r)}
</body></html>`;
}

// Modelli di intestazione e piè di pagina di Chromium: pageNumber e totalPages li riempie printToPDF
export function intestazionePdf(testo: string): string {
    return `<div style="font-size:8pt; color:#666; width:100%; padding:0 2cm; text-align:right; font-family:Calibri, Arial, sans-serif;">${escHtml(testo)}</div>`;
}

export function piePaginaPdf(testo: string): string {
    const prima = testo.trim() ? `${escHtml(testo.trim())} · ` : '';
    return `<div style="font-size:8pt; color:#666; width:100%; padding:0 2cm; text-align:center; font-family:Calibri, Arial, sans-serif;">${prima}Pagina <span class="pageNumber"></span> di <span class="totalPages"></span></div>`;
}
