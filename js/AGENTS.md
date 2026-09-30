# Editor modules (js/)

## Overview

All app logic. Modules share one mutable global state from `state.js`; any change mutates that state and then calls `render()`, which rebuilds the whole SVG canvas from scratch.

## Key files

| File | Owns |
|---|---|
| `app.js` | Entry point: `initApp()`, wires every toolbar button, canvas drop, breadcrumb (`renderUI`) |
| `state.js` | `appState` (library, workspace, filters), `pathStack`, `activeNodeId`, `loadSettings()` merged over `DEFAULT_SETTINGS` |
| `model.js` | Data model rules: interface vs capability, link rules (`verificaCollegamento`), migration of old formats (`normalizzaLibreria`), updating references after a block edit (`aggiornaRiferimentiRequisiti`) |
| `utils.js` | `generaId`, `slugifyId`, `escapeHtml` |
| `renderer.js` | `render()`, zoom and pan, node drag and resize, pin drag, edge drawing, waypoints, round parent blocks, entering a block |
| `inspector.js` | Right panel form: create, edit, copy a library block, its requirements and export texts; delete a node |
| `builder.js` | Left panel library tree (categoria, then sottocategoria), search, click to edit, `impostaLibreria()`, `loadLibraryFromPath()` |
| `storage.js` | Export of the three JSON files and import of library or standalone project |

## Data model

- Library: `{ [id]: { id, titolo, descrizione, categoria, sottocategoria, requisiti: [{ id, titolo, tipologia, metodoVerifica, testiExport: [{ testo, documento }] }] } }`.
- A requirement with a `tipologia` is an interface requirement: port on the block border (movable) and, inside the block, a round parent block. With `tipologia: null` it is a capability requirement: square pin inside the block rectangle and a round parent block inside. Interface links only to interface of the same tipologia; capability only to capability.
- Requirement ids are unique across the whole library (checked on save and on load).
- `normalizzaLibreria()` converts the old format (`name`, `category`, `requirements`, `type`, `description`) and the draft with spaced keys (`metodo di verifica`, `export_text`, `interfaccia`). Every library load goes through `impostaLibreria()`.
- Graph: `{ nodes, edges, parentReqPositions? }`. `parentReqPositions` holds the round blocks' centers inside that level. Node: `{ id, type, label, width, height, position: {x, y}, internal_graph, pinPositions? }`. `type` is the library `typeId`.
- Edge: `{ id, source, sourceHandle, sourceType, target, targetHandle, targetType, waypoints }`. `*Handle` is a requirement id; `*Type` is `'node'` or `'parent'` (a round block of the containing block). A derivation edge always has the parent on the `source` side.
- Hierarchy: each node holds its own `internal_graph`. `pathStack` is the breadcrumb of open levels; `pathStack[0].graph` is the root workspace; `getCurrentLevel()` is the level on screen.
- File formats: `modello.json` = `{ workspace }`, `libreria.json` = `{ library }`, `standalone.json` = `{ library, workspace }`. Library loaders accept both `{ library: {...} }` and a bare map (as in `shared/libreria.json`).

## Conventions

- Mutate state in place, then call `render()` (and `initLibrary()` when the library changed). There is no store or event bus.
- Replace `pathStack` contents in place (`length = 0` then `push`), never reassign it: other modules hold the imported binding.
- Canvas coordinates go through `getCanvasCoords()`, which undoes zoom and pan and snaps to `appSettings.grid.size`.
- New internal ids come from `generaId(prefix)` (`edge_`, `node_`). Block ids come from `slugifyId(titolo)`; new requirement ids from `idRequisitoLibero()` (`<block>_001`), editable by the user.
- Tipologie, their colors, the capability color, verification methods and documents come from `settings.json`; the filter and the inspector selects are built from it.
- Escape every user text interpolated into `innerHTML` with `escapeHtml()`.
- User feedback uses `alert()` and `confirm()`, in Italian.

## Gotchas

- Tipologie are listed in `settings.json` `typeColors` and in `DEFAULT_SETTINGS` in `state.js` (fallback only).
- Blocks are shared by type: saving in the inspector rewrites `appState.library[id]`, so the requirement change hits every instance. Only `label` is per node. Saving then walks the whole model: renamed requirement ids follow into edges and pin positions, and edges that became invalid are removed.
- Link rules live in `model.js` (`verificaCompatibilita`), used both when drawing and when cleaning up after an edit.
- Layer order in `index.html` matters: edges, then round parent blocks, then nodes, so parent pins stay clickable. The temporary edge line has `pointer-events: none` so the mouse release reaches the target pin.
- `render()` also fills in missing fields on the model (`edge.waypoints`, `node.pinPositions`) and runs on every mousemove while dragging.
- Modules import each other in a cycle (`app` ↔ `renderer` ↔ `inspector` ↔ `builder` ↔ `storage`). Top level code may only look up DOM elements; never call an imported function at import time.
- The drop position of a new block ignores zoom and pan.
- `#btnReqMatrix`, `#btnDRC` and `#reportModal` exist in `index.html` but have no handlers yet.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
