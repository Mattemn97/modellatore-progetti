# Verify: protezione dei dati negli aggiornamenti · spec 0013 · updated 2026-10-02
_Steps derived from spec 0013 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [ ] Crea il pacchetto con `packaging/crea-pacchetto.ps1` e apri lo zip: niente `settings.json`, `settings.predefinite.json` con lo stesso SHA256 di `settings.json` del repository, `progetti/` e `shared/` vuote → AC-1
- [ ] Copia di prova del repository con `PERCORSI_UTENTE` che include anche `index.html`, poi `crea-pacchetto.ps1 -SaltaBuild`: lo script si ferma con "Il pacchetto contiene index.html" → AC-1, AC-6
- [ ] Copia di prova con `PERCORSI_UTENTE` tolto da `start.py`: lo script si ferma con "PERCORSI_UTENTE non trovato" → AC-1
- [ ] Cartella con solo `settings.predefinite.json`, avvio di `start.py`: `settings.json` creato con lo stesso SHA256 e riga `Impostazioni create da settings.predefinite.json` in console → AC-2
- [ ] Cartella senza nessuno dei due file: avvio normale, nessun `settings.json` creato, l'app si apre con i valori predefiniti → AC-2
- [ ] `settings.json` modificato e poi `settings.json` non valido: dopo l'avvio stesso SHA256 di prima, nessuna riga di creazione → AC-3
- [ ] Installazione piena di dati (zip estratto, `settings.json` con un colore cambiato, progetto con `_versioni/` e `_cestino/`, libreria con `.changelog.json` e `shared/_versioni/`), SHA256 di `settings.json`, `progetti/**`, `shared/**`; `Expand-Archive -Force` dello zip nuovo sopra; avvio: SHA256 identici → AC-4
- [ ] `settings.json` senza la sezione `matrice`: nel browser `appSettings.matrice.gruppiVisibili` vale 300 → AC-5
- [ ] `start.py` contiene `PERCORSI_UTENTE = ('progetti', 'shared', 'settings.json')` con il commento sulla regola → AC-6
- [ ] `TUTORIAL.md` del pacchetto: niente "salvane una copia", spiega `settings.predefinite.json`, `esempi\` sovrascritta, backup; tabella con `settings.predefinite.json` → AC-7
- [ ] `rilascio.yml`: dopo il controllo HTTP 200 confronta `Get-FileHash` di `settings.json` e `settings.predefinite.json` → AC-8

## UI / manual
- [ ] Installazione aggiornata con un colore di tipologia cambiato: il colore personalizzato si vede sul canvas → AC-4

## Value sourcing
- [ ] Cartella base: avvio di `start.py` da un'altra cartella di lavoro, `settings.json` creato accanto a `start.py` e non nella cartella di lavoro → Value sourcing "cartella base"

## Acceptance-criteria coverage
- AC-1 zip e controllo · AC-2 creazione · AC-3 nessuna scrittura · AC-4 aggiornamento sopra dati · AC-5 chiavi mancanti · AC-6 costante · AC-7 tutorial · AC-8 workflow
