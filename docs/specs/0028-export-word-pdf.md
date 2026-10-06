# 0028. Export Word e PDF dei documenti con un modello aziendale

**Date**: 2026-10-06
**Status**: Done

## Summary

Il pannello Documenti, oltre al Markdown, esporta lo stesso documento in Word (`.docx`) e in PDF. Il Markdown generato dalla spec 0007 resta l'unica fonte: il processo principale lo legge, ci mette sopra il modello aziendale (frontespizio con logo e nome dell'azienda, intestazione e piè di pagina su ogni pagina, tabella delle revisioni) e scrive il file. Il modello si regola in `settings.json`; le revisioni di ogni documento si scrivono nel pannello e si salvano nel progetto.

## Context

Il documento consegnato al cliente è un Word o un PDF, non un Markdown: oggi serve uno strumento esterno (Pandoc) e il formato aziendale si rifà a mano a ogni emissione. L'app è Electron: il processo principale ha Node (zip, file) e Chromium (`printToPDF`), la pagina è in sandbox e parla con lui solo dal preload. I documenti sono già calcolati da una funzione pura (`generaDocumento()`, spec 0007 e 0027) e il loro Markdown usa un sottoinsieme piccolo (titoli, paragrafi, elenchi puntati, tabelle, corsivo e grassetto) più il Markdown che l'utente scrive nei testi.

## Requirements

**Acceptance criteria**:
- **AC-1**: Il pannello Documenti ha tre pulsanti di export: `⬇ .md` (quello di oggi, stesso file byte per byte), `⬇ Word` e `⬇ PDF`. I due nuovi scaricano `<progetto>-<documento>.docx` e `.pdf` con la finestra Salva con nome, come il Markdown. Sono disabilitati quando lo è `.md`; mentre un export è in corso il pulsante è disabilitato e dice `…`.
- **AC-2**: Il contenuto del corpo è quello del Markdown: il titolo `#` iniziale e la riga `Data: …` che lo segue li sostituisce il frontespizio (AC-4); ogni altro titolo `##`…`######` diventa un titolo di livello 1…5 (in Word con gli stili `Heading1`…`Heading5`, così il riquadro di spostamento e un indice di Word funzionano), i paragrafi restano paragrafi (una riga a capo dentro un paragrafo resta a capo), le righe `- ` e `1. ` diventano elenchi, le tabelle `| … |` diventano tabelle con bordi e intestazione in grassetto, `**x**` grassetto, `_x_` e `*x*` corsivo, `` `x` `` carattere a spaziatura fissa. Le sequenze `\|` e `\\` delle celle tornano `|` e `\`. Tutto il resto resta testo così com'è.
- **AC-3**: Il modello aziendale sta in `settings.json`, chiave `documentiExport.modello`: `azienda`, `logo` (percorso di un PNG o JPEG relativo alla cartella di lavoro), `classificazione`, `piePagina`, `autore`; tutti testo, predefinito `""`. Un valore mancante o non testo vale `""`.
- **AC-4**: Il file Word e il PDF si aprono con un frontespizio: il logo (se c'è), il nome dell'azienda, il titolo `<documento> · <titolo del DID>`, il nome del progetto, la data, la libreria con versione, la revisione corrente (l'ultima della tabella, altrimenti `—`) e la classificazione (se c'è). Segue la tabella `Registro delle revisioni` (Revisione, Data, Descrizione, Autore), poi il corpo. Ogni pagina ha l'intestazione `<azienda> · <documento> · Rev. <revisione>` (senza le parti vuote) e il piè di pagina `<piePagina> · Pagina N di M` (senza `piePagina` se vuoto).
- **AC-5**: Un logo che manca, è fuori dalla cartella di lavoro, non è PNG o JPEG o supera 2 MB non ferma l'export: il documento esce senza logo e il pannello mostra `Logo non usato: <motivo>`.
- **AC-6**: Nel pannello, sotto il riepilogo, l'elenco richiudibile `Revisioni di <D>: N` mostra la tabella delle revisioni del documento scelto, con i campi modificabili e una ✕ per riga, e il pulsante `+ Revisione`, che aggiunge una riga con la revisione successiva (dopo `A` viene `B`, dopo `3` viene `4`, la prima è `A`, altrimenti vuota), la data di oggi e `autore` del modello. Ogni modifica va nel progetto (`revisioniDocumenti`, una lista per documento) con il salvataggio automatico, Annulla e Ripeti come le altre modifiche.
- **AC-7**: Un progetto senza `revisioniDocumenti` si apre come prima e non cambia sul disco finché non aggiungi una revisione. Il processo principale accetta la chiave facoltativa e la porta con sé quando ripristina una versione o rinomina il progetto, come `cliente`. Un valore non valido si ignora all'apertura.
- **AC-8**: Un errore nella creazione del file (per esempio il PDF che non si genera) dà l'alert `Documento non esportato: <motivo>` e non scarica nulla.

## Options considered

### Option 1: Markdown come fonte, file scritti nel processo principale (scelta)
Un lettore del Markdown e due scrittori (OOXML a mano, HTML stampato con `printToPDF` in una finestra nascosta) in `src/main/documenti/`; la pagina manda Markdown, modello e immagini dal preload e riceve i byte.
- Pro: una sola fonte per i tre formati; Node e Chromium fanno zip e PDF senza dipendenze; testabile in Vitest senza Electron (lettore e Word).
- Contro: il lettore copre solo il sottoinsieme che serve.

### Option 2: Libreria `docx` di npm e `pdfmake`
- Pro: più funzioni pronte. Contro: due dipendenze grandi nel pacchetto, una seconda descrizione del documento da tenere allineata alla capitolazione.

### Option 3: Pandoc esterno
- Contro: va installato su ogni postazione; fuori dal controllo dell'app.

## Decision

**Chosen option**: Option 1.

**Scelte fatte qui**:
- **Lettore**: `leggiMarkdown()` (`src/main/documenti/markdown.ts`) dà blocchi `titolo`, `paragrafo`, `elenco`, `tabella`, `immagine` (spec 0029) con testo in pezzi (`grassetto`, `corsivo`, `codice`). Puro, provato in Vitest.
- **Word**: `scriviDocx()` (`docx.ts`) scrive le parti minime (`[Content_Types].xml`, `_rels`, `document.xml`, `styles.xml`, `numbering.xml`, `header1.xml`, `footer1.xml`, `settings.xml`, media) in uno zip scritto da `zip-scrittura.ts` (deflate e `zlib.crc32` di Node). Numeri di pagina con i campi `PAGE` e `NUMPAGES`. A4, margini 2 cm.
- **PDF**: `htmlDocumento()` (`html.ts`) e `stampaPdf()` (`esporta.ts`, con il canale): finestra nascosta con le stesse impostazioni di sicurezza, JavaScript spento e nessuna navigazione, che carica la pagina da `app://modellatore/stampa/<id>.html` (servita dalla memoria dal protocollo, mai da disco, così non c'è limite di lunghezza di un URL `data:`), poi `printToPDF` A4 con intestazione e piè di pagina di Chromium (`pageNumber`, `totalPages`).
- **Ponte**: `desktop.documenti.esporta({ formato, markdown, intestazione, modello, revisioni, immagini })` (`ipcRenderer.invoke`), risposta `{ ok: true, dati: Uint8Array, avviso }` o `{ ok: false, messaggio }`. Il logo lo legge il processo principale, dentro la cartella di lavoro. La pagina scarica i byte con un Blob, come il Markdown.
- **Revisioni nel progetto**: `appState.revisioniDocumenti` (`Record<string, RevisioneDocumento[]>`), scritta in `testoProgetto()` solo se non vuota; `sostituisciModello()` e `impostaProgetto()` ricevono i dati del file al posto di `workspace` e `cliente` separati. Lato server `conCliente()` diventa `conModello()` e copia anche `revisioniDocumenti`.
- **Testi di aiuto**: `documenti.word`, `documenti.pdf`, `documenti.revisioni`, `documenti.nuovaRevisione`.

## Security model

Nessuna rotta nuova. Il canale IPC accetta solo `docx` o `pdf` e testi; il logo si legge solo dentro la cartella di lavoro (`risolviFile`), con estensione e dimensione controllate. La finestra di stampa ha `sandbox`, `contextIsolation`, niente Node, niente JavaScript e nessuna navigazione; il testo dell'utente entra nell'HTML con l'escape e nel Word come testo XML con l'escape.

## Build plan

1. Lettore Markdown, zip in scrittura e Word con modello, provati in Vitest.
2. HTML e PDF nel processo principale, canale e preload.
3. Pannello: pulsanti, revisioni nel progetto (pagina e server), avvisi.
4. E2e: Word e PDF scaricati, revisione salvata nel progetto; guida e tutorial.

## Consequences

- Positivo: il documento consegnabile esce dall'app, con il formato aziendale e le revisioni.
- Negativo: il lettore Markdown non copre tutto il Markdown (per esempio citazioni e codice a blocchi restano testo).
- Neutro: il file progetto ha una chiave facoltativa in più; una versione precedente dell'app la conserva solo finché non riscrive il progetto.
