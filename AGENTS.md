# Modellatore di Requisiti a Blocchi (MBSE)

Block diagram editor for MBSE requirements: drag blocks from a library onto an SVG canvas, wire requirement pins of the same type, and open any block to model its internals. Since 2.0.0 it is a Windows desktop app (Electron, TypeScript) with dockable panels, installed per user. Version 1.x (the browser app served by `start.py`, released as a zip) lives only in the tags `v1.0.*`.

## Stack

- **Language / Runtime**: TypeScript (`strict`) everywhere in `src/`: desktop shell, file API and the editor in `src/renderer/` (spec 0020). HTML, CSS. Python 3.11 only to regenerate the test oracles in `tests/unit/dati/` (against `start.py` of tag `v1.0.6`)
- **Framework**: Electron (spec 0016). No UI framework: hand written SVG rendering and DOM code
- **Key dependencies**: Electron, `dockview-core` (docking panels in the editor, spec 0021, bundled into `app.js` so it is a dev dependency), electron-builder (Windows setup, spec 0024), esbuild (compiles `src/main` and `src/preload` to `out/`), TypeScript 6.0 (pinned below 6.1 because `typescript-eslint` does not support 7 yet), ESLint with `typescript-eslint`, electron-updater (auto update, spec 0025), Vitest, Playwright (`_electron`)
- **Package manager**: npm (`package-lock.json`). npm 11 runs install scripts only for packages listed in `allowScripts` in `package.json` (Electron needs its script to download the binary: `npm approve-scripts <pkg>` after a version bump; `electron-winstaller`, pulled in by electron-builder for Squirrel, stays `false` because the setup is NSIS)

## Build approach

Tracer Bullet: each feature complete and working end to end (data, canvas, file) before the next. For v2 that means "in layers": desktop shell around today's code, then files without the server, then TypeScript, then panels, with the app always complete (from `docs/scope/index.md`).

## Commands

```bash
# Install
npm ci

# Dev: compiles src/ and opens the desktop app (F12 = developer tools); with --dev the work folder is the repo (progetti/, shared/, settings.json)
npm run dev

# Checks (CI runs all of them on every push to develop and feat/**: .github/workflows/ci.yml)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # Vitest, tests/unit/*.test.ts
npm run test:e2e    # build + Playwright on Electron, tests/e2e/*.spec.ts
npm run verifica    # all four

# Windows setup (spec 0024): electron-builder NSIS per user, in release/ (Modellatore-MBSE-Setup-<version>.exe, latest.yml)
npm run dist
```

## Branches and releases

- Feature branches `feat/<name>` start from `develop` and merge back into `develop` (`--no-ff`); CI runs there.
- `main` is what users get: merge `develop` into it only for a release. Every push to `main` runs `.github/workflows/rilascio.yml` (spec 0026): full check, setup, smoke test of the packaged app and GitHub Release `v<version>` with the setup, its `.blockmap`, `latest.yml`, `TUTORIAL.md` and the sample CSV. The version is `version` in `package.json`: bump it (plain `x.y.z`) for a new release; if the tag already exists nothing is published. Release notes come from `packaging/note/<version>.md` when present, else from the commit messages (`.github/scripts/note-rilascio.sh`). No secrets: the run's `GITHUB_TOKEN` is enough.
- Commits follow Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `test(...)`, `chore(...)`).

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title/index.md` (plus `rationale.md`, `verify.md`), or a single `docs/specs/NNNN-title.md` for a small decision. Scope in `docs/scope/index.md`, `v1-web.md`, `v2-desktop.md`.

## Rules

- `src/` is TypeScript compiled by `scripts/build.mjs` (esbuild); `tsc` only checks types. The main process is ESM (`out/main/index.mjs`), the sandboxed preload must stay CommonJS (`out/preload/index.cjs`).
- The page loads from `app://modellatore/` (spec 0016), never `file://` or a port. The protocol serves only the compiled interface in `out/renderer` (`index.html`, `benvenuto.html`, `style.css`, the bundles) plus `/settings.json` (the work folder's, else the app's defaults); every `/api/*` request goes to `src/main/api/router.ts` (spec 0018), which keeps the JSON contract of 1.x `start.py` byte for byte where it matters (responses, error codes, file format, SHA1 fingerprints, changelog entries).
- API handlers in `src/main/api/` are synchronous (`fs.*Sync`, retries wait with `Atomics.wait`): file operations never interleave, so there is no lock. Never put an `await` between reading and writing a file there.
- `serializza()` and `formaCanonica()` (`src/main/api/file.ts`) must keep producing the same bytes as Python's `json.dumps(indent=2, ensure_ascii=False)` and `json.dumps(sort_keys=True, ensure_ascii=False, separators=(',', ':'))`: a 1.x changelog compares `improntaContenuto`, and a different byte gives a false "external change" entry.
- Block diff (`confronto.ts`) and CSV reading (`csv.ts`, a literal port of `csv.Sniffer`) are checked against Python oracles: `tests/unit/dati/confronti.json` and `csv.json`, regenerated with `python tests/unit/dati/genera-*.py` only when the rules change on purpose (first `git show v1.0.6:start.py > tests/unit/dati/start.py`, gitignored).
- Keep the window locked down: `contextIsolation` on, `nodeIntegration` off, `sandbox` on; external links open in the system browser; new renderer to main calls go through the preload (`contextBridge`), never by enabling Node in the page. The only other window the page may open is `app://modellatore/popout.html` (detached panels, spec 0023), with the same settings; `src/main/finestra.ts` closes those with the main window.
- UI text, comments and messages are in Italian (`<html lang="it">`). Write new ones in Italian too.
- Tunable values (grid size, node size, pin radius, type colors, default library path) live in `settings.json` and are read through `appSettings`. Don't hardcode them in JS.
- The main process reads `progetti.versioni`, `libreria.versioni`, `cliente.maxFileMB` and `aggiornamenti` from `settings.json` only at startup (`src/main/api/impostazioni.ts`): restart the app after changing them. A new key the page uses goes in `settings.json`, in `DEFAULT_SETTINGS` and in the nested merge of `loadSettings()` in `src/renderer/state.ts`.
- Each JS and TS file opens with a `/* --- TITLE --- */` header comment naming its job.
- Styling is mostly inline `style=""` in `index.html` and in JS template strings; `style.css` holds layout and SVG classes.
- Pure logic gets a Vitest test; a user visible behavior gets a Playwright test in `tests/e2e/`. E2E tests open the app through `apriApp()` (`tests/e2e/app.ts`), which works on a temporary copy, never on the repo's `progetti/` and `shared/`.

## Gotchas

- The VS Code terminal sets `ELECTRON_RUN_AS_NODE=1`, which makes `electron.exe` run as plain Node ("does not provide an export named BrowserWindow"). `npm run dev` from that terminal fails the same way: unset it first. `tests/e2e/app.ts` removes it.
- `MODELLATORE_DATI_UTENTE` moves Electron's `userData` (localStorage, tour state, `configurazione.json`, single instance lock) to another folder; tests use it so they never clash with an open app. `MODELLATORE_CARTELLA_LAVORO` / `MODELLATORE_CARTELLA_LIBRERIE` replace the saved folders without saving them, `MODELLATORE_DOCUMENTI` moves Documents (the first launch proposal): `tests/e2e/app.ts` sets all of them, `apriApp({ senzaCartella: true })` gives a first launch.
- Data folders (spec 0019): the work folder (`progetti/`, `settings.json`) and the library folder (default `<work>\shared`) come from `configurazione.json` in `userData`, never from the app folder. A `libraryPath` starting with `shared/` points into the library folder; other relative paths are read only from the work folder. Without ready folders the window shows `benvenuto.html` and `/api/*` answers 503 `non_configurato`. The page's `settings.json` is the work folder one (the app's `settings.json` is only the defaults).
- Auto update (spec 0025): `src/main/aggiornamento.ts` wraps `electron-updater` behind the `/api/aggiornamento` contract of 1.x, so `src/renderer/aggiornamento.ts` is unchanged. It is off when not packaged; `MODELLATORE_URL_RELEASE` points it at a fake `generic` server (tests set `LOCALAPPDATA` to a temp folder, where electron-updater keeps its download cache). electron-updater is CommonJS: the ESM main bundle gets a `createRequire` banner in `scripts/build.mjs`, and it is imported by name (`import { autoUpdater }`), never as default.
- Single instance (`app.requestSingleInstanceLock()`): a second launch focuses the open window and exits. It replaces the exclusive port of 1.x.
- In Electron a blocking `beforeunload` closes nothing silently: `will-prevent-unload` in `src/main/finestra.ts` asks "Chiudi comunque / Annulla". Playwright handles that dialog itself when attached, so test it by hand.
- Electron has no `window.prompt()`: ask for a text with `chiediTesto()` (`src/renderer/utils.ts`), which goes through the preload (`ipcRenderer.sendSync`) to a modal window in `src/main/richiesta-testo.ts` and blocks the page like `prompt`. In Playwright, start the click without awaiting it, answer in the new window, then await the click (`rispondiRichiesta()` in `tests/e2e/app.ts`).
- Electron downloads (`<a download>`) open the Save As dialog; tests redirect them with `intercettaDownload()`.
- In JavaScript regexes the `m` flag treats `
` as a line end, Python's `re.MULTILINE` does not: when porting a Python regex with `^`/`$`, spell them out (see `csv.ts`).
- The user tutorial is `packaging/TUTORIAL.md` (with `packaging/esempi/`), shipped with every Release (`{VERSIONE}` replaced): keep it in step with UI changes. User docs are in `docs/guida/`.
- Installed 1.x copies keep checking `releases/latest`: a 2.x Release has no zip, so their banner only offers "Apri la pagina della versione" and shows the Release notes. Explain the move from 1.x (setup, then Impostazioni › Importa dalla versione 1) in the notes of a major release.
- The setup packs only `out/` (no sourcemaps), `settings.json` and `package.json` (`build.files` in `package.json`), plus `packaging/esempi` as `resources/esempi`. Anything else the app needs at runtime must be added there. The CI job `setup` (push to `develop` only) installs it silently, launches it through `tests/e2e/installato.spec.ts` (skipped unless `MODELLATORE_ESEGUIBILE_INSTALLATO` is set) and checks that uninstalling keeps `userData`.
- `.venv/`, `node_modules/`, `out/`, `release/`, `test-results/`, `playwright-report/` are generated; `progetti/` is user data and is gitignored.
- Word and PDF export (spec 0028) live in `src/main/documenti/`: the page sends the document's Markdown, the company template (`documentiExport.modello`), the revisions and the diagrams over `desktop.documenti.esporta` (preload, `ipcRenderer.invoke`); `markdown.ts` reads it into blocks, `docx.ts` writes the `.docx` by hand (zip from `zip-scrittura.ts`), `esporta.ts` prints the PDF from `html.ts` in a hidden window with JavaScript off, loaded from `app://modellatore/stampa/<id>.html`, which the protocol serves from memory (`registraPaginaStampa`). The bytes go back to the page, which downloads them like the `.md`.
- The API (`src/main/api/`) answers `/api/progetti`, `/api/ultimo`, `/api/libreria/{apri,salva,elimina,rinomina,changelog}`, `/api/cliente/leggi` and `/api/aggiornamento` (+ `/installa`). It writes only in `progetti/` (projects, `_versioni/`, `_cestino/`) of the work folder and in the library folder (libraries, `.changelog.json`, `_versioni/`).

## Agent skills

Declined: vanilla JS / SVG, Electron, esbuild, Vitest, Playwright, dockview, electron-builder (skill and MCP discovery)

## Context files

- [src/renderer/AGENTS.md](src/renderer/AGENTS.md): editor modules, data model (library, graph, hierarchy), file formats and the render loop

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
