# Verify: controllo e aggiornamento automatico · spec 0015 · updated 2026-10-02
_Steps derived from spec 0015 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
_Banco di prova: pacchetti 2.0.0 e 2.0.1 costruiti con `crea-pacchetto.ps1` da una copia con porta 8099; server finto delle Release su 127.0.0.1:8098 tramite `MODELLATORE_URL_RELEASE`; Playwright con Chrome._

## UI / manual
- [x] Exe 2.0.0, Release finta 2.0.1: banner `È disponibile la versione 2.0.1 (hai la 2.0.0).` con Novità, Aggiorna e riavvia, Più tardi; `#bannerProgetto` resta nascosto → AC-5
- [x] Novità: note come testo (`<b>` resta testo) → AC-5
- [x] Aggiorna e riavvia: conferma con il testo previsto, fasi nel banner, pagina ricaricata dalla 2.0.1, banner sparito → AC-6, AC-7, AC-13
- [x] Progetto in conflitto (file cambiato sul disco): avviso di `svuota()`, nessuno scaricamento → AC-6
- [x] Più tardi: banner nascosto anche dopo il ricaricamento della pagina → AC-5
- [x] Suggerimenti `data-aiuto` su tutti i pulsanti del banner → AC-16

## Commands
- [x] `GET /api/aggiornamento`: sette campi, `disponibile`, `installabile: true`, note → AC-1, AC-2, AC-4
- [x] Console del processo vecchio: `Attenzione: È disponibile la versione 2.0.1 (hai la 2.0.0). Apri l'app per aggiornare: …` su una riga → AC-3
- [x] Dopo l'aggiornamento: processo vecchio uscito, `attuale` 2.0.1 e `aggiornato`, file dell'app uguali allo zip 2.0.1, file utente identici → AC-10, AC-11, AC-12
- [x] `_aggiornamento/` rimasta da prima: sparita dopo circa un minuto → AC-14
- [x] `POST` con versione diversa → 409 `versione_diversa`; senza aggiornamento → 409 `aggiornamento_non_disponibile`; da `start.py` → 409 `non_installabile` → AC-7
- [x] Impronta sbagliata: `errore` con il messaggio dell'impronta, nessun file toccato, banner con Riprova → AC-8
- [x] Zip con `../`, con `shared/x.json`, con `settings.json`, senza `start.exe`, con `VERSIONE.txt` 2.0.9, con una voce fuori da `ModellatoreMBSE/`: `errore` con il motivo, nessun file toccato → AC-9
- [x] `style.css` tenuto aperto da un altro processo: `Impossibile sostituire style.css … Ripristinata la versione precedente.`, file identici, versione 2.0.0 ancora in servizio → AC-10
- [x] Zip 2.0.1 con uno `start.exe` che esce subito: ripristino automatico, `attuale` 2.0.0, `errore` `La versione 2.0.1 non è partita: ripristinata la versione precedente.`, file dell'app identici, banner con il motivo → AC-11, AC-12
- [x] Rete assente: riga `Controllo aggiornamenti non riuscito: …`, stato `errore_controllo`, nessun banner, app normale → AC-1, AC-3
- [x] `aggiornamenti.controllo: false` e `repository: "non valido"`: `disattivato` con il motivo, nessuna richiesta → AC-1, AC-15
- [x] `start.py` senza `VERSIONE.txt`: `disattivato`, versione di sviluppo; con `VERSIONE.txt` 1.0.0 contro GitHub vero: trova v1.0.5, `installabile: false` per `start.py` → AC-1, AC-2
- [x] `TUTORIAL.md`: sezione Aggiornamento automatico → AC-16

## Value sourcing
- [x] Versione attuale da `VERSIONE.txt`, repository e controllo da `settings.json`, URL e impronta dallo zip della Release, `sys.frozen` per l'exe → righe del Value sourcing

## Acceptance-criteria coverage
- AC-1 … AC-16 coperti dalle prove sopra (36 controlli automatici più le prove contro GitHub vero)
