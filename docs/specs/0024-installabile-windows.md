# 0024. Installabile Windows per utente

**Date**: 2026-10-05
**Status**: Accepted

## Summary

Il programma si distribuisce come un setup `.exe` costruito da electron-builder (installer NSIS "one click"), che installa per il solo utente in `%LOCALAPPDATA%\Programs\` senza permessi di amministratore, crea i collegamenti nel menu Start e sul desktop e si disinstalla da Impostazioni di Windows. I dati (cartelle di lavoro e `userData`) restano fuori dalla cartella del programma, quindi disinstallare e reinstallare non li tocca. La stessa scelta prepara la voce 29: electron-builder pubblica `latest.yml` con l'impronta SHA512 che `electron-updater` controlla.

## Requirements

**Acceptance criteria**:
- **AC-1**: `npm run dist` produce in `release/` `Modellatore-MBSE-Setup-<versione>.exe` (x64) e `latest.yml`; il pacchetto contiene solo `out/` senza sourcemap, `settings.json` e `package.json` (niente `src/`, test, Python o dati).
- **AC-2**: Il setup installa per l'utente corrente senza richiesta UAC (`perMachine: false`, livello di esecuzione `user`), in `%LOCALAPPDATA%\Programs\modellatore-mbse\`, crea i collegamenti "Modellatore MBSE" nel menu Start e sul desktop e registra la disinstallazione in Impostazioni di Windows › App.
- **AC-3**: Il programma installato parte e funziona come in sviluppo: interfaccia da `app://`, `settings.json` predefinito letto dal pacchetto, cartelle di lavoro da `configurazione.json` in `userData`.
- **AC-4**: La disinstallazione toglie il programma e i collegamenti ma non `userData` (`deleteAppDataOnUninstall: false`) né le cartelle di lavoro; reinstallando, l'app ritrova configurazione, progetti, librerie e layout.
- **AC-5**: La CI su `develop` costruisce il setup, lo installa in silenzio sul runner Windows, controlla che il programma installato parta e che dopo la disinstallazione `userData` sia ancora lì. Gira solo sui push a `develop` (non sui branch `feat/**`) per non appesantire ogni push.

## Decision

**Chosen option**: electron-builder 26 con target `nsis` one click per utente.

**Opzioni considerate**:
- **electron-builder + NSIS (scelta)**: per utente senza UAC, collegamenti e disinstallazione pronti, `latest.yml` con SHA512 per l'aggiornamento della voce 29 (`electron-updater`, anche verso un server finto con il provider `generic`).
- **Electron Forge + Squirrel.Windows**: anch'esso per utente, ma l'installazione è un `Update.exe` con cartelle versione, poco controllabile e più scomodo da provare contro un server finto.
- **MSI (WiX)**: pensato per l'installazione per macchina e le policy aziendali; per utente è scomodo e chiede strumenti in più.

**Decisioni di dettaglio**:
- Configurazione nel campo `build` di `package.json`; `appId` `io.github.mattemn97.modellatore-mbse`, `productName` "Modellatore MBSE" (già il nome di `userData`), uscita in `release/` (già in `.gitignore`).
- `dockview-core` passa nelle `devDependencies`: è già dentro il bundle `app.js`, il pacchetto non deve portarsi `node_modules`.
- Il file di requisiti del tutorial (`packaging/esempi`) va in `resources/esempi` dell'installazione (`extraResources`).
- Icona: quella predefinita di Electron finché non ne esiste una del progetto (Follow-up).
- Firma del codice: fuori da questa voce (nel Deferred dello scope), quindi SmartScreen avvisa al primo download.
- Prova in CI con lo stesso eseguibile: installazione `/S`, avvio del `.exe` installato con Playwright (`_electron.launch` con `executablePath`) e le variabili dei test per le cartelle, disinstallazione `/S` dal `Uninstall Modellatore MBSE.exe`.

## Build plan

1. electron-builder e configurazione `build`, script `dist`, `dockview-core` tra le dipendenze di sviluppo; satisfies **AC-1**, **AC-2**, **AC-4**
2. Prova locale: setup costruito, programma impacchettato (`release/win-unpacked`) avviato con Playwright; satisfies **AC-3**
3. Job `setup` nella CI (solo push a `develop`): costruisce, installa, avvia, disinstalla, controlla `userData`; satisfies **AC-5**

## Consequences

**Positive**: installazione senza amministratore e senza toccare i dati; base per l'aggiornamento automatico.
**Negative**: setup non firmato (avviso SmartScreen); un job CI in più di qualche minuto sui push a `develop`.

## Follow-up

- [ ] Icona del programma (`build/icon.ico` per electron-builder)
