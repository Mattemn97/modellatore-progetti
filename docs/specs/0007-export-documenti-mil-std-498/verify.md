# Verify: Export documenti MIL-STD-498 · spec 0007 · updated 2026-10-02
_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Modello di prova consigliato: requisiti cliente `1` (attivo) e `3` (ritirato, Segnale); libreria con Centralina (descrizione "Unità di controllo"; `CEN_001` Capacità, Test, due testi SSS e uno IRS; `CEN_003` Elettrica, Analisi, testi ` SSS ` e SSDD, titolo con `|` e un a capo; `CEN_004` Capacità senza metodo, testi SSS, uno vuoto SSS e `XYZ`; `CEN_005` Segnale, metodo `Simulazione`, testi SSS e SSDD), Pompa (`PMP_001` Elettrica, Test, testo IRS; `PMP_002` Capacità, Ispezione, testo SSDD) e un blocco Inutile mai usato con un testo SSS. Alla radice Centralina A con dentro Pompa A; fili `1` → `CEN_001`, `3` → `CEN_005`, `CEN_003` → `PMP_001` dentro Centralina A.

## UI / manual
- [ ] Clic su `📄 Documenti` → si apre la finestra con selettore, riepilogo, anteprima e `⬇ Esporta .md`; Esc non la chiude, `✕` sì → AC-1
- [ ] Apri, cambia documento, scarica e chiudi → il file in `progetti/` e `_versioni/` non cambiano; Coerenza e Gerarchia restano come erano; a finestra aperta Ctrl+Z non agisce e Esc non toglie la scelta della Gerarchia → AC-1
- [ ] Libreria vuota → solo "Libreria non caricata: i documenti si generano quando la carichi", export disattivato → AC-1
- [ ] Selettore: SSS, SSDD, IRS, IDD, SRS, SDD, poi `XYZ`; nessun `Tutti` né `Cliente` → AC-2
- [ ] Scegli IRS, chiudi e riapri → IRS è ancora scelto → AC-2
- [ ] SSS: `CEN_001` in 3.2.1 con i due testi; `CEN_004` in 3.2.2 con il solo testo non vuoto; il testo ` SSS ` di `CEN_003` entra; `INU_001` non entra → AC-3
- [ ] Intestazione `# SSS · Specifica del sistema/sottosistema · <nome>`, riga Data e Libreria con versione, 1.1 con la frase di identificazione, 1.2 `Panoramica del sistema`, capitolo 2 con `- Cliente` → AC-4
- [ ] SSS ha 3.1 … 3.18 con i titoli della spec e `_Da completare._` dove fisso; SRS ha "del CSCI", "Fattori di qualità del software", "Vincoli di progetto e implementazione" → AC-5
- [ ] IRS: 3.1 tabella interfacce (`Elettrica | 1 | Pompa`), 3.2 Interfaccia Elettrica con 3.2.1 `PMP_001`, 3.3 Altri requisiti con 3.3.1 `CEN_001`, 3.4 Precedenza; capitolo 2 elenca Cliente, SSS, SSDD → AC-5, AC-6
- [ ] IDD senza requisiti → 3.1 con "Nessun requisito in questo documento.", Tracciabilità al 4, Note al 5 con 5.1 → AC-5, AC-10
- [ ] SSS 3.3.1: tabella con Elettrica e Segnale, `_Diagrammi da completare._`; 3.3.2 Interfaccia Elettrica, 3.3.3 Interfaccia Segnale → AC-6
- [ ] SSDD 4.1: tabella `Pompa | Fluidica | 1`, 4.1.1 Pompa con 4.1.1.1 `PMP_002`; interfacce in 4.3; SDD ha 5 Progetto di dettaglio del CSCI e Note al 7 → AC-7, AC-5
- [ ] Qualifica SSS: colonne Ispezione, Analisi, Dimostrazione, Test; X nella colonna giusta; `CEN_004` "Metodo non definito"; `CEN_005` "Metodo: Simulazione"; Sezione come i numeri dei sottocapitoli → AC-8
- [ ] Tracciabilità SSS: `CEN_001` padre `1 Req cliente`, documenti `Cliente`; `CEN_005` padre `3 …`, Note "Senza padre; Padre ritirato: 3"; `CEN_004` `—` e "Senza padre"; in IRS `PMP_001` ha documenti padre `SSS, SSDD` → AC-9
- [ ] Ultima riga del file: "Generato dal Modellatore di requisiti il <data>. …" → AC-10
- [ ] Sottocapitolo di un requisito: titolo `<numero> <ID> · <titolo>`, testi, poi Metodo di verifica, Blocco, Deriva da; il titolo con `|` e a capo resta su una riga; nelle tabelle `|` diventa `\|` → AC-11
- [ ] Riepilogo SSS: `Requisiti: 4 (capacità 2, interfacce 2) · Testi: 5 · Senza metodo: 1 · Senza padre: 3 · Non usati nel progetto: 1` → AC-12
- [ ] IDD (vuoto) → messaggio "Nessun requisito ha testi per IDD: il file avrà solo i capitoli." e l'export resta attivo → AC-12, AC-13
- [ ] `⬇ Esporta .md` con SSS → file `<slug>-sss.md` identico all'anteprima → AC-13
- [ ] Progetto con 3000 requisiti cliente e 200 blocchi → apertura e cambio documento sotto il secondo; anteprima troncata con la riga "… anteprima troncata: il file scaricato contiene tutto il documento", file completo → AC-14, AC-12

## Value sourcing
- [ ] Rinomina un requisito, cambia un suo metodo e un suo testo, riapri la finestra → ID, metodo e testo nuovi (calcolo all'apertura) → AC-1, AC-3
- [ ] Togli `Elettrica` da `typeColors` in `settings.json` e ricarica → Interfaccia Elettrica va dopo quelle note, in ordine alfabetico → AC-6
- [ ] Aggiungi `Simulazione` a `metodiVerifica` → compare la colonna e sparisce la nota "Metodo: Simulazione" → AC-8
- [ ] Apri senza progetto → nome dal breadcrumb della radice; con un progetto → `infoProgetto().nome` e slug del file → AC-4, AC-13
- [ ] Riduci `documentiExport.anteprimaCaratteri` a 1000 → l'anteprima si tronca a 1000 caratteri → AC-12

## Commands
- [ ] Matrice: `📊 Matrice Requisiti` → esporta ancora come prima (data, tabelle) dopo lo spostamento di `dataOggi()` → regressione spec 0006

## Acceptance-criteria coverage
- AC-1 … finestra, libreria vuota, nessuna scrittura · AC-2 … selettore e scelta ricordata · AC-3 … chi entra e testi · AC-4 … intestazione, 1 e 2 · AC-5 … capitolazioni · AC-6 … interfacce · AC-7 … componenti · AC-8 … qualifica · AC-9 … tracciabilità · AC-10 … note · AC-11 … sottocapitolo e escape · AC-12 … riepilogo e troncamento · AC-13 … export · AC-14 … volumi
