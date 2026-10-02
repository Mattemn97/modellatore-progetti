# Verify: tutorial e aiuto contestuale · spec 0012 · updated 2026-10-02
_Steps derived from spec 0012 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Clic su `❓ Aiuto ▾` → menu con `Tour guidato` e `Mostra le (i)` spuntato; clic fuori → si chiude; aprendo Progetto il menu Aiuto si chiude → AC-1
- [x] `localStorage` vuoto, avvio → il tour parte da solo; Fine → `modellatore.tourVisto = '1'`; ricarica → non riparte → AC-2
- [x] Avvio con la finestra Apri progetto aperta (nessun progetto da riaprire) → il tour aspetta e parte appena la finestra si chiude → AC-2
- [x] Ogni passo: riflettore sull'area, `Passo N di 17`, Indietro disabilitato al primo, `Fine` all'ultimo, fumetto dentro la finestra a 1400×850 e 900×600 → AC-3, AC-5
- [x] Durante il tour: clic sul canvas, Ctrl+Z e Shift non hanno effetto; `→`, `Invio`, `←`, `Esc` funzionano; con una scelta attiva della Gerarchia, Esc chiude solo il tour → AC-4
- [x] Pannello destro chiuso e scheda Cliente attiva, tour fino al passo Ispettore, Esc → durante il passo il pannello è aperto; dopo, chiuso di nuovo e scheda Cliente attiva → AC-6
- [x] Riga dei gesti chiusa (✕) → il passo dei gesti mostra il fumetto al centro senza riflettore → AC-6
- [x] Ridimensionando la finestra durante un passo → riflettore e fumetto seguono l'area → AC-7
- [x] Matrice, Documenti, Import cliente e Filtri: `❓ Guida` avvia il mini tour; i passi senza area sono saltati e il conteggio torna; chiuso il mini tour la finestra resta aperta; `tourVisto` non cambia → AC-8
- [x] Hover sulla (i) di Tipologia → suggerimento dopo circa 300 ms; Tab → subito; Esc, uscita, clic, scroll → sparisce; vicino ai bordi resta dentro la finestra → AC-9
- [x] Hover sui pulsanti dell'inventario → suggerimento ricco, nessun `title` nativo; un pulsante con motivo di stato (es. Importa… senza progetto) mostra il motivo come riga in più → AC-10
- [x] Aggiungo un requisito, apro un altro blocco, un requisito cliente, un filo, l'import, i Filtri, il Changelog → le (i) ci sono e funzionano → AC-11
- [x] `Mostra le (i)` tolta → nessuna `.icona-aiuto` visibile, anche nel contenuto ridisegnato; ricarica → ancora nascoste; i pulsanti mostrano ancora il suggerimento → AC-12

## Commands
- [x] Script: raccoglie ogni `data-aiuto` del DOM in ogni superficie e ogni chiave del codice; tutte esistono in `SUGGERIMENTI`; nessun `console.warn` di chiave mancante → AC-13
- [x] `grep` in `packaging/TUTORIAL.md` di `❓ Aiuto`, `tour guidato`, `(i)` → presenti → AC-14

## Value sourcing
- [x] Suggerimento: titolo e testo vengono da `SUGGERIMENTI[data-aiuto]` (cambiare una chiave mostra l'altro testo)
- [x] Posizione: trigger vicino al bordo destro e in alto → suggerimento spostato dentro la finestra
- [x] Passo: area da `document.querySelector(passo.area)`; `N di M` dopo il filtro nei mini tour
- [x] Primo avvio: con `tourVisto = '1'` non parte; senza `localStorage` (bloccato) parte senza errori
- [x] Ripristino: pannelli e scheda letti all'avvio del tour, rimessi alla chiusura

## Acceptance-criteria coverage
- AC-1 menu · AC-2 primo avvio · AC-3, AC-5 passi · AC-4 tastiera e clic · AC-6 preparazione e fallback · AC-7 ridimensiona · AC-8 mini tour · AC-9 (i) · AC-10 pulsanti · AC-11 ridisegni · AC-12 nascondi · AC-13 chiavi · AC-14 tutorial
