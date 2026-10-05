# Verify: stack desktop e struttura TypeScript · spec 0016 · updated 2026-10-05
_Passi derivati dai criteri di accettazione della spec 0016. `/check verify` li esegue; `/test` blocca quelli durevoli._

Prove su una copia isolata (cartella temporanea con `package.json`, `out/`, `index.html`, `style.css`, `settings.json`, `js/`, `start.py`, `shared/` e `progetti/` vuote), pilotata con Playwright `_electron`. Togliere `ELECTRON_RUN_AS_NODE` dall'ambiente: il terminale di VS Code lo imposta e fa partire Electron come semplice Node.

## UI / manuale
- [x] Avvio: finestra `Modellatore MBSE`, URL `app://modellatore/index.html`, libreria con il blocco di esempio, tour al primo avvio → AC-1, AC-2
- [x] `fetch('/api/progetti')` e `/api/aggiornamento` rispondono 200 (stato `disattivato`, motivo app desktop) → AC-3
- [x] `/js/%2e%2e/start.py`, `/start.py`, `/progetti/_ultimo.json` danno 404; `/js/app.js` e `/settings.json` 200 → AC-2
- [x] `localStorage` e `sessionStorage` funzionano → AC-2
- [x] Trascinamento di un blocco: il file del progetto su disco ha 1 nodo; Ctrl+Z → 0, Ctrl+Y → 1 → AC-3, AC-8
- [x] Python mancante (`MODELLATORE_PYTHON` inesistente): pagina di errore in italiano con motivo e comando → AC-4
- [x] Chiudendo il programma il processo `start.py --solo-api` termina (2 processi prima, launcher e interprete; 0 dopo) → AC-4
- [x] Secondo avvio: esce in meno di un secondo, resta una finestra → AC-5
- [x] `contextIsolation` true, `nodeIntegration` false, `sandbox` true; barra dei menu nascosta; `window.open('https://…')` non apre finestre → AC-6, AC-8
- [x] Export: `scaricaFileTesto` e `downloadJsonFile` arrivano al gestore download di Electron (finestra Salva con nome) e il file scritto ha il contenuto giusto → AC-7
- [x] `confirm()` mostra il dialogo → AC-8
- [ ] Manuale: con una modifica non salvata (per esempio server fermo), chiudere la finestra chiede "Chiudi comunque / Annulla"; Annulla lascia la finestra aperta → AC-8 (con Playwright collegato il dialogo lo gestisce Playwright)
- [ ] Manuale: un clic su "Apri la pagina della versione" apre il browser di sistema → AC-6

## Comandi
- [x] `npm run build` senza errori → AC-1
- [x] `npm run typecheck` senza errori → AC-9
- [x] `python start.py` invariato senza le opzioni nuove (modifica solo additiva, sintassi controllata) → AC-10

## Copertura dei criteri
- AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10 coperti dai passi sopra · AC-8 coperto tranne il dialogo di chiusura (manuale)
