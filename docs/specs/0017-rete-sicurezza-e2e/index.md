# 0017. Rete di sicurezza end to end: contratto delle API e percorsi dell'interfaccia

**Date**: 2026-10-05
**Status**: Proposed

## Summary

Prima di sostituire il server Python e di passare a TypeScript, una suite di test automatici fissa il comportamento di oggi. Ha due livelli: il **contratto delle API** (cosa rispondono le rotte `/api/*` e cosa scrivono su disco), che le voci 19 e 20 dovranno rispettare alla lettera, e i **percorsi dell'interfaccia** delle funzionalità da 1 a 12, guidati come farebbe una persona. Tutto gira sull'app desktop, su una copia temporanea con dati di prova, in locale e in CI.

## Requirements

**User stories**:
- Come sviluppatore voglio sapere subito se una modifica rompe una funzione che oggi va, prima di unirla in `develop`.
- Come sviluppatore che riscrive le API in TypeScript voglio un elenco eseguibile di tutto quello che le API fanno oggi.

**Acceptance criteria**:
- **AC-1**: Contratto progetti: elenco, creazione, lettura, scrittura con impronta (409 `conflitto` con impronta vecchia, `forza` che sovrascrive e mette la versione su disco in `_versioni/`), annulla, rinomina, eliminazione nel cestino, `ultimo` in lettura e scrittura, slug non valido (400), metodo sbagliato (405), `Content-Type` sbagliato (415), rotta sconosciuta (404). Ogni prova controlla stato, forma della risposta e file su disco.
- **AC-2**: Contratto libreria: `apri` (versione, voce iniziale del changelog, sola lettura fuori da `shared/`), `salva` (versione che avanza per livello calcolato o scelto, voce del changelog con blocco e requisiti toccati, copia in `_versioni/`, nessuna modifica = nessuna scrittura, id duplicato 400, conflitto 409 con impronta vecchia), `elimina`, `rinomina` (con istanze che seguono lato pagina), `changelog` con filtro, percorsi non validi (400) e non scrivibili (403).
- **AC-3**: Contratto import cliente: `cliente/leggi` su un CSV (righe, colonne, separatore) e su un file troppo grande (413).
- **AC-4**: Percorsi dell'interfaccia, uno o più test per funzionalità: 1 salvataggio, Annulla e Ripeti, conflitto con Ricarica; 2 salvataggio di un blocco dall'ispettore e finestra Changelog; 3 import di un CSV cliente fino ai blocchi tondi alla radice; 4 Verifica Coerenza con l'elenco dei problemi e la navigazione; 5 Gerarchia su un requisito con la catena; 6 Matrice con un filtro ed export `.md`; 7 Documenti con un DID ed export `.md`; 8 Filtri che attenuano blocchi e fili; 9 clic su un filo, dettaglio ed eliminazione; 10 eliminazione rifiutata di un blocco usato e rinomina dell'id; 11 blocco rilasciato sotto il cursore con zoom; 12 tour e suggerimento della (i).
- **AC-5**: Ogni test parte da una copia temporanea dell'app con una libreria e, dove serve, un progetto di prova preparati dal test (`tests/e2e/dati/`), con `progetti.debounceMs` ridotto per non aspettare; nessun test tocca `progetti/` e `shared/` del repository.
- **AC-6**: La suite è verde sul codice di partenza (ponte Python), in locale con `npm run test:e2e` e in CI, in meno di 10 minuti.
- **AC-7**: Le prove legate solo alla 1.x restano fuori (exe, zip, console `rich`, porta esclusiva, controlli `Host` e `Origin`, aggiornamento di `start.py`): le sostituiscono le voci 16, 28 e 29.

## Decision

**Chosen option**: due livelli nella stessa suite Playwright su Electron: contratto delle API chiamato dalla pagina con `fetch('/api/...')` (lo stesso trasporto che userà la versione TypeScript) e percorsi dell'interfaccia guidati con mouse e tastiera; dati di prova scritti dal test nella copia temporanea.

Chiamare le API dalla pagina (e non direttamente `start.py`) rende i test indipendenti da chi risponde: oggi il Python dietro il ponte, domani il codice TypeScript del processo principale, senza cambiare una riga.

## Feature design

**Struttura**:
- `tests/e2e/app.ts`: `apriApp()` con opzioni nuove `libreria` (oggetto scritto in `shared/libreria.json`), `progetti` (file in `progetti/`), `impostazioni` (fuse in `settings.json` della copia).
- `tests/e2e/dati/`: libreria di prova (blocchi con requisiti di interfaccia della stessa tipologia e di capacità, collegabili), CSV cliente.
- `tests/e2e/api/*.spec.ts`: contratto (AC-1, AC-2, AC-3). Un'app per file (`test.describe.serial` con `beforeAll`), ogni test usa slug e blocchi suoi.
- `tests/e2e/ui/*.spec.ts`: percorsi (AC-4), un file per funzionalità o gruppo.
- `tests/e2e/api.ts`: helper `api(pagina, metodo, percorso, corpo)` che chiama `fetch` nella pagina e restituisce `{ stato, corpo }`.

**Value sourcing**:
| Azione | Valore | Fonte |
|---|---|---|
| Ogni test | dati di partenza | scritti dal test nella copia (`apriApp` opzioni) |
| Prova del contratto | risposta attesa | il comportamento di `start.py` di oggi, letto dal codice e dalle spec 0001, 0002, 0003, 0010 |
| Prova dei file | contenuto su disco | letto dalla copia temporanea con `fs` |

**Critical test scenarios**: quelli elencati in AC-1 a AC-4, uno per riga.

## Build plan

1. Estendere `apriApp()` con libreria, progetti e impostazioni di prova; helper `api()`; dati in `tests/e2e/dati/`, satisfies **AC-5**
2. Contratto progetti, satisfies **AC-1**
3. Contratto libreria, satisfies **AC-2**
4. Contratto import cliente, satisfies **AC-3**
5. Percorsi interfaccia 1, 2, 3, satisfies **AC-4**
6. Percorsi interfaccia 4, 5, 6, 7, satisfies **AC-4**
7. Percorsi interfaccia 8, 9, 10, 11, 12, satisfies **AC-4**
8. Suite completa verde in locale e in CI sotto i 10 minuti, satisfies **AC-6**, **AC-7**

## Consequences

**Positive**:
- Le voci 19, 20 e 23 hanno un criterio oggettivo di "funziona come prima".

**Negative / tradeoffs**:
- I test dell'interfaccia usano gli id e i testi di oggi: la voce 24 (pannelli) dovrà aggiornarli insieme al layout.
- Circa 3 secondi di avvio per ogni app: i file del contratto ne aprono una sola.

**Neutral**:
- I `verify.md` delle spec 0001 a 0015 restano la lista completa delle prove manuali; la suite ne automatizza i percorsi principali.

## Rationale

Le alternative erano test diretti contro `start.py` con richieste HTTP (si buttano alla voce 20) o solo test dell'interfaccia (lenti e meno precisi sul formato dei file e delle risposte). Il contratto chiamato dalla pagina sopravvive alla riscrittura e controlla proprio quello che la riscrittura deve conservare.
