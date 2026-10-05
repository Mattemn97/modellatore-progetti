# 0025. Aggiornamento automatico della versione desktop

**Date**: 2026-10-05
**Status**: Accepted

## Summary

All'avvio il programma installato guarda l'ultima Release di GitHub con `electron-updater`: se c'è una versione più recente mostra il banner di oggi con le novità; con "Aggiorna e riavvia" scarica il nuovo setup, ne controlla l'impronta SHA512 scritta in `latest.yml`, lo installa in silenzio e riparte. I dati non stanno nella cartella del programma, quindi restano intatti. La pagina non cambia: il processo principale risponde con lo stesso contratto `/api/aggiornamento` della 1.x (spec 0015).

## Requirements

**Acceptance criteria**:
- **AC-1**: Nel programma installato, con una Release più recente (tag `v<versione>` con `latest.yml` e il setup), il banner dice "È disponibile la versione X (hai la Y)", con **Novità** (il testo della Release, mai HTML) e **Più tardi**.
- **AC-2**: **Aggiorna e riavvia** chiede conferma, salva il progetto, scarica il setup, ne verifica lo SHA512, lo installa in silenzio (`quitAndInstall(true, true)`) e riapre il programma sulla versione nuova; progetti, librerie, impostazioni e layout restano.
- **AC-3**: Senza rete o con GitHub che non risponde al controllo, l'app parte come sempre e non mostra niente. Un download interrotto o un file che non corrisponde all'impronta mostra "Aggiornamento non riuscito" con il motivo, e l'app resta sulla versione di prima (Riprova ricomincia).
- **AC-4**: In sviluppo (`npm run dev`, programma non impacchettato) il controllo è spento; `aggiornamenti.controllo: false` in `settings.json` lo spegne anche nel programma installato; `aggiornamenti.repository` sceglie il repository delle Release.
- **AC-5**: Si prova contro un server di Release finto con `MODELLATORE_URL_RELEASE` (provider `generic` di electron-updater), come la 1.x.

## Decision

**Chosen option**: `electron-updater` (stesso progetto di electron-builder, spec 0024) dietro un servizio `ServizioAggiornamento` in `src/main/aggiornamento.ts`, con l'aggiornatore iniettato.

**Opzioni considerate**:
- **electron-updater (scelta)**: legge `latest.yml`, verifica SHA512, installa l'NSIS per utente in silenzio e riapre; provider `github` per le Release e `generic` per un server finto.
- **Porting del codice della 1.x** (API di GitHub, digest SHA256, sostituzione dei file): pensato per uno zip estratto, non per un setup; andrebbe riscritto quasi tutto.
- **Electron `autoUpdater` nativo (Squirrel)**: richiede l'installer Squirrel, escluso nella spec 0024.

**Decisioni di dettaglio**:
- Contratto `/api/aggiornamento` invariato: stati `disattivato`, `controllo`, `nessuno`, `disponibile`, `download`, `installazione`, `riavvio`, `errore`; `POST /installa` con `{ versione }` risponde 202, oppure 409 `non_disponibile` / `versione_cambiata`. Il banner di `src/renderer/aggiornamento.ts` resta com'è (cambia solo il messaggio di riavvio muto).
- `autoDownload` e `autoInstallOnAppQuit` spenti: si scarica solo su richiesta, si installa solo con il riavvio esplicito.
- Errori del controllo: silenziosi (scritti con `console.warn` nel processo principale); errori del download: banner. Un errore con `sha512`/`checksum` nel messaggio ha un testo dedicato.
- `MODELLATORE_URL_RELEASE`: provider `generic` più un `app-update.yml` scritto nella cartella temporanea (fuori dal pacchetto electron-updater non lo trova) e `forceDevUpdateConfig`.
- `package.json` `build.publish` punta a GitHub, così `app-update.yml` nel pacchetto è esplicito; il caricamento sulla Release lo fa il workflow della voce 30 (`--publish never` in locale).
- Il bundle ESM del processo principale ha in testa un `require` creato con `createRequire`, perché electron-updater è CommonJS e chiede `require('electron')`.

## Build plan

1. Servizio con aggiornatore iniettato, router sul servizio, impostazioni `aggiornamenti`; satisfies **AC-1**, **AC-3**, **AC-4**
2. electron-updater nel processo principale (GitHub o server finto), `build.publish`; satisfies **AC-2**, **AC-5**
3. Test: unitario della macchina a stati (aggiornatore finto), e2e con server finto (avviso, novità, impronta sbagliata che non installa); satisfies **AC-1**, **AC-3**, **AC-5**

## Consequences

**Positive**: aggiornamento con un clic, verificato, senza amministratore e senza toccare i dati.
**Negative**: l'installazione vera e il riavvio sulla versione nuova non hanno un test automatico (servirebbero due setup e un'installazione sul runner); sono delegati a electron-updater e da provare a mano alla prima Release 2.x successiva alla 2.0.0.
**Neutral**: finché l'ultima Release di GitHub è una 1.x senza `latest.yml`, il controllo fallisce in silenzio.
