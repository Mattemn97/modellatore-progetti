# Verify: console del server più leggibile · spec 0014 · updated 2026-10-02
_Steps derived from spec 0014 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [x] Rendering con profilo di terminale ANSI (console `rich` con `force_terminal`, `legacy_windows=False`): riquadro `Modellatore MBSE`, cinque etichette nell'ordine, link OSC 8 in `bold cyan`, riga `Chiudi questa finestra…` → AC-1
- [x] Stesso rendering a 60 colonne e a 40 colonne: URL ed etichette intere; a 40 colonne righe libere senza riquadro → AC-2
- [x] `start.py` con `rich` bloccato (`sys.modules['rich'] = None`): righe di `=`, ` Modellatore MBSE`, cinque righe, server che risponde → AC-3
- [x] `start.py` con uscita su pipe (80 e 40 colonne) e con `NO_COLOR=1`: nessun `\x1b[`, tutte le informazioni, URL su una riga → AC-4
- [x] `VERSIONE.txt` = `1.2.3`, vuoto, assente: `1.2.3`, `sviluppo`, `sviluppo` → AC-5
- [x] Info attenuata, avviso giallo `Attenzione:`, errore rosso `Errore:` (profilo ANSI); copia di `settings.json` che fallisce: `Errore: Impossibile creare settings.json: …` con e senza `rich`; `stampa_avviso` chiamata prima di `main()` → AC-6
- [x] Richieste a `/index.html`, `/js/app.js`, `/settings.json` (200), `/non-esiste.js`, `/favicon.ico`, `/progetti/x.json` (404): solo `GET /non-esiste.js → 404` e `GET /progetti/x.json → 404`, una riga ciascuna → AC-7
- [x] `crea-pacchetto.ps1` con `requirements.txt` installato, poi lo stesso script della prova di avvio del workflow sullo `start.exe` vero: risponde, uscita con il link e il bordo `│` → AC-8
- [x] Exe di prova (porta 8099) in una console nuova, buffer letto con `ReadConsoleOutputCharacterW`: riquadro con angoli arrotondati, URL con attributo di colore `0xb` (ciano chiaro) → AC-8

## Value sourcing
- [x] Versione da `VERSIONE.txt` della cartella dell'app (pacchetto: `9.9.9-prova` scritto da `crea-pacchetto.ps1`) → Value sourcing "versione"
- [x] Cartella dell'app, progetti e librerie: percorsi della cartella dell'exe, non della cartella di lavoro → Value sourcing "cartelle"

## Acceptance-criteria coverage
- AC-1 profilo ANSI e console vera · AC-2 larghezze 80, 60, 40 · AC-3 senza rich · AC-4 pipe e NO_COLOR · AC-5 versione · AC-6 messaggi · AC-7 log · AC-8 pacchetto e exe
