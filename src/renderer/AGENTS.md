# Editor modules (src/renderer/)

## Overview

All app logic, in TypeScript `strict` (spec 0020), bundled by esbuild into `out/renderer` (entries `avvio.ts` and `benvenuto.ts`). Imports keep the `.js` suffix (`./state.js`), as ESM resolution with `moduleResolution: Bundler` expects. Modules share one mutable global state from `state.ts`; any change mutates that state and then calls `render()`, which rebuilds the whole SVG canvas from scratch.

## Key files

| File | Owns |
|---|---|
| `avvio.ts` | Bundle entry: only calls `initApp()`, so tests can import `app.ts` without starting the app |
| `tipi.ts` | Data model types (library, graph, project, cliente, settings), the `window.desktop` bridge and `EstremoDescritto` |
| `api.ts` | `chiamaApi<T>()` for `/api/*`, returning `EsitoApi<T>` (`{ ok: true, dati }` or `{ ok: false, stato, messaggio }`) |
| `app.ts` | `initApp()`, wires every toolbar button, canvas drop, breadcrumb (`renderUI`) |
| `state.ts` | `appState` (library, workspace, cliente), `pathStack`, `activeNodeId`, `loadSettings()` merged over `DEFAULT_SETTINGS` |
| `model.ts` | Data model rules: interface vs capability, documents allowed per requirement class (`classeDocumenti`, `documentiDellaClasse`, `motivoNonAmmesso`, `testiNonAmmessi`, spec 0027), link rules (`verificaCollegamento`), migration of old formats (`normalizzaLibreria`), updating references after a block edit (`aggiornaRiferimentiRequisiti`) |
| `utils.ts` | `generaId`, `slugifyId`, `dataOggi`, `escapeHtml` |
| `renderer.ts` | `render()`, zoom and pan, node drag and resize, pin drag, edge drawing, waypoints, round parent blocks, entering a block |
| `inspector.ts` | Right panel form: create, edit, copy a library block, its requirements and export texts; delete a node; client requirement detail; connection detail (spec 0009, `mostraDettaglioCollegamento()`, wrapper with `data-filo`) |
| `builder.ts` | Left panel library tree (categoria, then sottocategoria), search, click to edit, `impostaLibreria()`, `loadLibraryFromPath()` (goes through `libreria.ts`) |
| `storage.ts` | Only helpers: `leggiFileJson()` (user picked JSON file) and `downloadJsonFile()` |
| `progetto.ts` | Project on disk (spec 0001): autosave with debounce and retries, badge, Annulla/Ripeti via server copies, Progetto menu, Apri window, conflict banner (`aggiornaBanner()`), `chiamaApi()` wrapper for `/api/` |
| `libreria.ts` | Library on disk (spec 0002, 0010): `apriLibreria()`, `salvaBloccoLibreria()`, `eliminaBloccoLibreria()`, `rinominaBloccoLibreria()` (all through `invia(rotta, …)`; a conflict keeps its route for Sovrascrivi), library conflict (Ricarica / Sovrascrivi), read only state, version in the panel, Changelog window |
| `cliente.ts` | Client requirements (spec 0003): import from Excel or CSV with the optional row filter (`passaFiltro()`, `ultimoImport.filtro`, spec 0030), Cliente panel |
| `staccate.ts` | Detached windows (spec 0023): wraps `document.getElementById` / `querySelector` / `querySelectorAll` once so they also search the documents of popout windows, and forwards Ctrl shortcuts from a popout to the main `document` |
| `pannelli.ts` | Docking panels (spec 0021, `dockview-core`): nine panels (`libreria`, `cliente`, `coerenza`, `gerarchia`, `canvas`, `ispettore`, and below the canvas `matrice`, `documenti`, `changelog` from spec 0022), menu Finestra, layout saved in `localStorage` (`modellatore.layout`, checked by `layoutValido`). `mostraPannello()` opens or focuses a panel; `allaVista`/`allaChiusura` hook a module to its panel |
| `coerenza.ts` | Coherence check (spec 0004): pure `calcolaCoerenza()` rerun by `render()` while `#btnDRC` mode is on, Coerenza tab, `problemaPin()` / `contatoreBlocco()` read by the renderer for halos and counters, `vaiAlProblema()` navigation |
| `gerarchia.ts` | Requirement hierarchy (spec 0005): pure `calcolaGerarchia()` index of occurrences (requirement + instance path) with parents and children from valid derivation edges, `#btnGerarchia` mode, Gerarchia tab, chain highlight, `apriGerarchiaSu()` |
| `matrice.ts` | Traceability matrix (spec 0006): pure `calcolaMatrice()` grouped by requirement id (also returns `voci`, every entry in group order), `filtraMatrice()` (global filters, then per column filters and sorting from `COLONNE_DERIVAZIONI` / `COLONNE_SENZA_PADRE`, spec 0031), `valoriColonna()`, the Matrice panel (`#pannelloMatrice`, spec 0022) with the column menu `#menuColonnaMatrice` (a child of the panel, so it follows a detached window), Markdown export; exports `cellaMd()` / `tabellaMd()` |
| `filtri.ts` | Canvas filters (spec 0008): view only state (classe, documento, categoria, sottocategoria, attenua or nascondi), pure rules `requisitoIncluso()` / `bloccoPassa()` / `bloccoIncluso()` / `classePassa()`, the `#pannelloFiltri` panel; `riallineaFiltri()` runs from `initLibrary()` |
| `documenti.ts` | MIL-STD-498 documents (spec 0007): DID chapter trees as data (`DID`), pure `generaDocumento()` over the matrix, the Documenti panel (`#pannelloDocumenti`) with selector, summary, preview, `.md` download, Word and PDF export through `window.desktop.documenti` and the per document revision table (`appState.revisioniDocumenti`, saved in the project, spec 0028) |
| `diagramma.ts` | Diagrams (spec 0029): pure `svgDiagramma()` draws any level as a standalone SVG (same geometry as the canvas: `posizionePorta`, `posizioniCapacita` / `puntoPin` (moved capability pins, spec 0032), `posizioneInColonna`, which `renderer.ts` also uses), `svgInPng()`, `interniDeiBlocchi()`, and the `🖼 Immagine` menu (`#btnImmagine`). Word and PDF documents get figures through `generaDocumento(…, diagrammi)` placeholders `![…](diagramma:<chiave>)` |
| `instradamento.ts` | Wire routing (spec 0033): pure `instrada()` (A* on a sparse Hanan grid around blocks and round blocks, cost = length + bend penalty, local zone first, then all obstacles, then an L), with a path cache; `trattoPiuVicino()` for double click |
| `aiuto.ts` | Contextual help (spec 0012): one shared `#suggerimento` tooltip driven by delegated `mouseover`/`focusin` on any `[data-aiuto]`, `iconaAiuto(chiave)` for the (i) icon in templates, the ❓ Aiuto menu (tour, show or hide the icons), `[data-tour-avvia]` buttons, first launch tour |
| `tour.ts` | Guided tour (spec 0012): overlay, spotlight and bubble, keyboard in capture phase, opens panels for a step (`prepara: 'pannello:<id>'`) and closes them again at the end, `tourAttivo()` read by `modaleAperta()` |
| `aiuto-testi.ts` | All help texts as data: `SUGGERIMENTI` (key → titolo, testo) and `TOUR` (step lists with CSS selector areas) |
| `impostazioni.ts` | Settings window (spec 0019): work folder, libraries folder, `settings.json`, import from 1.x, all through `window.desktop.cartelle` |
| `benvenuto.ts` | Welcome page (`benvenuto.html`, its own bundle): first folder choice when none is configured or the configured one is gone |
| `aggiornamento.ts` | Self update (spec 0015): owns `#bannerAggiornamento`, reads `GET /api/aggiornamento`, Novità, Più tardi (`sessionStorage`), Aggiorna e riavvia (`svuota()` first, then `POST /api/aggiornamento/installa`), follows the phases and reloads the page when the new version answers |

## Data model

- Library: `{ [id]: { id, titolo, descrizione, categoria, sottocategoria, requisiti: [{ id, titolo, tipologia, metodoVerifica, testiExport: [{ testo, documento }] }] } }`.
- A requirement with a `tipologia` is an interface requirement: port on the block border (movable) and, inside the block, a round parent block. With `tipologia: null` it is a capability requirement: square pin inside the block rectangle and a round parent block inside. Interface links only to interface of the same tipologia; capability only to capability.
- Requirement ids are unique across the whole library (checked on save and on load).
- `normalizzaLibreria()` converts the old format (`name`, `category`, `requirements`, `type`, `description`) and the draft with spaced keys (`metodo di verifica`, `export_text`, `interfaccia`). Every library load goes through `impostaLibreria()`.
- Graph: `{ nodes, edges, parentReqPositions? }`. `parentReqPositions` holds the round blocks' centers inside that level. Node: `{ id, type, label, width, height, position: {x, y}, internal_graph, pinPositions?, capabilityPositions? }`. `capabilityPositions` (spec 0032) holds the centers of capability pins moved with Shift+drag, relative to the block; absent means the automatic row, and opening a file never adds it. `type` is the library `typeId`.
- Edge: `{ id, source, sourceHandle, sourceType, target, targetHandle, targetType, waypoints }`. Empty `waypoints` = automatic route, computed on every `render()` by `percorsoFilo()` (`diagramma.ts`, spec 0033) and never saved; any waypoint makes the wire manual (drawn point to point as before). `*Handle` is a requirement id; `*Type` is `'node'` or `'parent'` (a round block of the containing block). A derivation edge always has the parent on the `source` side.
- Hierarchy: each node holds its own `internal_graph`. `pathStack` is the breadcrumb of open levels; `pathStack[0].graph` is the root workspace; `getCurrentLevel()` is the level on screen.
- File formats: project file `progetti/<slug>.json` = `{ formatVersion: 2, nome, libraryPath, workspace, cliente?, revisioniDocumenti? }` (the optional keys travel with the workspace through Annulla, Ripeti, Ricarica and the server's restore). Library file = `{ formatVersion: 1, versione, library }`, with `<nome>.changelog.json` beside it and backups plus `<nome>.riferimento.json` in `_versioni/`. Library loaders still accept `{ library: {...} }` and a bare map (old format, converted on the first Salva).

## Conventions

- Types for shared data live in `tipi.ts`; a module's own shapes stay in the module. Read DOM elements with a cast or a null check (`as HTMLInputElement`, `?.`), never `any`. Unit tests of the pure rules are in `tests/unit` (happy-dom for modules that touch the page).
- Mutate state in place, then call `render()` (and `initLibrary()` when the library changed). There is no store or event bus.
- `render()` also schedules the project autosave (`pianificaSalvataggio()`), so any model change must go through it to reach disk.
- Never write `appState.library` directly: a block change goes through `salvaBloccoLibreria()`, and memory, project and tree update only after the server confirms the write (disk first, then memory).
- Deleting a library block is refused while the open project uses it (`istanzeDelBlocco()` in `inspector.ts`); renaming a block id rewrites `node.type` of every instance after the server confirms.
- The server (`start.py`) owns versions, diffs and the changelog; the client sends only the saved block plus `rinomine`, `livello`, `nota`.
- Replace `pathStack` contents in place (`length = 0` then `push`), never reassign it: other modules hold the imported binding. To open a level from a list of node ids use `apriPercorso(ids)` (`progetto.ts`), which returns `false` if an id is gone.
- The selected wire (spec 0009) is `filoSelezionato = { percorso, edgeId }` in `renderer.ts`, resolved again in every `render()`; delete a wire only through `eliminaFilo(graph, edgeId)`.
- View only state (a mode, a computed report) lives in module variables, never in `appState`, so it cannot reach `testoProgetto()` and trigger a save. Resolve clicks again from ids (path, keys), never from `graph`/`node` objects kept from before: Annulla, Ripeti and Ricarica replace the model objects.
- Canvas coordinates go through `getCanvasCoords()`, which undoes zoom and pan and snaps to `appSettings.grid.size`.
- New internal ids come from `generaId(prefix)` (`edge_`, `node_`). Block ids come from `slugifyId(titolo)`; new requirement ids from `idRequisitoLibero()` (`<block>_001`), editable by the user.
- Tipologie, their colors, the capability color, verification methods and documents come from `settings.json`; the filter panel and the inspector selects are built from it.
- Which document a text may go to depends on the requirement class (`documentiPerClasse`, spec 0027): Inspector menu, library tree `⚠`, Documenti selector and generator all ask `motivoNonAmmesso()`. Matrice and Filtri deliberately ignore the rule (they show the library as written).
- What the canvas dims or hides is decided once per `render()` by `calcolaInclusi()` (`renderer.ts`) from the rules in `filtri.ts`; a Gerarchia chain overrides it (chain elements always drawn, dimming by `fuori-catena`). Use the `.fuori-filtro` class, never inline opacity.
- Escape every user text interpolated into `innerHTML` with `escapeHtml()`.
- User feedback uses `alert()` and `confirm()`, in Italian.
- Every new field gets an (i): `iconaAiuto('area.campo')` in its label and a voce in `SUGGERIMENTI` (`aiuto-testi.ts`); a button gets `data-aiuto="area.azione"` and no `title`. A state reason (why a button is disabled) goes in `data-titolo-nativo`, shown as an extra line of the tooltip (spec 0012).

## Gotchas

- Tipologie are listed in `settings.json` `typeColors` and in `DEFAULT_SETTINGS` in `state.ts` (fallback only).
- Blocks are shared by type: a saved block replaces `appState.library[id]` (from the server response), so the requirement change hits every instance. Only `label` is per node. Saving then walks the whole model: renamed requirement ids follow into edges and pin positions, and edges that became invalid are removed.
- Link rules live in `model.ts` (`verificaCompatibilita`), used both when drawing and when cleaning up after an edit.
- Layer order in `index.html` matters: edges, then round parent blocks, then nodes, so parent pins stay clickable. The temporary edge line has `pointer-events: none` so the mouse release reaches the target pin.
- Wire geometry has one source: `contestoFili()` + `percorsoFilo()` in `diagramma.ts`, used by both `renderEdge()` and `svgDiagramma()`. Never compute pin or wire points separately in the renderer.
- `render()` also fills in missing fields on the model (`edge.waypoints`, `node.pinPositions`) and runs on every mousemove while dragging.
- Modules import each other in a cycle (`app` ↔ `renderer` ↔ `inspector` ↔ `builder` ↔ `storage`). Top level code may only look up DOM elements; never call an imported function at import time.
- Canvas coordinates: `puntoCanvas(e)` gives the unsnapped point (zoom and pan removed), `getCanvasCoords(e)` snaps it; a dropped block is centred under the cursor (spec 0011).
- Modal windows (`#reportModal` for Apri progetto, `#impostazioniModal`, import cliente) must be listed in `modaleAperta()` (`progetto.ts`), so Esc and Ctrl+Z / Ctrl+Y do not act behind them. The guided tour counts as one (`tourAttivo()`). Panels (Matrice, Documenti, Changelog included) are not modal and never go there.
- Matrice and Documenti recompute from `render()` through `segna…DaAggiornare()`: a 250 ms timer, and only while the panel is visible; a hidden one recomputes in its `allaVista` hook. `allaVista` runs once the node is attached to the page (dockview calls `init` before attaching).
- Panel contents live in `index.html` inside the hidden `#pannelliParcheggiati`; `pannelli.ts` moves each node into its dockview panel while it is visible and back when hidden or closed, so `getElementById` always finds it. Check visibility with `pannelloVisibile(id)`, never with `.hidden`. Coerenza and Gerarchia panels are open exactly while their mode is on.
- A detached panel (dockview popout, `popout.html`) is the same DOM node moved into another window's document: code still runs in the main page. Look elements up through `document.*` (wrapped by `staccate.ts`), never keep a `document` listener as the only way a panel reacts (it misses popout windows). The Canvas group never detaches.
- dockview is bundled from its UMD build (`alias` in `scripts/build.mjs`) because only that build injects its CSS; overrides in `style.css` need a selector under `.area-pannelli` to win over it.
- Tour steps in `TOUR` point at CSS selectors (`#btnDRC`, `#schedaLibreria`, …): renaming or moving one of those elements needs the step updated too, or the step falls back to a centred bubble without spotlight.
- Gerarchia, Coerenza, Matrice and Documenti share one rule set for parents, children and "senza padre": the visit in `model.ts` (`visitaDerivazioni`), then `calcolaGerarchia()`, then `calcolaMatrice()`. Build new views on top of these, never with a separate walk.
- The Cliente and Coerenza tabs redraw only when `render()` marks them (once per frame, only if visible). A change that skips `render()` but alters what they show (e.g. the project rename, which calls only `renderUI()`) must call `segnaSchedaCoerenzaDaAggiornare()` itself. `#reportModal` is shared by the Apri window (`progetto.ts`) and the Changelog window (`libreria.ts`).
- `#bannerAggiornamento` (spec 0015) is separate from `#bannerProgetto` and owned by `aggiornamento.ts`, so an update notice never hides a save conflict.
- The banner under the header has one owner, `progetto.ts`; `libreria.ts` feeds it through `impostaStatoLibreriaBanner({ conflitto, avviso })`. Priority: project conflict, library conflict, project save error, notices.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
