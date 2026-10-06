/* --- SCRITTURA DEL DOCUMENTO WORD (.docx) CON IL MODELLO AZIENDALE (spec 0028, logica pura) --- */
// Parti minime di WordprocessingML scritte a mano: frontespizio, registro delle revisioni, corpo dal Markdown,
// intestazione e piè di pagina con i numeri di pagina. A4, margini 2 cm.
import { corpoDocumento, leggiMarkdown, type BloccoMd, type Pezzo, type Riga } from './markdown.js';
import { revisioneCorrente, testoIntestazione, type Logo, type RichiestaExport } from './modello.js';
import { scriviZip, type VoceZip } from './zip-scrittura.js';

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    + 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const INTESTAZIONE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// Larghezza utile della pagina: 21 cm meno 2 + 2 cm di margine, in ventesimi di punto e in EMU
const LARGHEZZA_TWIP = 9638;
const EMU_PER_PX = 9525;
const LARGHEZZA_MAX_EMU = 16 * 360000;

export function escXml(testo: string): string {
    return testo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        // Caratteri di controllo non ammessi in XML 1.0
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

function run(testo: string, stile: { grassetto?: boolean; corsivo?: boolean; codice?: boolean; dimensione?: number; colore?: string } = {}): string {
    const proprieta = [
        stile.codice ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : '',
        stile.grassetto ? '<w:b/>' : '',
        stile.corsivo ? '<w:i/>' : '',
        stile.colore ? `<w:color w:val="${stile.colore}"/>` : '',
        stile.dimensione ? `<w:sz w:val="${stile.dimensione}"/><w:szCs w:val="${stile.dimensione}"/>` : ''
    ].join('');
    return `<w:r>${proprieta ? `<w:rPr>${proprieta}</w:rPr>` : ''}<w:t xml:space="preserve">${escXml(testo)}</w:t></w:r>`;
}

const runsRiga = (riga: Riga, extra: { grassetto?: boolean; dimensione?: number } = {}): string =>
    riga.map((p: Pezzo) => run(p.testo, { ...p, grassetto: p.grassetto || extra.grassetto, dimensione: extra.dimensione })).join('');

function paragrafo(contenuto: string, proprieta = ''): string {
    return `<w:p>${proprieta ? `<w:pPr>${proprieta}</w:pPr>` : ''}${contenuto}</w:p>`;
}

const interruzionePagina = (): string => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/* --- Immagini: PNG nella cartella media, riferite da document.xml.rels --- */

interface Media {
    nome: string;
    dati: Buffer;
    rId: string;
}

class Allegati {
    readonly media: Media[] = [];
    private prossimoId = 1;

    aggiungi(dati: Buffer, estensione: string): string {
        const rId = `rIdImg${this.media.length + 1}`;
        this.media.push({ nome: `immagine${this.media.length + 1}.${estensione}`, dati, rId });
        return rId;
    }

    idDisegno(): number {
        return this.prossimoId++;
    }
}

function disegno(allegati: Allegati, rId: string, cx: number, cy: number, nome: string): string {
    const id = allegati.idDisegno();
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>`
        + `<wp:docPr id="${id}" name="${escXml(nome)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>`
        + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
        + `<pic:nvPicPr><pic:cNvPr id="${id}" name="${escXml(nome)}"/><pic:cNvPicPr/></pic:nvPicPr>`
        + `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
        + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}

// Dimensioni in EMU entro la larghezza massima, rispettando le proporzioni
function misure(larghezzaPx: number, altezzaPx: number, massimaEmu = LARGHEZZA_MAX_EMU): { cx: number; cy: number } {
    let cx = Math.round(larghezzaPx * EMU_PER_PX);
    let cy = Math.round(altezzaPx * EMU_PER_PX);
    if (cx > massimaEmu) {
        cy = Math.round(cy * massimaEmu / cx);
        cx = massimaEmu;
    }
    return { cx, cy };
}

/* --- Tabelle --- */

function tabella(intestazione: string[], righe: string[][], larghezze?: number[]): string {
    const colonne = Math.max(intestazione.length, ...righe.map((r) => r.length), 1);
    const misureColonne = larghezze ?? Array.from({ length: colonne }, () => Math.floor(LARGHEZZA_TWIP / colonne));
    const cella = (contenuto: string, i: number, sfondo = ''): string =>
        `<w:tc><w:tcPr><w:tcW w:w="${misureColonne[i] ?? 0}" w:type="dxa"/>${sfondo ? `<w:shd w:val="clear" w:color="auto" w:fill="${sfondo}"/>` : ''}</w:tcPr>${contenuto || '<w:p/>'}</w:tc>`;
    const riempi = (celle: string[]): string[] => [...celle, ...Array<string>(Math.max(0, colonne - celle.length)).fill('<w:p/>')];
    const bordo = (lato: string): string => `<w:${lato} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`;
    return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>'
        + `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(bordo).join('')}</w:tblBorders>`
        + '<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>'
        + `<w:tblGrid>${misureColonne.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
        + `<w:tr><w:trPr><w:tblHeader/></w:trPr>${riempi(intestazione).map((c, i) => cella(c, i, 'E8EEF4')).join('')}</w:tr>`
        + righe.map((r) => `<w:tr>${riempi(r).map((c, i) => cella(c, i)).join('')}</w:tr>`).join('')
        + '</w:tbl>' + paragrafo('', '<w:spacing w:after="0"/>');
}

const paragrafoCella = (riga: Riga, grassetto = false): string =>
    paragrafo(runsRiga(riga, { grassetto, dimensione: 18 }), '<w:spacing w:before="20" w:after="20"/>');

/* --- Corpo dal Markdown --- */

function corpo(blocchi: BloccoMd[], richiesta: RichiestaExport, allegati: Allegati, numerazioni: string[]): string {
    return blocchi.map((b) => {
        switch (b.tipo) {
            case 'titolo':
                return paragrafo(runsRiga(b.pezzi), `<w:pStyle w:val="Heading${Math.min(b.livello, 6)}"/>`);
            case 'paragrafo':
                return paragrafo(b.righe.map((r) => runsRiga(r)).join('<w:r><w:br/></w:r>'));
            case 'elenco': {
                // Ogni elenco numerato riparte da 1: un'istanza di numerazione per elenco
                let numId = 1;
                if (b.ordinato) {
                    numerazioni.push(`<w:num w:numId="${numerazioni.length + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`);
                    numId = numerazioni.length + 1;
                }
                return b.voci.map((v) => paragrafo(runsRiga(v), `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`)).join('');
            }
            case 'tabella':
                return tabella(b.intestazione.map((c) => paragrafoCella(c, true)), b.righe.map((r) => r.map((c) => paragrafoCella(c))));
            case 'immagine': {
                const immagine = richiesta.immagini[b.chiave];
                if (!immagine) return '';
                const rId = allegati.aggiungi(Buffer.from(immagine.png), 'png');
                const { cx, cy } = misure(immagine.larghezza, immagine.altezza);
                return paragrafo(disegno(allegati, rId, cx, cy, b.didascalia), '<w:jc w:val="center"/><w:keepNext/>')
                    + paragrafo(run(b.didascalia, { corsivo: true }), '<w:pStyle w:val="Caption"/><w:jc w:val="center"/>');
            }
        }
    }).join('');
}

/* --- Frontespizio e registro delle revisioni (AC-4) --- */

function frontespizio(r: RichiestaExport, logo: Logo | null, allegati: Allegati): string {
    const parti: string[] = [paragrafo('', '<w:spacing w:before="1200"/>')];
    if (logo) {
        const rId = allegati.aggiungi(logo.dati, logo.tipo === 'png' ? 'png' : 'jpeg');
        const { cx, cy } = misure(logo.larghezza, logo.altezza, 6 * 360000);
        // Un logo alto non deve occupare la pagina: al massimo 4 cm
        const fattore = Math.min(1, (4 * 360000) / cy);
        parti.push(paragrafo(disegno(allegati, rId, Math.round(cx * fattore), Math.round(cy * fattore), 'Logo'), '<w:jc w:val="center"/><w:spacing w:after="400"/>'));
    }
    if (r.modello.azienda.trim()) parti.push(paragrafo(run(r.modello.azienda.trim(), { grassetto: true, dimensione: 32 }), '<w:jc w:val="center"/><w:spacing w:after="600"/>'));
    parti.push(paragrafo(run(`${r.intestazione.documento} · ${r.intestazione.titolo}`), '<w:pStyle w:val="Title"/><w:jc w:val="center"/>'));
    parti.push(paragrafo(run(r.intestazione.progetto, { dimensione: 32 }), '<w:jc w:val="center"/><w:spacing w:after="800"/>'));
    const dati: Array<[string, string]> = [
        ['Data', r.intestazione.data],
        ['Libreria', r.intestazione.libreria],
        ['Revisione', revisioneCorrente(r.revisioni)]
    ];
    if (r.modello.classificazione.trim()) dati.push(['Classificazione', r.modello.classificazione.trim()]);
    dati.forEach(([etichetta, valore]) => parti.push(paragrafo(run(`${etichetta}: `, { grassetto: true }) + run(valore), '<w:jc w:val="center"/>')));
    return parti.join('') + interruzionePagina();
}

function registroRevisioni(r: RichiestaExport): string {
    const righe = r.revisioni.map((v) => [v.revisione, v.data, v.descrizione, v.autore].map((t) => paragrafoCella([{ testo: t }])));
    const vuote = righe.length ? [] : [['—', '', '', ''].map((t) => paragrafoCella([{ testo: t }]))];
    return paragrafo(run('Registro delle revisioni', { grassetto: true, dimensione: 28 }), '<w:spacing w:after="200"/>')
        + tabella(['Revisione', 'Data', 'Descrizione', 'Autore'].map((t) => paragrafoCella([{ testo: t }], true)), [...righe, ...vuote], [1300, 1500, 5038, 1800])
        + interruzionePagina();
}

/* --- Parti fisse del pacchetto --- */

const STILI = `${INTESTAZIONE_XML}<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="it-IT"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="300"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>
${[40, 32, 28, 24, 22, 22].map((sz, i) => `<w:style w:type="paragraph" w:styleId="Heading${i + 1}"><w:name w:val="heading ${i + 1}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${i === 0 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${i}"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`).join('\n')}
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:i/><w:color w:val="444444"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;

function numerazione(istanze: string[]): string {
    return `${INTESTAZIONE_XML}<w:numbering ${NS}>
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
${istanze.join('\n')}
</w:numbering>`;
}

function intestazionePagina(testo: string): string {
    return `${INTESTAZIONE_XML}<w:hdr ${NS}>${paragrafo(run(testo), '<w:pStyle w:val="Header"/><w:jc w:val="right"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="999999"/></w:pBdr>')}</w:hdr>`;
}

function piePagina(testo: string): string {
    const campo = (istruzione: string): string => `<w:fldSimple w:instr=" ${istruzione} "><w:r><w:t>1</w:t></w:r></w:fldSimple>`;
    const prima = testo.trim() ? `${testo.trim()} · ` : '';
    return `${INTESTAZIONE_XML}<w:ftr ${NS}>${paragrafo(run(`${prima}Pagina `) + campo('PAGE') + run(' di ') + campo('NUMPAGES'), '<w:pStyle w:val="Footer"/><w:jc w:val="center"/>')}</w:ftr>`;
}

const SEZIONE = '<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/>'
    + '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';

function tipiContenuto(): string {
    return `${INTESTAZIONE_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Default Extension="png" ContentType="image/png"/>'
        + '<Default Extension="jpeg" ContentType="image/jpeg"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
        + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
        + '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
        + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + '</Types>';
}

function proprieta(r: RichiestaExport): string {
    const titolo = `${r.intestazione.documento} · ${r.intestazione.titolo} · ${r.intestazione.progetto}`;
    return `${INTESTAZIONE_XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">`
        + `<dc:title>${escXml(titolo)}</dc:title><dc:creator>${escXml(r.modello.autore || r.modello.azienda || 'Modellatore MBSE')}</dc:creator></cp:coreProperties>`;
}

const REL = (id: string, tipo: string, destinazione: string): string =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/${tipo}" Target="${destinazione}"/>`;

export function scriviDocx(richiesta: RichiestaExport, logo: Logo | null): Buffer {
    const allegati = new Allegati();
    const numerazioni: string[] = [];
    const corpoXml = frontespizio(richiesta, logo, allegati)
        + registroRevisioni(richiesta)
        + corpo(corpoDocumento(leggiMarkdown(richiesta.markdown)), richiesta, allegati, numerazioni);
    const documento = `${INTESTAZIONE_XML}<w:document ${NS}><w:body>${corpoXml}${SEZIONE}</w:body></w:document>`;

    const relazioni = `${INTESTAZIONE_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + REL('rIdStyles', 'officeDocument/2006/relationships/styles', 'styles.xml')
        + REL('rIdNumbering', 'officeDocument/2006/relationships/numbering', 'numbering.xml')
        + REL('rIdSettings', 'officeDocument/2006/relationships/settings', 'settings.xml')
        + REL('rIdHeader', 'officeDocument/2006/relationships/header', 'header1.xml')
        + REL('rIdFooter', 'officeDocument/2006/relationships/footer', 'footer1.xml')
        + allegati.media.map((m) => REL(m.rId, 'officeDocument/2006/relationships/image', `media/${m.nome}`)).join('')
        + '</Relationships>';
    const radice = `${INTESTAZIONE_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + REL('rId1', 'officeDocument/2006/relationships/officeDocument', 'word/document.xml')
        + REL('rId2', 'package/2006/relationships/metadata/core-properties', 'docProps/core.xml')
        + '</Relationships>';
    const impostazioni = `${INTESTAZIONE_XML}<w:settings ${NS}><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`;

    const testo = (nome: string, contenuto: string): VoceZip => ({ nome, dati: Buffer.from(contenuto, 'utf-8') });
    return scriviZip([
        testo('[Content_Types].xml', tipiContenuto()),
        testo('_rels/.rels', radice),
        testo('docProps/core.xml', proprieta(richiesta)),
        testo('word/document.xml', documento),
        testo('word/_rels/document.xml.rels', relazioni),
        testo('word/styles.xml', STILI),
        testo('word/numbering.xml', numerazione(numerazioni)),
        testo('word/settings.xml', impostazioni),
        testo('word/header1.xml', intestazionePagina(testoIntestazione(richiesta))),
        testo('word/footer1.xml', piePagina(richiesta.modello.piePagina)),
        ...allegati.media.map((m) => ({ nome: `word/media/${m.nome}`, dati: m.dati }))
    ]);
}
