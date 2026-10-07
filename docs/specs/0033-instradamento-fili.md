# 0033. Instradamento automatico dei fili

**Date**: 2026-10-07
**Status**: Done

## Summary

Un filo senza punti messi a mano non va più in linea retta da un pin all'altro: l'app lo fa girare intorno ai blocchi e ai blocchi tondi con tratti orizzontali e verticali, e lo ricalcola a ogni disegno (quando sposti un blocco il filo lo segue). Un filo con punti messi a mano resta com'è. `↻ Reinstrada` nel dettaglio del filo, o `↻ Reinstrada` nella barra del canvas per tutto il livello, toglie i punti messi a mano e lascia fare all'app. Le immagini dei diagrammi (spec 0029) usano gli stessi percorsi.

## Context

Oggi un filo è la spezzata `[pin di partenza, ...waypoints, pin di arrivo]`: senza snodi è una retta che passa sotto i blocchi che incontra. Su un livello affollato i fili si confondono con i blocchi e fra loro. Voce 60 dello scope ([feedback-utenti.md](../scope/feedback-utenti.md)); parte dalle posizioni dei pin della spec 0032.

## Requirements

**Acceptance criteria**:
- **AC-1**: Un filo con `waypoints` vuoto si disegna con un percorso ad angoli retti che non attraversa nessun blocco del livello né il riquadro di un blocco tondo (cerchio più le due righe di testo sotto), restando ad almeno un passo di griglia dai loro bordi. Fanno eccezione i due tratti iniziali e finali: un pin di capacità attraversa il proprio blocco per uscirne. Fra i percorsi possibili sceglie quello con meno curve e più corto.
- **AC-2**: L'uscita dal pin: una porta di interfaccia esce perpendicolare al suo lato, il pin di un blocco tondo esce a destra (dov'è il pin), un pin di capacità esce dal lato del suo blocco che porta più vicino all'altro estremo.
- **AC-3**: Il percorso automatico non si salva: si ricalcola a ogni `render()` dalle posizioni di adesso. Spostare un blocco, un pin o un blocco tondo aggiorna i fili; aprire un progetto non lo modifica.
- **AC-4**: Un filo con almeno un punto in `waypoints` si disegna come oggi, retta per retta, con le maniglie degli snodi. Il doppio clic su un filo automatico lo trasforma in un filo a mano con gli angoli del percorso di adesso più il punto cliccato (il disegno non salta); su un filo a mano il punto si inserisce nel tratto più vicino al clic.
- **AC-5**: `↻ Reinstrada` nel dettaglio del collegamento (Ispettore) svuota `waypoints` di quel filo; è disattivato se il filo è già automatico. `↻ Reinstrada` nella barra del canvas chiede conferma (`Togliere i punti messi a mano da N fili di questo livello?`) e li svuota tutti; senza fili a mano dice `Nessun filo con punti messi a mano in questo livello.`. Ogni comando è un passo di Annulla.
- **AC-6**: Trascinare un blocco su un livello affollato (50 blocchi, 100 fili) resta fluido: il calcolo guarda solo i blocchi vicini al filo e tiene in memoria i percorsi che non cambiano. Se non trova un percorso libero fra i blocchi vicini riprova con tutti; se nemmeno così ne trova, disegna un percorso a L.
- **AC-7**: SVG, PNG e figure di Word e PDF mostrano gli stessi percorsi del canvas.

## Decision

- **A\* su una griglia sparsa (griglia di Hanan)**: le coordinate candidate sono quelle dei bordi dei blocchi allargati di un margine, dei due estremi e del bordo della zona di ricerca; un punto o un tratto dentro un blocco allargato è vietato; il costo è la lunghezza più una penalità per ogni curva. Dà percorsi ortogonali puliti con poche curve, senza dipendenze. Scartati: una griglia fitta a passo fisso (troppi nodi su livelli grandi), una libreria di layout (pesante, pensata per riposizionare i blocchi, non solo i fili).
- **Modulo puro `instradamento.ts`** con la cache dei percorsi (chiave: estremi e blocchi vicini). `percorsoFilo()` in `diagramma.ts` sceglie fra snodi a mano e percorso automatico; canvas e diagrammi chiamano solo lei.
- **Calcolato, non salvato**: nessun dato nuovo nel file, i progetti della 2.1.0 e quelli nuovi hanno lo stesso formato; i fili a mano restano compatibili in entrambe le direzioni.
- Limite accettato: due fili possono correre sovrapposti sullo stesso corridoio; si distinguono per colore e al passaggio del mouse.

## Build plan

1. `instradamento.ts` con test unitari (nessun tratto dentro un ostacolo, uscite perpendicolari, ripiego a L, tempo su un livello grande).
2. `percorsoFilo()` in `diagramma.ts`, usata da `renderEdge()` e da `svgDiagramma()`; doppio clic che congela il percorso.
3. `↻ Reinstrada` nel dettaglio del filo e nella barra del canvas, aiuto `coll.reinstrada` e `barra.reinstrada`.
4. E2e: un filo fra due blocchi con un terzo in mezzo gira intorno; Reinstrada toglie gli snodi.

## Consequences

- Positivo: i fili non passano più sotto i blocchi e seguono i blocchi spostati senza lavoro a mano.
- Negativo: fili paralleli possono sovrapporsi in un corridoio; il doppio clic resta il modo per separarli a mano.
