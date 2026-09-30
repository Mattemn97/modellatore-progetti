# Editor modules (js/)

## Overview

All app logic. Modules share one mutable global state from `state.js`; any change mutates that state and then calls `render()`, which rebuilds the whole SVG canvas from scratch.

## Key files

| File | Owns |
|---|---|
| `app.js` | Entry point: `initApp()`, wires every toolbar button, canvas drop, breadcrumb (`renderUI`) |
| `state.js` | `appState` (library, workspace, filters), `pathStack`, `activeNodeId`, `loadSettings()` with fallback defaults |
| `renderer.js` | `render()`, zoom and pan, node drag and resize, pin drag, edge drawing, waypoints, entering a block |
| `inspector.js` | Right panel form: create, edit, copy a library block and its requirements; delete a node |
| `builder.js` | Left panel library tree grouped by `category`, search, `loadLibraryFromPath()` |
| `storage.js` | Export of the three JSON files and import of library or standalone project |

## Data model

- Library: `{ [typeId]: { name, category, requirements: [{ id, title, description, type }] } }`. `category` like `"Elettrica/Controllo"` is shown as a folder.
- Graph: `{ nodes, edges }`. Node: `{ id, type, label, width, height, position: {x, y}, internal_graph, pinPositions? }`. `type` is the library `typeId`.
- Edge: `{ id, source, sourceHandle, sourceType, target, targetHandle, targetType, waypoints }`. `*Handle` is a requirement id; `*Type` is `'node'` or `'parent'` (a pin on the parent bar at the top of an inner level).
- Hierarchy: each node holds its own `internal_graph`. `pathStack` is the breadcrumb of open levels; `pathStack[0].graph` is the root workspace; `getCurrentLevel()` is the level on screen.
- File formats: `modello.json` = `{ workspace }`, `libreria.json` = `{ library }`, `standalone.json` = `{ library, workspace }`. Library loaders accept both `{ library: {...} }` and a bare map (as in `shared/libreria.json`).

## Conventions

- Mutate state in place, then call `render()` (and `initLibrary()` when the library changed). There is no store or event bus.
- Replace `pathStack` contents in place (`length = 0` then `push`), never reassign it: other modules hold the imported binding.
- Canvas coordinates go through `getCanvasCoords()`, which undoes zoom and pan and snaps to `appSettings.grid.size`.
- New ids use a prefix plus `Date.now()` or `Math.random()` (`edge_`, `req_`, `node_`). Library `typeId` comes from `slugifyId(label)`.
- User feedback uses `alert()` and `confirm()`, in Italian.

## Gotchas

- Requirement types (Elettrica, Segnale, Meccanica, Fluidica) are listed in four places: `settings.json` `typeColors`, the filter `<select>` in `index.html`, the type `<select>` in `inspector.js`, and the fallback in `state.js`. Adding a type means updating all four.
- Blocks are shared by type: saving in the inspector rewrites `appState.library[typeId]`, so the requirement change hits every instance. Only `label` is per node.
- Edges only connect pins of the same requirement type (checked on mouseup in `createReqPin`).
- Parent bar pin positions are hardcoded (`x = 250 + idx * 120`, `y = 32`) in both `renderParentBoundary` and `getParentReqCoords`. Change them together.
- `render()` also fills in missing fields on the model (`edge.waypoints`, `node.pinPositions`) and runs on every mousemove while dragging.
- Modules import each other in a cycle (`app` ↔ `renderer` ↔ `inspector` ↔ `builder` ↔ `storage`). Top level code may only look up DOM elements; never call an imported function at import time.
- `innerHTML` templates interpolate library text without escaping, so a name with `"` or `<` breaks the inspector form.
- Node ids use `Math.random() * 100000` and can collide in a large model.
- `#btnReqMatrix`, `#btnDRC` and `#reportModal` exist in `index.html` but have no handlers yet.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
