# 0020. Editor in TypeScript

**Date**: 2026-10-05
**Status**: Accepted

## Summary

Il codice dell'interfaccia (`js/`, circa 7.000 righe in 21 moduli) diventa TypeScript rigoroso in `src/renderer/`, insieme a `index.html`, `benvenuto.html` e `style.css`. esbuild lo impacchetta in `out/renderer/` e il protocollo `app://` serve solo da lì. Si passa un modulo alla volta, con l'app sempre funzionante e la suite end to end verde a ogni passo; le regole pure (modello, coerenza, gerarchia, matrice, documenti, filtri) ricevono test unitari.

## Requirements

**Acceptance criteria**:
- **AC-1**: In `src/renderer/` non resta JavaScript scritto a mano; `npm run typecheck` controlla in modalità `strict` sia il processo principale sia l'interfaccia, senza errori e senza `// @ts-ignore` o `any` espliciti (salvo dove un commento spiega perché).
- **AC-2**: L'interfaccia ha un suo `tsconfig` con le librerie DOM e senza i tipi di Node: il codice della pagina non può usare moduli di Node.
- **AC-3**: `npm run build` produce `out/renderer/` con `index.html`, `benvenuto.html`, `style.css`, `app.js` e `benvenuto.js` (con sourcemap); il protocollo serve solo quella cartella, più `settings.json` (della cartella di lavoro o i valori predefiniti del programma). Nessun percorso fuori da `out/renderer/` è raggiungibile.
- **AC-4**: Il modello dati (libreria, blocco, requisito, grafo, nodo, filo, progetto, cliente, impostazioni) ha tipi espliciti in `src/renderer/tipi.ts`, usati da tutti i moduli; i dati letti da file o API si convalidano dove oggi si convalidano (stesse funzioni, ora tipate).
- **AC-5**: I test unitari coprono le regole pure: compatibilità dei collegamenti e conversione dei formati vecchi (`model`), coerenza, gerarchia, matrice con filtri, generazione dei documenti, regole dei filtri.
- **AC-6**: Il comportamento non cambia: la suite end to end è verde dopo ogni modulo convertito e alla fine; nessun testo, id o classe dell'interfaccia cambia.

## Decision

**Chosen option**: migrazione incrementale con bundle esbuild, `allowJs` acceso solo durante la migrazione e spento alla fine.

**Decisioni di dettaglio**:
- Spostamento iniziale senza modifiche (`git mv js/*.js src/renderer/`, HTML e CSS accanto): la storia dei file resta, e il primo passo si verifica da solo.
- Bundle ESM unico per pagina (`app.ts`, `benvenuto.ts`): l'ordine di valutazione dei moduli in un ciclo di import resta quello degli ES module (vincolo già scritto in `js/AGENTS.md`: a livello di modulo solo ricerche nel DOM).
- Accesso al DOM: un aiuto `elemento<T>(id)` che restituisce l'elemento con il suo tipo e lancia un errore chiaro se manca, al posto di `document.getElementById(...)!` sparsi.
- Test unitari dell'interfaccia con l'ambiente `happy-dom` di Vitest (i moduli leggono il DOM all'import).
- `start.py` su `develop` non serve più l'interfaccia dopo questo passo: la 1.x vive su `main` fino alla voce 30.

## Build plan

1. Spostamento in `src/renderer/`, bundle esbuild, protocollo su `out/renderer/`, secondo `tsconfig` con `allowJs`; suite verde, satisfies **AC-2**, **AC-3**, **AC-6**
2. `tipi.ts`, `utils`, `state`, `model`, `storage`, `aiuto-testi` in TypeScript con test di `model`, satisfies **AC-1**, **AC-4**, **AC-5**
3. Regole e viste: `filtri`, `coerenza`, `gerarchia`, `matrice`, `documenti` con i loro test, satisfies **AC-1**, **AC-5**
4. Editor: `renderer`, `inspector`, `builder`, `libreria`, `progetto`, `cliente`, `app`, satisfies **AC-1**
5. Aiuto e resto: `aiuto`, `tour`, `aggiornamento`, `impostazioni`, `benvenuto`; `allowJs` spento, `js/AGENTS.md` spostato e aggiornato; suite verde, satisfies **AC-1**, **AC-6**

## Consequences

**Positive**:
- Errori di forma dei dati e di DOM scoperti dal compilatore invece che dall'utente.

**Negative / tradeoffs**:
- Un passo di build anche per l'interfaccia (esbuild, meno di un secondo).

## Rationale

La migrazione incrementale tiene l'app sempre spedibile e misura ogni passo con la suite della spec 0017; un bundle per pagina evita di servire centinaia di richieste di moduli e permette di spegnere `allowJs` alla fine.
