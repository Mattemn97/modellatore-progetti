# Verify: Filtri avanzati · spec 0008 · updated 2026-10-02
_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Modello di prova: Centralina (Elettrica/Controllo; `CEN_001` Capacità SSS, `CEN_003` Elettrica IRS), Pompa (Fluidica/Idraulica; `PMP_001` Elettrica IRS), Valvola senza categoria (`VAL_001` Capacità SSS). Radice: Centralina A (dentro Pompa B, filo `CEN_003` → `PMP_001`), Pompa A, Valvola; requisito cliente `1` (Capacità) sul canvas con filo verso `CEN_001`; filo `CEN_003` → `PMP_001` tra Centralina A e Pompa A con uno snodo.

## UI / manual
- [x] La barra non ha più "Filtra Tipologia" né "Nascondi Non Coinvolti"; c'è `🔎 Filtri` con `aria-pressed="false"` → AC-1
- [x] Senza filtri: tre blocchi, due fili, nessun elemento attenuato → AC-4
- [x] Voci: Classe `Capacità, Elettrica, Segnale, Meccanica, Fluidica`; Documento settings poi `Cliente`; Categoria `Elettrica, Fluidica, (senza categoria)`; Sottocategoria `Controllo, Idraulica, (senza sottocategoria)` → AC-2
- [x] Documento IRS → `🔎 Filtri (1)`, Valvola attenuata, pin `CEN_001` e `VAL_001` attenuati, blocco tondo `1` attenuato, filo `1` → `CEN_001` attenuato, filo `CEN_003` → `PMP_001` pieno; riepilogo `In questo livello: 1 blocchi e 1 fili esclusi` → AC-3, AC-4, AC-5, AC-8
- [x] Più Categoria Fluidica → `🔎 Filtri (2)`, Centralina A attenuata con tutti i pin, il filo verso la Pompa resta pieno; riepilogo `2 blocchi e 1 fili` → AC-4, AC-5
- [x] `Nascondi` → la Valvola e il filo escluso spariscono, il blocco tondo `1` sparisce, Centralina A resta attenuata perché estremo del filo incluso → AC-6
- [x] Classe Capacità con `Attenua` → il filo Elettrica e il suo snodo attenuati → AC-11
- [x] Clic fuori dal pannello → si chiude → AC-1
- [x] Dentro Centralina A (IRS + Fluidica, Nascondi) → Pompa B piena, blocco tondo `CEN_003` (i filtri di blocco non valgono per il blocco in cui sei), `CEN_001` nascosto; Indietro → filtri uguali → AC-5, AC-9
- [x] `Azzera filtri` → nessuna voce scelta, `Nascondi` resta, `Nessun filtro attivo` → AC-2, AC-8
- [x] Gerarchia su `1` con Classe Elettrica e Nascondi → la catena `1` → `CEN_001` disegnata piena, il resto fuori catena; nessuna classe del filtro → AC-7, AC-11
- [x] Coerenza con Classe Elettrica → avviso `Filtro attivo: Elettrica` → AC-7
- [x] Libreria che cambia (Pompa da Fluidica a Idraulica2) con Fluidica scelta → la scelta sparisce, le voci si aggiornano → AC-9
- [x] Annulla e Ripeti con un filtro attivo → i filtri restano → AC-9
- [x] Dopo tutte le azioni sui filtri il file del progetto e `_versioni/` non cambiano; nessun errore in console → AC-9

## Value sourcing
- [x] Voci Documento da `settings.documenti` e testi della libreria, poi `Cliente`; Categoria e Sottocategoria dalla libreria con `(senza …)` per i vuoti → AC-2
- [x] Documento `Cliente` dei requisiti cliente: il blocco tondo `1` non passa IRS → AC-3

## Acceptance-criteria coverage
- AC-1 … pulsante, pannello, clic fuori · AC-2 … voci, Azzera · AC-3 … regola requisito · AC-4 … regola blocco · AC-5 … pin, tondi, fili · AC-6 … Attenua e Nascondi · AC-7 … Gerarchia e Coerenza · AC-8 … riepilogo · AC-9 … livelli, Annulla, libreria, nessun salvataggio · AC-10 … estremi senza requisito (per costruzione: nessuna chiave) · AC-11 … snodi e catena
