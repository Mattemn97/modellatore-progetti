# Modellatore di Requisiti a Blocchi (MBSE)

Block diagram editor for MBSE requirements: drag blocks from a library onto an SVG canvas, wire requirement pins of the same type, and open any block to model its internals. Version 2 (branch `develop`) turns it into a Windows desktop app in TypeScript with dockable panels; version 1.x (branch `main`) is the browser app served by `start.py`.

## Stack

- **Language / Runtime**: TypeScript (`strict`) for the desktop shell and the file API in `src/`; the editor in `js/` is still plain JavaScript ES modules until scope item 23 moves it to TypeScript. HTML, CSS. Python 3.11 only for the 1.x `start.py` (and to regenerate the test oracles in `tests/unit/dati/`)
- **Framework**: Electron (spec 0016). No UI framework: hand written SVG rendering and DOM code
- **Key dependencies**: Electron, esbuild (compiles `src/main` and `src/preload` to `out/`), TypeScript 6.0 (pinned below 6.1 because `typescript-eslint` does not support 7 yet), ESLint with `typescript-eslint`, Vitest, Playwright (`_electron`). 1.x only: `http.server`, `rich`, PyInstaller from `requirements.txt`
- **Package manager**: npm (`package-lock.json`). npm 11 runs install scripts only for packages listed in `allowScripts` in `package.json` (Electron needs its script to download the binary: `npm approve-scripts <pkg>` after a version bump)

## Build approach

Tracer Bullet: each feature complete and working end to end (data, canvas, file) before the next. For v2 that means "in layers": desktop shell around today's code, then files without the server, then TypeScript, then panels, with the app always complete (from `docs/scope/index.md`).

## Commands

```bash
# Install
npm ci

# Dev: compiles src/ and opens the desktop app (F12 = developer tools); data in the repo's progetti/ and shared/
npm run dev

# Checks (CI runs all of them on every push to develop and feat/**: .github/workflows/ci.yml)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (js/ excluded until scope item 23)
npm test            # Vitest, tests/unit/*.test.ts
npm run test:e2e    # build + Playwright on Electron, tests/e2e/*.spec.ts
npm run verifica    # all four

# 1.x (main): browser app on http://localhost:8080, exe and zip, release on every push to main
python start.py
pyinstaller start.spec
powershell -ExecutionPolicy Bypass -File packaging/crea-pacchetto.ps1 -Versione 1.0.0
```

## Branches and releases

- Feature branches `feat/<name>` start from `develop` and merge back into `develop` (`--no-ff`); CI runs there.
- `main` stays 1.x until the v2 epic is complete: every push to `main` runs `.github/workflows/rilascio.yml`, which builds, smoke tests and publishes GitHub Release v<last tag patch+1> (notes from the commit message, `.github/scripts/note-rilascio.sh`). Never merge `develop` into `main` before scope item 30.
- Commits follow Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `test(...)`, `chore(...)`).

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title/index.md` (plus `rationale.md`, `verify.md`). Scope in `docs/scope/index.md`, `v1-web.md`, `v2-desktop.md`.

## Rules

- `src/` is TypeScript compiled by `scripts/build.mjs` (esbuild); `tsc` only checks types. The main process is ESM (`out/main/index.mjs`), the sandboxed preload must stay CommonJS (`out/preload/index.cjs`).
- The page loads from `app://modellatore/` (spec 0016), never `file://` or a port. The protocol serves only `index.html`, `style.css`, `settings.json` and `js/` from the app folder; every `/api/*` request goes to `src/main/api/router.ts` (spec 0018), which keeps the JSON contract of `start.py` byte for byte where it matters (responses, error codes, file format, SHA1 fingerprints, changelog entries).
- API handlers in `src/main/api/` are synchronous (`fs.*Sync`, retries wait with `Atomics.wait`): file operations never interleave, so there is no lock. Never put an `await` between reading and writing a file there.
- `serializza()` and `formaCanonica()` (`src/main/api/file.ts`) must keep producing the same bytes as Python's `json.dumps(indent=2, ensure_ascii=False)` and `json.dumps(sort_keys=True, ensure_ascii=False, separators=(',', ':'))`: a 1.x changelog compares `improntaContenuto`, and a different byte gives a false "external change" entry.
- Block diff (`confronto.ts`) and CSV reading (`csv.ts`, a literal port of `csv.Sniffer`) are checked against Python oracles: `tests/unit/dati/confronti.json` and `csv.json`, regenerated with `python tests/unit/dati/genera-*.py` only when the rules change on purpose.
- Keep the window locked down: `contextIsolation` on, `nodeIntegration` off, `sandbox` on; external links open in the system browser; new renderer to main calls go through the preload (`contextBridge`), never by enabling Node in the page.
- UI text, comments and messages are in Italian (`<html lang="it">`). Write new ones in Italian too.
- Tunable values (grid size, node size, pin radius, type colors, default library path) live in `settings.json` and are read through `appSettings`. Don't hardcode them in JS.
- `start.py` also reads `progetti.versioni` and `libreria.versioni` from `settings.json`, only at startup: restart the app after changing them. A new key goes in `settings.json`, in `DEFAULT_SETTINGS` and in the nested merge of `loadSettings()` in `js/state.js`.
- Each JS and TS file opens with a `/* --- TITLE --- */` header comment naming its job.
- Console output in `start.py` goes through `stampa_info`, `stampa_avviso`, `stampa_errore` and `stampa_avvio`, never bare `print`: they use `rich` when present and fall back to plain text (spec 0014). Successful HTTP requests are not logged.
- Styling is mostly inline `style=""` in `index.html` and in JS template strings; `style.css` holds layout and SVG classes.
- Pure logic gets a Vitest test; a user visible behavior gets a Playwright test in `tests/e2e/`. E2E tests open the app through `apriApp()` (`tests/e2e/app.ts`), which works on a temporary copy, never on the repo's `progetti/` and `shared/`.

## Gotchas

- The VS Code terminal sets `ELECTRON_RUN_AS_NODE=1`, which makes `electron.exe` run as plain Node ("does not provide an export named BrowserWindow"). `npm run dev` from that terminal fails the same way: unset it first. `tests/e2e/app.ts` removes it.
- `MODELLATORE_DATI_UTENTE` moves Electron's `userData` (localStorage, tour state, single instance lock) to another folder; tests use it so they never clash with an open app.
- Single instance (`app.requestSingleInstanceLock()`): a second launch focuses the open window and exits. It replaces the exclusive port of 1.x.
- In Electron a blocking `beforeunload` closes nothing silently: `will-prevent-unload` in `src/main/finestra.ts` asks "Chiudi comunque / Annulla". Playwright handles that dialog itself when attached, so test it by hand.
- Electron has no `window.prompt()`: ask for a text with `chiediTesto()` (`js/utils.js`), which goes through the preload (`ipcRenderer.sendSync`) to a modal window in `src/main/richiesta-testo.ts` and blocks the page like `prompt`. In Playwright, start the click without awaiting it, answer in the new window, then await the click (`rispondiRichiesta()` in `tests/e2e/app.ts`).
- Electron downloads (`<a download>`) open the Save As dialog; tests redirect them with `intercettaDownload()`.
- In JavaScript regexes the `m` flag treats `` as a line end, Python's `re.MULTILINE` does not: when porting a Python regex with `^`/`$`, spell them out (see `csv.ts`).
- 1.x: the exe serves files from its own folder, not from inside the bundle (`datas=[]` in `start.spec`). To ship it, copy `index.html`, `style.css`, `settings.json`, `js/` and `shared/` next to `start.exe`.
- 1.x: the package (`packaging/crea-pacchetto.ps1`) ships `shared/` and `progetti/` empty on purpose, so extracting an update over an install never overwrites user data; `start.exe` fills them. It ships `settings.json` only as `settings.predefinite.json`: `start.py` copies it to `settings.json` when missing and never rewrites an existing one. `PERCORSI_UTENTE` in `start.py` lists the user owned paths; the package script reads it and fails if the package contains any of them (spec 0013). The user tutorial is `packaging/TUTORIAL.md` (with `packaging/esempi/`), keep it in step with UI changes. A new file the app needs at runtime must be added to the copy list there.
- On startup `start.py` creates `shared/libreria.json` with a sample block if it's missing.
- 1.x self update (spec 0015): at startup `start.exe` checks the latest GitHub Release in a thread (skipped when `VERSIONE.txt` is missing, i.e. `python start.py`). Installing downloads into `_aggiornamento/` (app scratch, removed a minute after the next start), checks the asset SHA256 `digest`, replaces only the files in the zip (never `PERCORSI_UTENTE`), restarts with `--dopo-aggiornamento` and rolls back with `--dopo-ripristino` if the new exe does not answer. Test it against a fake Release server with the `MODELLATORE_URL_RELEASE` env var. Keep any thread that must outlive the HTTP server non daemon (request threads are daemon).
- 1.x: the server binds its port exclusively (`ServerApp`, `SO_EXCLUSIVEADDRUSE` on Windows): a second `start.exe` fails with a message instead of sharing the port.
- `build/`, `dist/`, `.venv/`, `node_modules/`, `out/`, `release/`, `test-results/`, `playwright-report/` are generated; `progetti/` is user data and is gitignored.
- 1.x: `start.py` is also the API: `/api/progetti`, `/api/ultimo`, `/api/libreria/{apri,salva,elimina,rinomina,changelog}`, `/api/cliente/leggi` and `/api/aggiornamento` (+ `/installa`), multithreaded, with one lock serializing every file operation (the update state has its own lock). The app writes only in `progetti/` (projects, `_versioni/`, `_cestino/`) and in `shared/` (libraries, `.changelog.json`, `_versioni/`). The exe creates `progetti/` next to itself.

## Agent skills

Declined: vanilla JS / SVG, Python http.server, PyInstaller, rich, Electron, esbuild, Vitest, Playwright (skill and MCP discovery)

## Context files

- [js/AGENTS.md](js/AGENTS.md): editor modules, data model (library, graph, hierarchy), file formats and the render loop

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
