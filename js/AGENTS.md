# Editor modules (js/)

## Overview

All app logic. Modules share one mutable global state from `state.js`; any change mutates that state and then calls `render()`, which rebuilds the whole SVG canvas from scratch.

## Key files

| File | Owns |
|---|---|
| `app.js` | Entry point: `initApp()`, wires every toolbar button, canvas drop, breadcrumb (`renderUI`) |
| `state.js` | `appState` (library, workspace, cliente), `pathStack`, `activeNodeId`, `loadSettings()` merged over `DEFAULT_SETTINGS` |
| `model.js` | Data model rules: interface vs capability, link rules (`verificaCollegamento`), migration of old formats (`normalizzaLibreria`), updating references after a block edit (`aggiornaRiferimentiRequisiti`) |
| `utils.js` | `generaId`, `slugifyId`, `dataOggi`, `escapeHtml` |
| `renderer.js` | `render()`, zoom and pan, node drag and resize, pin drag, edge drawing, waypoints, round parent blocks, entering a block |
| `inspector.js` | Right panel form: create, edit, copy a library block, its requirements and export texts; delete a node; client requirement detail; connection detail (spec 0009, `mostraDettaglioCollegamento()`, wrapper with `data-filo`) |
| `builder.js` | Left panel library tree (categoria, then sottocategoria), search, click to edit, `impostaLibreria()`, `loadLibraryFromPath()` (goes through `libreria.js`) |
| `storage.js` | Only helpers: `leggiFileJson()` (user picked JSON file) and `downloadJsonFile()` |
| `progetto.js` | Project on disk (spec 0001): autosave with debounce and retries, badge, Annulla/Ripeti via server copies, Progetto menu, Apri window, conflict banner (`aggiornaBanner()`), `chiamaApi()` wrapper for `/api/` |
| `libreria.js` | Library on disk (spec 0002): `apriLibreria()`, `salvaBloccoLibreria()`, library conflict (Ricarica / Sovrascrivi), read only state, version in the panel, Changelog window |
| `cliente.js` | Client requirements (spec 0003): import from Excel or CSV, Cliente tab; `mostraScheda()` switches the left panel tabs (Libreria, Cliente, Coerenza) |
| `coerenza.js` | Coherence check (spec 0004): pure `calcolaCoerenza()` rerun by `render()` while `#btnDRC` mode is on, Coerenza tab, `problemaPin()` / `contatoreBlocco()` read by the renderer for halos and counters, `vaiAlProblema()` navigation |
| `gerarchia.js` | Requirement hierarchy (spec 0005): pure `calcolaGerarchia()` index of occurrences (requirement + instance path) with parents and children from valid derivation edges, `#btnGerarchia` mode, Gerarchia tab, chain highlight, `apriGerarchiaSu()` |
| `matrice.js` | Traceability matrix (spec 0006): pure `calcolaMatrice()` grouped by requirement id (also returns `voci`, every entry in group order), `filtraMatrice()`, `#matriceModal`, Markdown export; exports `cellaMd()` / `tabellaMd()` |
| `filtri.js` | Canvas filters (spec 0008): view only state (classe, documento, categoria, sottocategoria, attenua or nascondi), pure rules `requisitoIncluso()` / `bloccoPassa()` / `bloccoIncluso()` / `classePassa()`, the `#pannelloFiltri` panel; `riallineaFiltri()` runs from `initLibrary()` |
| `documenti.js` | MIL-STD-498 documents (spec 0007): DID chapter trees as data (`DID`), pure `generaDocumento()` over the matrix, `#documentiModal` with selector, summary, preview and `.md` download |

## Data model

- Library: `{ [id]: { id, titolo, descrizione, categoria, sottocategoria, requisiti: [{ id, titolo, tipologia, metodoVerifica, testiExport: [{ testo, documento }] }] } }`.
- A requirement with a `tipologia` is an interface requirement: port on the block border (movable) and, inside the block, a round parent block. With `tipologia: null` it is a capability requirement: square pin inside the block rectangle and a round parent block inside. Interface links only to interface of the same tipologia; capability only to capability.
- Requirement ids are unique across the whole library (checked on save and on load).
- `normalizzaLibreria()` converts the old format (`name`, `category`, `requirements`, `type`, `description`) and the draft with spaced keys (`metodo di verifica`, `export_text`, `interfaccia`). Every library load goes through `impostaLibreria()`.
- Graph: `{ nodes, edges, parentReqPositions? }`. `parentReqPositions` holds the round blocks' centers inside that level. Node: `{ id, type, label, width, height, position: {x, y}, internal_graph, pinPositions? }`. `type` is the library `typeId`.
- Edge: `{ id, source, sourceHandle, sourceType, target, targetHandle, targetType, waypoints }`. `*Handle` is a requirement id; `*Type` is `'node'` or `'parent'` (a round block of the containing block). A derivation edge always has the parent on the `source` side.
- Hierarchy: each node holds its own `internal_graph`. `pathStack` is the breadcrumb of open levels; `pathStack[0].graph` is the root workspace; `getCurrentLevel()` is the level on screen.
- File formats: project file `progetti/<slug>.json` = `{ formatVersion: 1, nome, libraryPath, workspace }`. Library file = `{ formatVersion: 1, versione, library }`, with `<nome>.changelog.json` beside it and backups plus `<nome>.riferimento.json` in `_versioni/`. Library loaders still accept `{ library: {...} }` and a bare map (old format, converted on the first Salva).

## Conventions

- Mutate state in place, then call `render()` (and `initLibrary()` when the library changed). There is no store or event bus.
- `render()` also schedules the project autosave (`pianificaSalvataggio()`), so any model change must go through it to reach disk.
- Never write `appState.library` directly: a block change goes through `salvaBloccoLibreria()`, and memory, project and tree update only after the server confirms the write (disk first, then memory).
- The server (`start.py`) owns versions, diffs and the changelog; the client sends only the saved block plus `rinomine`, `livello`, `nota`.
- Replace `pathStack` contents in place (`length = 0` then `push`), never reassign it: other modules hold the imported binding. To open a level from a list of node ids use `apriPercorso(ids)` (`progetto.js`), which returns `false` if an id is gone.
- The selected wire (spec 0009) is `filoSelezionato = { percorso, edgeId }` in `renderer.js`, resolved again in every `render()`; delete a wire only through `eliminaFilo(graph, edgeId)`.
- View only state (a mode, a computed report) lives in module variables, never in `appState`, so it cannot reach `testoProgetto()` and trigger a save. Resolve clicks again from ids (path, keys), never from `graph`/`node` objects kept from before: Annulla, Ripeti and Ricarica replace the model objects.
- Canvas coordinates go through `getCanvasCoords()`, which undoes zoom and pan and snaps to `appSettings.grid.size`.
- New internal ids come from `generaId(prefix)` (`edge_`, `node_`). Block ids come from `slugifyId(titolo)`; new requirement ids from `idRequisitoLibero()` (`<block>_001`), editable by the user.
- Tipologie, their colors, the capability color, verification methods and documents come from `settings.json`; the filter panel and the inspector selects are built from it.
- What the canvas dims or hides is decided once per `render()` by `calcolaInclusi()` (`renderer.js`) from the rules in `filtri.js`; a Gerarchia chain overrides it (chain elements always drawn, dimming by `fuori-catena`). Use the `.fuori-filtro` class, never inline opacity.
- Escape every user text interpolated into `innerHTML` with `escapeHtml()`.
- User feedback uses `alert()` and `confirm()`, in Italian.

## Gotchas

- Tipologie are listed in `settings.json` `typeColors` and in `DEFAULT_SETTINGS` in `state.js` (fallback only).
- Blocks are shared by type: a saved block replaces `appState.library[id]` (from the server response), so the requirement change hits every instance. Only `label` is per node. Saving then walks the whole model: renamed requirement ids follow into edges and pin positions, and edges that became invalid are removed.
- Link rules live in `model.js` (`verificaCompatibilita`), used both when drawing and when cleaning up after an edit.
- Layer order in `index.html` matters: edges, then round parent blocks, then nodes, so parent pins stay clickable. The temporary edge line has `pointer-events: none` so the mouse release reaches the target pin.
- `render()` also fills in missing fields on the model (`edge.waypoints`, `node.pinPositions`) and runs on every mousemove while dragging.
- Modules import each other in a cycle (`app` ↔ `renderer` ↔ `inspector` ↔ `builder` ↔ `storage`). Top level code may only look up DOM elements; never call an imported function at import time.
- The drop position of a new block ignores zoom and pan.
- Modal windows (`#reportModal`, `#matriceModal`, `#documentiModal`, import cliente) must be listed in `modaleAperta()` (`progetto.js`), so Esc and Ctrl+Z / Ctrl+Y do not act behind them.
- Gerarchia, Coerenza, Matrice and Documenti share one rule set for parents, children and "senza padre": the visit in `model.js` (`visitaDerivazioni`), then `calcolaGerarchia()`, then `calcolaMatrice()`. Build new views on top of these, never with a separate walk.
- The Cliente and Coerenza tabs redraw only when `render()` marks them (once per frame, only if visible). A change that skips `render()` but alters what they show (e.g. the project rename, which calls only `renderUI()`) must call `segnaSchedaCoerenzaDaAggiornare()` itself. `#reportModal` is shared by the Apri window (`progetto.js`) and the Changelog window (`libreria.js`).
- The banner under the header has one owner, `progetto.js`; `libreria.js` feeds it through `impostaStatoLibreriaBanner({ conflitto, avviso })`. Priority: project conflict, library conflict, project save error, notices.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
