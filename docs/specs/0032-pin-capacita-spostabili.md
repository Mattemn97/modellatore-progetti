# 0032. Pin di capacità spostabili

**Date**: 2026-10-07
**Status**: Done

## Summary

I quadratini dei requisiti di capacità dentro il rettangolo di un blocco si spostano con Shift+trascina, come le porte di interfaccia sul bordo (spec 0011). La posizione è agganciata alla griglia e salvata per istanza; il comando `↺ Riposiziona i pin` dell'Ispettore torna alla disposizione automatica. Canvas e immagini dei diagrammi (spec 0029) usano la stessa funzione di posizione.

## Context

Oggi `posizioneCapacita()` (`diagramma.ts`) mette i pin di capacità in fila lungo il bordo inferiore interno, in ordine di libreria: chi modella non può orientarli verso i blocchi a cui vanno, e i fili si incrociano. Voce 59 dello scope ([feedback-utenti.md](../scope/feedback-utenti.md)); la voce 60 (instradamento dei fili) parte da queste posizioni.

## Requirements

**Acceptance criteria**:
- **AC-1**: Shift+trascina su un pin di capacità di un blocco lo sposta dentro il rettangolo, agganciato alla griglia. Senza Shift il pin tira un filo come oggi. Con Shift premuto il cursore è quello di spostamento; il suggerimento del pin dice `[Shift+trascina per spostare il pin]`.
- **AC-2**: La posizione si salva nell'istanza: `node.capabilityPositions[reqId] = { x, y }`, relativa all'angolo in alto a sinistra del blocco. Le altre istanze dello stesso blocco non cambiano.
- **AC-3**: Un pin non esce dal rettangolo: il centro resta ad almeno `requirements.radius + 2` dal bordo. Non si sovrappone a un altro pin di capacità dello stesso blocco: una posizione che lo farebbe viene rifiutata durante il trascinamento (il pin resta all'ultima posizione buona).
- **AC-4**: Ridimensionando il blocco i pin restano dentro: la posizione mostrata è quella salvata riportata dentro il rettangolo (il valore salvato non cambia, così allargando di nuovo il pin torna dov'era). Se due pin finiscono uno sull'altro, quello che arriva dopo nell'ordine della libreria si sposta sulla casella libera più vicina.
- **AC-5**: I pin senza posizione salvata stanno dove li mette oggi la disposizione automatica; se quel posto è occupato da un pin spostato, vanno sulla casella libera più vicina. Un progetto della 2.1.0 (senza `capabilityPositions`) si apre con la disposizione di oggi, identica, e la sola apertura non scrive la chiave.
- **AC-6**: `↺ Riposiziona i pin` nell'Ispettore di un'istanza (sezione `Questa istanza`) toglie `capabilityPositions` dal nodo: un solo passo di Annulla. È disattivato se l'istanza non ha pin spostati.
- **AC-7**: Rinominando un requisito di capacità nella libreria la posizione segue il nuovo id; un requisito che diventa di interfaccia o sparisce perde la posizione (come `pinPositions`, `aggiornaRiferimentiRequisiti()`).
- **AC-8**: Le immagini dei diagrammi (SVG, PNG, figure di Word e PDF) disegnano i pin e i fili nelle stesse posizioni del canvas.

## Decision

- **Chiave nuova `capabilityPositions`**, accanto a `pinPositions` (porte, `{ side, ratio }`): i pin di capacità vivono nell'area del blocco, non su un lato, quindi un punto relativo. Facoltativa: nessun cambio di `formatVersion`, un file 2.1.0 resta valido e la 2.1.0 ignora la chiave.
- **Una funzione pura per tutte le posizioni**: `posizioniCapacita(node, ids, imp)` in `diagramma.ts` restituisce i centri di tutti i pin di un blocco (salvati riportati dentro, poi automatici, con la ricerca della casella libera). La usano `renderNode()`, `getReqCoordinates()` e `svgDiagramma()`: canvas, fili e immagini non possono divergere.
- **Shift+trascina** come le porte di interfaccia: un solo gesto da imparare, e il trascinamento semplice resta "tira un filo".
- Scartato: salvare la posizione in proporzione al blocco (un ridimensionamento sposterebbe i pin sistemati a mano) e spostare i pin di capacità nella libreria (vale per tutte le istanze, mentre l'orientamento dipende dal livello).

## Build plan

1. `posizioniCapacita()` e `limitaDentro()` con test unitari (vecchio progetto identico, dentro il rettangolo, niente sovrapposizioni).
2. Canvas: disegno, trascinamento con Shift, suggerimento e cursore; diagrammi; `aggiornaRiferimentiRequisiti()`.
3. Ispettore: sezione `Questa istanza` con `↺ Riposiziona i pin`, aiuto `ispettore.riposizionaPin`.
4. E2e: Shift+trascina un pin, salvato nel file; Riposiziona lo toglie.

## Consequences

- Positivo: i pin si orientano verso i blocchi collegati e la voce 60 li usa per fili più corti.
- Negativo: un blocco piccolo con molti pin spostati può riempirsi; la ricerca della casella libera tiene comunque i pin separati finché c'è posto.
