# 0011. Rifiniture dell'editor: rilascio sotto il cursore e spostamento delle porte scopribile

**Date**: 2026-10-02
**Status**: Proposed

## Summary

Due piccoli difetti dell'editor. Un blocco trascinato dalla libreria oggi cade in un punto calcolato senza zoom e pan, quindi lontano dal cursore appena la vista non è quella iniziale: d'ora in poi cade centrato sotto il cursore, agganciato alla griglia, a qualsiasi zoom. Lo spostamento delle porte con Shift si scopre solo dal suggerimento di un pin: compare una riga di aiuto in basso sul canvas con i gesti principali, e tenendo premuto Shift sopra una porta il cursore diventa quello di spostamento.

## Requirements

**User stories**:
- Come progettista voglio che un blocco cada dove lo rilascio, anche con la vista ingrandita o spostata.
- Come progettista voglio scoprire senza leggere il codice che le porte si spostano con Shift.

**Acceptance criteria**:
- **AC-1**: Rilasciando un blocco dalla libreria sul canvas, il nuovo nodo ha l'angolo in alto a sinistra in `round((P − dimensione/2) / griglia) × griglia` per ciascun asse, dove `P` è il punto del canvas sotto il cursore con zoom e pan tolti (senza aggancio) e `dimensione` è `node.width` / `node.height` di `settings`. Il cursore cade quindi dentro il rettangolo del blocco a qualsiasi zoom (0,2 – 3) e pan. Il rilascio di un requisito cliente non cambia.
- **AC-2**: In basso a sinistra del canvas c'è la riga di aiuto `#aiutoCanvas` con il testo `Shift+trascina una porta per spostarla lungo il bordo · Doppio clic su un filo: aggiungi snodo · Clic destro su un filo: elimina · Doppio clic su un blocco: entra`, sopra il canvas ma trasparente ai clic tranne il suo `✕`. Il `✕` la nasconde; la scelta resta per quel browser (`localStorage`, chiave `modellatore.aiutoCanvasNascosto`); se `localStorage` non è disponibile la riga si nasconde solo fino al ricaricamento.
- **AC-3**: Le porte di interfaccia dei blocchi hanno la classe `porta-interfaccia`. Mentre Shift è premuto (finestra con il fuoco) il cursore su una porta è `move`; senza Shift resta quello di oggi (`crosshair`, per tirare un filo). Lasciare Shift o perdere il fuoco della finestra riporta il cursore normale. Il suggerimento del pin resta `[Shift+trascina per spostare la porta]`.

## Decision

**Chosen option**: punto del canvas senza aggancio esportato dal renderer e usato dal rilascio; riga di aiuto statica in `index.html` con il `✕`; classe sul `body` mentre Shift è premuto.

**Decisioni di dettaglio**:
- `puntoCanvas(e)` in `renderer.js` restituisce il punto senza aggancio; `getCanvasCoords(e)` lo usa e aggancia. Il rilascio in `app.js` usa `puntoCanvas()`. Scartato: centrare con `getCanvasCoords()` (aggancia due volte e sposta di mezza cella).
- Shift: `keydown`/`keyup` su `window` aggiungono o tolgono `shift-premuto` al `body`; `blur` la toglie. CSS `.shift-premuto .porta-interfaccia { cursor: move; }`. Scartato: un pulsante "modalità sposta porte" (un modo in più da ricordare).
- Riga di aiuto: elemento in `index.html` dentro `.canvas-container`, posizione assoluta, `pointer-events: none` sul testo e `auto` sul `✕`; lettura e scrittura di `localStorage` dentro `try/catch`.

**Implementation skills**: none.

## Feature design

**Data model sketch**: nessun dato nel modello; una chiave per browser in `localStorage`.

**API surface**: `puntoCanvas(e)` (`renderer.js`, nuova, esportata); `getCanvasCoords(e)` invariata nel risultato.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Rilascio | P | `puntoCanvas(e)`: `(clientX − rect.left − zoomState.x) / zoomState.scale` e lo stesso per y |
| Rilascio | dimensione, griglia | `appSettings.node.width/height`, `appSettings.grid.size` |
| Aiuto | nascosto | `localStorage['modellatore.aiutoCanvasNascosto'] === '1'` |
| Cursore | Shift | `KeyboardEvent.shiftKey` / `key === 'Shift'` |

**Key invariants**: il rilascio non dipende più dalla vista; la riga di aiuto non intercetta clic sul canvas.

**Security model**: nessun dato dell'utente coinvolto.

**Configuration required**: nessuna.

**Critical test scenarios**:
- Zoom 2 e pan spostato: rilascio in un punto, il nodo contiene il punto ed è sulla griglia; lo stesso a zoom 0,5. Verifica **AC-1**.
- Riga di aiuto visibile, clic attraverso il testo sul canvas funziona, `✕` la nasconde, ricarica: resta nascosta. Verifica **AC-2**.
- Shift premuto sopra una porta: cursore `move`; rilasciato: `crosshair`. Verifica **AC-3**.

## Build plan

1. `puntoCanvas()` e rilascio centrato. Satisfies **AC-1**.
2. Riga di aiuto con `✕` e `localStorage`. Satisfies **AC-2**.
3. Classe delle porte e cursore con Shift. Satisfies **AC-3**.

## Consequences

**Positive**: il rilascio è prevedibile; i gesti nascosti sono scritti sul canvas.
**Negative / tradeoffs**: la riga di aiuto occupa una striscia del canvas finché non la chiudi; il cursore `move` appare solo dopo aver premuto Shift, quindi chi non legge la riga continua a non scoprirlo.
**Neutral**: la nota "drop ignora zoom e pan" in `js/AGENTS.md` va tolta.

## Rationale

Opzioni e motivi: il rilascio centrato è il comportamento atteso da ogni editor a blocchi; la riga di aiuto è la soluzione più semplice e sempre visibile per gesti senza pulsanti, e il cursore con Shift conferma il gesto nel momento in cui serve. Spec scritta in modalità autonoma su richiesta dell'utente (opzione raccomandata a ogni scelta).
