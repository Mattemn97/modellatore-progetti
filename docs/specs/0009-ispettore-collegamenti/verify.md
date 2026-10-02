# Verify: Ispettore dei collegamenti · spec 0009 · updated 2026-10-02
_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Modello di prova: requisito cliente `1` (Capacità) sul canvas con derivazione verso `CEN_001` di Centralina A; fili tra Centralina A e Pompa A `CEN_003` → `PMP_001` (Elettrica) e `CEN_004` → `PMP_001` (Segnale con Elettrica, non valido); dentro Centralina A derivazione `CEN_003` → `PMP_001` di Pompa B.

## UI / manual
- [x] Clic sulla derivazione `1` → `CEN_001` → filo evidenziato (uno solo), Relazione derivazione, Padre `1` Cliente con il testo, Figlio `CEN_001` `Centralina A (Centralina)`, Capacità, Test, `[SSS] Testo SSS`, `[?] Senza doc` → AC-1, AC-2, AC-3
- [x] Clic sul filo tra blocchi → `Collegamento tra blocchi`, Da e A, metodo `non definito`, `Nessun testo`, titolo con `<b>` mostrato come testo → AC-2, AC-3
- [x] Filo Segnale con Elettrica → `⚠️ Tipologie diverse: 'Segnale' e 'Elettrica'.` → AC-4
- [x] Pan dello sfondo non toglie la selezione; clic sullo sfondo la toglie e il pannello torna vuoto → AC-1
- [x] Clic su un blocco, su `+ Nuovo Blocco`, sul requisito cliente → selezione tolta, pannello con il loro contenuto → AC-1
- [x] Doppio clic sul filo aggiunge uno snodo → AC-7
- [x] `🗑 Elimina collegamento` con annulla → il filo resta; con conferma → il filo sparisce, pannello vuoto → AC-5
- [x] Annulla dopo l'eliminazione → il filo torna, nessuna selezione → AC-6
- [x] Filo selezionato, Ripeti di un'altra modifica → il dettaglio resta; filo selezionato che sparisce con Ripeti → selezione tolta, pannello vuoto → AC-6
- [x] Dentro Centralina A → Padre `Blocco padre: Centralina A`, Figlio `Pompa B (Pompa)`; Indietro → selezione tolta → AC-3, AC-1
- [x] Con la Gerarchia accesa il clic sul filo lo seleziona → AC-7
- [x] Selezionare e deselezionare non cambia il file del progetto né `_versioni/`; nessun errore in console → AC-7

## Acceptance-criteria coverage
- AC-1 … selezione e deselezioni · AC-2 … relazione e lati · AC-3 … campi · AC-4 … filo non valido · AC-5 … eliminazione · AC-6 … Annulla e Ripeti · AC-7 … doppio clic, Gerarchia, nessun salvataggio
