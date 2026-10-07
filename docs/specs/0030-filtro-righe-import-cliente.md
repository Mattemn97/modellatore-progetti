# 0030. Filtro delle righe nell'import cliente

**Date**: 2026-10-07
**Status**: Done

## Summary

La finestra di import dei requisiti cliente (spec 0003) ha un filtro in più: una colonna e un testo. Diventano requisiti cliente solo le righe in cui quella colonna contiene quel testo (per esempio colonna "Tipo" contiene "Requirement"). Le altre righe (titoli, note, intestazioni di capitolo) restano fuori e non contano come scartate.

## Context

Oggi `estraiRighe()` prende ogni riga non vuota sotto l'intestazione e `validaRighe()` scarta solo quelle senza ID o senza testo. I file dei clienti mescolano requisiti, titoli di capitolo e note con un ID e un testo: entrano tutti come requisiti. Voce 57 dello scope ([feedback-utenti.md](../scope/feedback-utenti.md)).

## Requirements

**Acceptance criteria**:
- **AC-1**: Sotto le colonne, la riga `Filtro righe` ha un menu `Colonna` (prima voce `(nessun filtro)`, poi le colonne del foglio come negli altri menu) e un campo `contiene`. Il filtro vale quando c'è una colonna e il testo non è vuoto; altrimenti l'import funziona come oggi.
- **AC-2**: Una riga passa se la sua cella nella colonna scelta contiene il testo, senza distinguere maiuscole e minuscole e senza spazi in testa e in coda. Più valori separati da `;` valgono in alternativa (`Requirement; Req` passa le righe che ne contengono almeno uno). Le righe del tutto vuote restano ignorate e non contano.
- **AC-3**: L'anteprima mostra, quando il filtro vale, `N righe passano il filtro, M escluse` e il conteggio `esclusi`; la scheda `Esclusi (M)` elenca riga, ID e valore della colonna filtro (al massimo `cliente.righeAnteprima` righe). Le righe escluse non arrivano a `validaRighe()`: non sono scartate, non sono nuove, e con `Sostituisci` un requisito già importato che ora è escluso diventa ritirato come chi manca nel file.
- **AC-4**: Confermando, `ultimoImport.filtro = { colonna: { nome, lettera } | null, testo }` (`null` senza filtro) e `ultimoImport.conteggi.esclusi`. Il prossimo import ripropone colonna (per nome se unico, altrimenti per lettera, come le altre) e testo. Un progetto della 2.1.0 (senza `filtro`) apre la finestra senza filtro.
- **AC-5**: Campi nuovi con l'aiuto (i): `import.filtro.colonna`, `import.filtro.testo`.

## Decision

- **Filtro dentro l'estrazione**: `estraiRighe(foglio, riga, colonne, filtro?)` restituisce `{ righe, escluse }`; la regola è la funzione pura `passaFiltro(cella, testo)`. Così validazione, confronto e conteggi restano quelli di oggi e lavorano solo sulle righe che passano. Scartato: un filtro dopo `validaRighe()` (le righe escluse comparirebbero fra gli scartati per ID vuoto).
- **"Contiene", con alternative**: è il caso dei file reali (colonna Tipo con `Requirement`, `Req.`, `REQ`); un'uguaglianza esatta o un'espressione regolare sarebbero più fragili o più difficili da spiegare. Il `;` copre le varianti senza aggiungere un secondo filtro.
- **Salvato in `ultimoImport`**: come le colonne, con lo stesso riferimento `{ nome, lettera }`. Chiave facoltativa: nessun cambio di `formatVersion`.

## Build plan

1. `passaFiltro()` ed `estraiRighe()` con il filtro, test unitari.
2. Riga del filtro nella finestra, conteggio, scheda Esclusi, `ultimoImport.filtro`, testi di aiuto.
3. E2e: CSV con righe di titolo, filtro su una colonna, solo i requisiti importati e il filtro riproposto al secondo import.

## Consequences

- Positivo: gli import dei file veri non portano dentro titoli e note; il filtro si imposta una volta per progetto.
- Negativo: il filtro guarda una sola colonna; due condizioni su colonne diverse restano fuori (si aggiunge solo se qualcuno lo chiede).
