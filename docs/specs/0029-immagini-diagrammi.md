# 0029. Immagini dei diagrammi: export del livello e figure nei documenti

**Date**: 2026-10-06
**Status**: Done

## Summary

Un livello del canvas si esporta come immagine SVG o PNG dal pulsante `🖼 Immagine` della barra del canvas. Gli stessi disegni entrano da soli nei documenti Word e PDF (spec 0028): il diagramma della radice nell'identificazione delle interfacce e nei componenti, e il diagramma interno di ogni blocco nel capitolo che lo descrive.

## Context

Il canvas disegna il livello aperto nel DOM, con zoom, filtri, Gerarchia, selezione e gestori del mouse. Per un'immagine pulita e per un livello che non è aperto (il documento descrive tutti i blocchi) serve un disegno che non dipenda dalla pagina. I documenti hanno già il posto: `_Diagrammi da completare._` nell'identificazione delle interfacce e il capitolo `Componenti` con un sottocapitolo per blocco (spec 0007).

## Requirements

**Acceptance criteria**:
- **AC-1**: `svgDiagramma(grafo, padre, libreria, cliente, impostazioni)` (`src/renderer/diagramma.ts`, puro) disegna un livello come SVG autonomo: blocchi con il nome, pin di interfaccia sul bordo e di capacità dentro, nei colori di `settings.json`, fili con gli snodi (tratteggiati quelli di derivazione), blocchi tondi del padre (o i requisiti cliente con una posizione, alla radice) con id e titolo. Stessa geometria del canvas, nessun filtro, nessuna evidenza, nessuna selezione. Sfondo bianco, margine di 20 px attorno a quello che c'è, stili scritti negli attributi (nessuna classe CSS). Un livello vuoto dà `null`.
- **AC-2**: `🖼 Immagine` nella barra del canvas apre un menu con `SVG` e `PNG`: scarica il livello aperto come `<progetto>-<livello>.svg` o `.png` (PNG a scala 2; `<livello>` è lo slug dell'etichetta del livello, `radice` alla radice). Su un livello vuoto dice `Il livello è vuoto: niente da esportare.`
- **AC-3**: Nei documenti Word e PDF, con un modello non vuoto: l'identificazione delle interfacce (IRS, IDD e le altre con interfacce) mostra al posto di `_Diagrammi da completare._` la figura `Diagramma: <nome del progetto>` della radice; il capitolo Componenti (SSDD, SDD) mostra la figura della radice dopo la tabella e, in ogni sottocapitolo di blocco, la figura `Diagramma interno: <titolo del blocco>` del suo interno, presa dalla prima istanza con un interno non vuoto (in ordine di visita del progetto); un blocco senza interno non ha figura.
- **AC-4**: L'export `.md` non cambia (le figure ci sono solo in Word e PDF). Nel Word la figura è un PNG largo al massimo 16 cm, nel PDF è l'SVG, nitido a ogni zoom. Sotto ogni figura c'è la didascalia in corsivo.

## Decision

- **Disegno puro e unico**: `svgDiagramma()` riusa la geometria del canvas, spostata in funzioni pure condivise con `renderer.ts` (posizione dei pin, colonna dei blocchi tondi). Scartato: clonare l'SVG del canvas (dipende da zoom, filtri e livello aperto).
- **Segnaposto nel Markdown**: `generaDocumento()` riceve `{ diagrammi: true }` solo per Word e PDF e scrive `![<didascalia>](diagramma:radice)` o `![<didascalia>](diagramma:blocco:<id>)`; la pagina prepara SVG e PNG delle chiavi presenti e li manda con il Markdown (spec 0028). Il lettore Markdown riconosce una riga fatta solo di un'immagine `diagramma:`.
- **PNG nella pagina**: l'SVG si disegna su un `canvas` da un URL Blob e si legge con `toBlob`: niente dipendenze, stesso risultato per l'export del livello e per il Word.
- **Testi di aiuto**: `canvas.immagine`.

## Build plan

1. `diagramma.ts` con test unitario, geometria condivisa con il renderer.
2. Pulsante e menu `🖼 Immagine`, export SVG e PNG.
3. Segnaposto in `generaDocumento()`, immagini nel Word e nel PDF.
4. E2e: SVG del livello scaricato; il Word di un SSDD contiene le immagini.

## Consequences

- Positivo: le figure dei documenti seguono il modello senza lavoro a mano.
- Negativo: un livello molto grande dà un PNG grande (il Word lo riduce in larghezza, non in risoluzione).
