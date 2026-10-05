# 0018. API dei file nel processo principale, al posto di start.py

**Date**: 2026-10-05
**Status**: Accepted

## Summary

Le rotte `/api/*` che oggi risponde `start.py` (dietro il ponte della spec 0016) le risponde il processo principale di Electron, scritto in TypeScript. Il contratto resta identico byte per byte dove conta (forme delle risposte, codici di errore, formato dei file, impronte SHA1, voci del changelog), così la pagina non cambia e la suite della spec 0017 resta il criterio di "funziona come prima". La voce 19 porta progetti e ultimo progetto; la voce 20 porta libreria, changelog e lettura dei file del cliente, e toglie il ponte e Python dall'app.

## Requirements

**User stories**:
- Come utente voglio che il programma legga e scriva i miei file da solo, senza Python installato.
- Come utente che arriva dalla 1.x voglio che progetti, librerie e changelog esistenti si aprano senza voci di changelog false.

**Acceptance criteria**:
- **AC-1** (voce 19): `GET/POST /api/progetti`, `GET/PUT/DELETE /api/progetti/<slug>`, `POST .../annulla`, `POST .../rinomina`, `GET/PUT /api/ultimo` sono gestite in TypeScript con le stesse regole di `ArchivioProgetti` (slug, nomi riservati, forma del progetto, impronta SHA1 dei byte, versioni ruotate in `_versioni/` fino a `progetti.versioni`, cestino con data e ora locali, `_ultimo.json`, pulizia dei `.tmp` all'avvio, scrittura atomica con file temporaneo e sostituzione, ritentativi su file bloccato con 503 `file_bloccato`).
- **AC-2** (voce 20): `POST /api/libreria/{apri,salva,elimina,rinomina}` e `GET /api/libreria/changelog` sono gestite in TypeScript con le stesse regole di `ArchivioLibrerie`: risoluzione del percorso (solo dentro la cartella dei dati, mai in `progetti/`, scrivibile solo in `shared/` fuori da `_versioni`), formato vecchio e futuro, confronto dei blocchi e livello semver, voci `iniziale`, `esterna`, `app`, copia di riferimento, copie di sicurezza.
- **AC-3** (voce 20): `POST /api/cliente/leggi` legge CSV (UTF-8 con o senza BOM, altrimenti Windows-1252; separatore scelto tra `;`, `,` e tabulazione, `;` se incerto; virgolette alla Excel) e `.xlsx`/`.xlsm` (zip e XML letti senza librerie esterne, limite di 200 MB decompressi, niente DOCTYPE, fogli nell'ordine del workbook con stato nascosto, testi condivisi e ricchi senza fonetica, numeri interi senza `.0`, booleani `1`/`0`, errori e formule senza valore vuoti, righe mancanti conservate come righe vuote) con gli stessi errori (400, 413, 415, 422).
- **AC-4**: La forma canonica (`improntaContenuto`) è uguale a quella di Python (`sort_keys`, nessuno spazio, caratteri non ASCII così come sono) e i file si scrivono come `json.dumps(indent=2, ensure_ascii=False)` in UTF-8: una libreria con changelog scritto dalla 1.x si apre senza voci aggiunte.
- **AC-5**: `GET /api/aggiornamento` risponde `{ stato: 'disattivato', attuale, nuova: null, note: '', pagina: null, installabile: false, motivo }` finché la voce 29 non porta l'aggiornamento; `POST /api/aggiornamento/installa` risponde 409.
- **AC-6**: Le operazioni sui file sono una alla volta (come il lucchetto di Python): il codice dei gestori è sincrono, senza `await` tra lettura e scrittura.
- **AC-7**: Le richieste con metodo o `Content-Type` sbagliati, corpo non JSON o non oggetto, rotte sconosciute rispondono come oggi (405, 415, 400 `json_non_valido` o `richiesta_non_valida`, 404); un errore inatteso risponde 500 `errore_interno` con il messaggio, senza chiudere l'app.
- **AC-8** (voce 20): Il ponte verso `start.py` è tolto dall'app: nessun processo Python parte, la pagina di errore "servizio dei file" non esiste più; `start.py` resta solo per la 1.x fino alla voce 30.
- **AC-9**: La cartella dei dati (dove stanno `progetti/`, `shared/`, `settings.json`) è un parametro del modulo: fino alla voce 21 è la cartella dell'app, come oggi.
- **AC-10**: La suite end to end della spec 0017 resta verde senza modifiche ai test del contratto; i test unitari coprono confronto dei blocchi, livello, forma canonica, CSV e xlsx.

## Decision

**Chosen option**: un modulo `src/main/api/` che porta `start.py` funzione per funzione, con un router che (solo durante la voce 19) inoltra al ponte le rotte non ancora portate.

**Struttura**:
- `src/main/api/errori.ts`: `ErroreApi(stato, codice, messaggio, extra)`, come in Python.
- `src/main/api/file.ts`: lettura con ritentativi, scrittura atomica, copie numerate e loro rotazione, `serializza()` e `formaCanonica()`, `improntaDi()`.
- `src/main/api/progetti.ts`: `ArchivioProgetti`.
- `src/main/api/confronto.ts`: `confrontaBlocco`, `confrontaLibrerie`, `livelloDi`, `avanzaVersione` (puri, testati con Vitest).
- `src/main/api/librerie.ts`: `ArchivioLibrerie`.
- `src/main/api/cliente.ts`, `src/main/api/csv.ts`, `src/main/api/zip.ts`, `src/main/api/xml.ts`: lettura dei file del cliente.
- `src/main/api/router.ts`: da `Request` a `Response` (controlli comuni, instradamento, errori), stesso ordine dei controlli di `gestisci_api`.
- `src/main/api/impostazioni.ts`: `progetti.versioni`, `libreria.versioni`, `cliente.maxFileMB` letti da `settings.json` della cartella dei dati all'avvio, con gli stessi predefiniti.

**Decisioni di dettaglio**:
- Gestori sincroni (`fs.*Sync`): nessuna operazione può intrecciarsi con un'altra, quindi non serve un lucchetto. Il ritentativo su file bloccato aspetta 50 ms con `Atomics.wait`, al massimo 5 volte, come in Python.
- Autore delle voci: `os.userInfo().username`, `sconosciuto` se manca. Data: ora locale con fuso nella forma `AAAA-MM-GGTHH:MM:SS+HH:MM`.
- `modificato` nell'elenco: `Math.floor(stat.mtimeMs)`.
- Ordine delle chiavi: si conserva l'ordine di inserimento come i dizionari di Python (un id di blocco fatto di sole cifre è un caso limite noto: JavaScript lo metterebbe in testa).
- Numeri: `JSON.parse` perde la differenza tra `1` e `1.0`. I file del modellatore non contengono numeri decimali nella libreria; il caso è documentato, non gestito.

## Build plan

1. `errori.ts`, `file.ts`, `impostazioni.ts` con test unitari di serializzazione e forma canonica, satisfies **AC-4**, **AC-6**
2. `progetti.ts` e `router.ts` con le rotte dei progetti, `ultimo` e `aggiornamento`; le altre al ponte, satisfies **AC-1**, **AC-5**, **AC-7**, **AC-9**
3. Suite e2e verde con progetti in TypeScript (voce 19 chiusa), satisfies **AC-10**
4. `confronto.ts` con test unitari, poi `librerie.ts` e le rotte della libreria, satisfies **AC-2**, **AC-4**
5. `csv.ts`, `zip.ts`, `xml.ts`, `cliente.ts` con test unitari sul file di riferimento, satisfies **AC-3**
6. Tolto il ponte (`ponte-python.ts`, pagina di errore, `--solo-api`), CI senza Python, suite verde (voce 20 chiusa), satisfies **AC-8**, **AC-10**

## Consequences

**Positive**:
- Niente Python per far girare l'app; un solo linguaggio.
- Le regole dei file sono testate due volte: unitari sulle funzioni pure, end to end sul contratto.

**Negative / tradeoffs**:
- Circa 1.500 righe di Python da portare con cura; un errore di confronto produrrebbe voci di changelog sbagliate, per questo i test unitari del confronto sono obbligatori.

**Neutral**:
- `start.py` resta nel repository per la 1.x, invariato salvo `--solo-api`, che sparisce con il ponte.

## Rationale

Riscrivere la pagina per usare IPC al posto di `fetch('/api/...')` avrebbe toccato tutti i moduli dell'interfaccia insieme al cambio del backend; tenere il contratto HTTP dentro il protocollo `app://` (spec 0016) permette di cambiare solo il lato server e di misurarlo con i test già scritti. Gestori sincroni invece di un lucchetto asincrono: è il modo più semplice per garantire che due salvataggi non si intreccino, e i file in gioco sono piccoli (decine di MB al massimo).
