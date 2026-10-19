# Scope · Blocco H: interfaccia IDV → 2.3.0

Richiesta dell'utente del 2026-10-19: l'interfaccia grafica come quella dell'IDV Interface Manager, dentro i pannelli agganciabili e staccabili di oggi, con le interfacce dei blocchi matrioska visibili e collegabili ai livelli superiori. Regola di sempre: progetti e librerie salvati con la 2.2.0 si aprono senza perdite (vedi "Come si chiude ogni blocco" in [index.md](index.md)).

Livello predefinito: **Beta** (dopo `/develop`, `/check verify` poi `/test`). Viene prima dei blocchi B–F, che slittano di una release (2.4.0–2.8.0).

**Branch:** `feat/interfaccia-idv` da `develop`.

## Blocco H · Interfaccia IDV

### 63. Interfaccia grafica in stile IDV · done
Testata blu con marchio, sezioni con contatori e strumenti; lavagna con i blocchi come componenti IDV (intestazione e una riga per requisito, porte ai lati), fili tratteggiati per classe con le etichette, legenda, riquadro di instradamento, griglia a puntini; tabelle Componenti, Interfacce, Requisiti e Dashboard come pannelli dockview, staccabili su un altro monitor.
**Done when:** ogni sezione apre o porta davanti il suo pannello, anche staccato; la lavagna e le immagini esportate hanno lo stile IDV; le tabelle portano al blocco o al filo con un clic ed esportano in CSV; i layout salvati della 2.2 si aprono; aiuto e tour coprono i pulsanti nuovi.
- [x] Design it (spec): [0035](../specs/0035-interfaccia-idv.md)
- [x] Build it: `src/renderer/index.html`, `style.css`, `blocco.ts`, `diagramma.ts`, `renderer.ts`, `pannelli.ts`, `tabelle.ts`, `app.ts`, `aiuto-testi.ts`; test in `tests/unit/regole.test.ts`, `tests/unit/porte.test.ts`, `tests/e2e/ui/idv.spec.ts`
- [ ] Verify it: saltato su richiesta dell'utente per il rilascio 2.3.0

### 64. Porte propagate dei blocchi matrioska · done
Le interfacce dei blocchi interni non collegate dentro salgono sul bordo del blocco che le contiene, in una fascia "Porte dai blocchi interni", e si collegano al livello sopra; il filo ricorda il percorso dei blocchi interni.
**Done when:** una porta interna libera compare sul contenitore a ogni livello sopra finché non la colleghi; collegarla sopra la mostra collegata anche dentro; collegarla dentro avvisa e rende il filo di sopra da riparare; rinomine, nuove istanze dalla libreria e tabelle seguono il percorso.
- [x] Design it (spec): [0035](../specs/0035-interfaccia-idv.md)
- [x] Build it: `src/renderer/porte.ts`, percorso in `model.ts` e `matrioska.ts`, collegamento e "collegata sopra" in `renderer.ts`; test in `tests/unit/porte.test.ts` e `tests/e2e/ui/idv.spec.ts`
- [ ] Verify it: saltato su richiesta dell'utente per il rilascio 2.3.0

### 65. Rilascio 2.3.0 · done
Chiude il blocco: `version` 2.3.0, note in `packaging/note/2.3.0.md` (dire che una 2.2 mostra come non validi i fili verso porte propagate), `packaging/TUTORIAL.md` e `docs/guida/` aggiornati, merge di `develop` in `main`.
**Done when:** la Release è pubblicata e una 2.2.0 installata si aggiorna e apre i suoi progetti senza perdite.
- [x] Prepare the release: `version` 2.3.0, note in `packaging/note/2.3.0.md`, setup costruito in locale e Release pubblicata a mano (CI senza minuti disponibili)
