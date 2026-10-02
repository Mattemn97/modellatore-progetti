# Verify: Gestione completa della libreria · spec 0010 · updated 2026-10-02
_Steps derived from spec 0010 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Modello di prova: libreria con Centralina, Pompa, Valvola, Filtro, Sensore; progetto con Centralina A (dentro Pompa B) e Pompa A.

## UI / manual
- [x] Form di un blocco esistente → `✏️ Rinomina ID` e `🗑 Elimina dalla libreria` presenti; form di un blocco nuovo → assenti → AC-1
- [x] Elimina Pompa (usata due volte) → avviso con `Impianto › Centralina A › Pompa B` e `Impianto › Pompa A`, file della libreria invariato → AC-2
- [x] Elimina Valvola (non usata) → conferma, blocco tolto dal file e dall'albero, pannello vuoto, `Blocco eliminato. Libreria v2.0.0 (major).` → AC-3
- [x] Rinomina con `id con spazi` → messaggio di formato; con `CENTRALINA` → `Un blocco con ID "CENTRALINA" esiste già nella libreria.`; nulla cambia → AC-4
- [x] Rinomina Pompa in `pompa_idraulica` → chiave nello stesso posto, `id` aggiornato, requisiti invariati, due istanze del progetto (una annidata) con il nuovo `type` salvate su disco, form riaperto sul nuovo id, messaggio con 2 istanze e v3.0.0 (major) → AC-5
- [x] Changelog: voce `eliminato` con i requisiti `rimosso`; voce `rinominato` con `idPrecedente`; finestra mostra `pompa_idraulica rinominato (prima pompa)` e il filtro `pompa` la trova → AC-7
- [x] Server: impronta vecchia 409 `conflitto`, id inesistente 404 `non_trovato`, id uguale 400 `id_uguale`, id esistente (maiuscole diverse) 409 `esiste`, id non valido 400 `id_non_valido`, livello sbagliato 400, percorso fuori da shared/ 403 → AC-6
- [x] Libreria cambiata su disco, Elimina Filtro → banner di conflitto, il file non cambia; `Sovrascrivi` → eliminato alla stessa rotta → AC-8
- [x] Libreria aperta da `shared/_versioni/` (sola lettura) → `🗑 Elimina dalla libreria` disattivato, `✏️ Rinomina ID` con `aria-disabled="true"` → AC-1
- [x] Regressione: `🔄 Aggiorna Blocco di Libreria` salva ancora (voce `modificato`) → spec 0002
- [x] Nessun errore in console oltre a quelli provocati apposta dalle chiamate di prova

## Acceptance-criteria coverage
- AC-1 … azioni e sola lettura · AC-2 … blocco usato · AC-3 … eliminazione · AC-4 … id non valido o esistente · AC-5 … rinomina e istanze · AC-6 … errori del server · AC-7 … changelog · AC-8 … conflitto
