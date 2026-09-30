# Modellatore di Requisiti a Blocchi (MBSE)

Browser based block diagram editor for MBSE requirements: drag blocks from a library onto an SVG canvas, wire requirement pins of the same type, and open any block to model its internals.

## Stack

- **Language / Runtime**: plain JavaScript (native ES modules, no bundler), HTML, CSS; Python 3.11 for the launcher
- **Framework**: none. Hand written SVG rendering and DOM code
- **Key dependencies**: Python standard library `http.server` (local server in `start.py`); PyInstaller (only to build the `.exe`)
- **Package manager**: none for the app; `pip` in `.venv` for PyInstaller

## Build approach

<TBD, set by /scope>

## Commands

```bash
# Install (only needed to build the exe)
pip install pyinstaller

# Dev server: serves the folder on http://localhost:8080 and opens the browser
python start.py

# Build: produces dist/start.exe from start.spec
pyinstaller start.spec

# Test
# none yet
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`.

## Rules

- No build step and no npm. Code loads straight from `index.html` via `<script type="module" src="js/app.js">`. Keep it that way unless a spec decides otherwise.
- Always open the app through `start.py` (or the exe), never via `file://`. ES modules and the `fetch` of `settings.json` and the library fail without an HTTP server.
- UI text, comments and messages are in Italian (`<html lang="it">`). Write new ones in Italian too.
- Tunable values (grid size, node size, pin radius, type colors, default library path) live in `settings.json` and are read through `appSettings`. Don't hardcode them in JS.
- Each JS file opens with a `/* --- TITLE --- */` header comment naming its job.
- Styling is mostly inline `style=""` in `index.html` and in JS template strings; `style.css` holds layout and SVG classes.

## Gotchas

- The exe serves files from its own folder, not from inside the bundle (`datas=[]` in `start.spec`). To ship it, copy `index.html`, `style.css`, `settings.json`, `js/` and `shared/` next to `start.exe`.
- On startup `start.py` creates `shared/libreria.json` with a sample block if it's missing.
- This folder is not a git repo yet, and `build/`, `dist/`, `.venv/` are generated.

## Agent skills

Declined: vanilla JS / SVG, Python http.server, PyInstaller (skill and MCP discovery)

## Context files

- [js/AGENTS.md](js/AGENTS.md): editor modules, data model (library, graph, hierarchy), file formats and the render loop

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
