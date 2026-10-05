# 0026. Rilascio 2.0.0 e passaggio dalla 1.x

**Date**: 2026-10-05
**Status**: Accepted

## Summary

Il workflow di rilascio su `main` costruisce, prova e pubblica il setup Windows della versione desktop; il server Python, la ricetta PyInstaller e lo zip della 1.x escono dal repository. La versione la decide `package.json`, perché è la stessa che finisce nel setup e in `latest.yml`. Le 1.x installate non cambiano: trovando la 2.0.0 senza zip mostrano già il pulsante per la pagina della Release, e le note della 2.0.0 spiegano come passare (setup, poi Importa dalla versione 1).

## Requirements

**Acceptance criteria**:
- **AC-1**: Un push su `main` esegue `npm run verifica`, `npm run dist`, la prova del programma impacchettato (`tests/e2e/installato.spec.ts`) e pubblica la Release `v<version>` con setup, `.blockmap`, `latest.yml`, `TUTORIAL.md` (con la versione al posto di `{VERSIONE}`) e il CSV di esempio, segnata come latest.
- **AC-2**: Se `version` non è `x.y.z` o il tag `v<version>` esiste già, il workflow non pubblica niente (lo scrive nel log); l'avvio manuale produce solo l'artifact.
- **AC-3**: Le note sono `packaging/note/<version>.md` se esiste, altrimenti i messaggi dei commit (`.github/scripts/note-rilascio.sh`); quelle della 2.0.0 spiegano novità e passaggio dalla 1.x.
- **AC-4**: Nel repository non restano `start.py`, `start.spec`, `requirements.txt` né `packaging/crea-pacchetto.ps1`; i generatori degli oracoli dei test prendono `start.py` dal tag `v1.0.6` (file locale ignorato da git).
- **AC-5**: Una 1.x installata, con la 2.0.0 come ultima Release, mostra l'avviso "È disponibile la versione 2.0.0", le note con il percorso di passaggio e "Apri la pagina della versione", senza tentare un'installazione.
- **AC-6**: Segreti: nessuno oltre al `GITHUB_TOKEN` dell'esecuzione (`contents: write`); è scritto in README, AGENTS.md e nella guida.

## Decision

**Chosen option**: un solo workflow `rilascio.yml` su `main` per la versione desktop, versione da `package.json`, nessuna patch alla 1.x.

**Decisioni di dettaglio**:
- **Niente 1.0.7 di passaggio**: il codice della 1.0.6 (`controlla_aggiornamenti` in `start.py`) davanti a una Release senza `ModellatoreMBSE-<v>.zip` mette `installabile: false` e offre la pagina della Release; il pulsante Novità mostra il testo della Release. Una patch 1.x avrebbe aggiunto un rilascio pubblico in più per dire la stessa cosa che dicono le note.
- **Versione da `package.json`** invece di "ultimo tag più uno": il numero dentro il setup e in `latest.yml` viene da lì, e un numero calcolato nel workflow potrebbe divergere da quello che l'aggiornamento automatico confronta.
- **Verifica completa prima di pubblicare**: lo stesso `npm run verifica` della CI, così una Release non parte mai da un `main` rotto.
- **Prova del programma impacchettato** (`release/win-unpacked`), non dell'installazione: l'installazione silenziosa è già provata dal job `setup` della CI su `develop`.

## Build plan

1. Rimozione del server Python e dello zip, generatori degli oracoli sul tag `v1.0.6`; satisfies **AC-4**
2. `rilascio.yml` nuovo, `version` 2.0.0, note `packaging/note/2.0.0.md`; satisfies **AC-1**, **AC-2**, **AC-3**
3. README, AGENTS.md e guida senza la 1.x, con i segreti; satisfies **AC-6**
4. Merge di `develop` in `main` e controllo della Release pubblicata; satisfies **AC-1**, **AC-5**

## Consequences

**Positive**: un rilascio è un merge su `main` con `version` alzata; gli utenti ricevono setup e aggiornamento automatico.
**Negative**: la 1.x non si può più ricostruire da `main` (solo dai tag `v1.0.*`).
