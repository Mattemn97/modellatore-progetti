# Verify: Libreria su disco con changelog · spec 0002 · updated 2026-09-30
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Before you start: make a copy of `shared/` so you can restore it afterwards. Start the app with `python start.py`.

## UI / manual
- [ ] With `shared/libreria.json` in the old format and no changelog, start the app → `shared/libreria.changelog.json` appears with one `iniziale` entry `1.0.0`; `libreria.json` is byte for byte unchanged; the panel shows `v1.0.0` → AC-9, AC-13
- [ ] Open `centralina`, add a requirement, press Salva → message "Blocco salvato. Libreria v1.1.0 (minor)."; the file is `{ formatVersion: 1, versione: "1.1.0", library }`; `shared/_versioni/libreria.1.json` exists; the panel shows `v1.1.0` → AC-1, AC-3, AC-4, AC-10, AC-13
- [ ] Restart `start.py` and reload the page → the requirement is still there, the version is still `v1.1.0` → AC-1
- [ ] Open the changelog: the newest entry has date and time, Windows user name, origine `App`, livello `Minor`, block `centralina` and the requirement `aggiunto` → AC-3, AC-12
- [ ] Rename the id of a requirement that is wired in the project, pick Livello `Patch`, Salva → version `2.0.0`, the entry shows `rinominato` with the previous id, the wire follows the new id and the project file on disk updates → AC-1, AC-3, AC-4
- [ ] Reopen a block and press Salva without changes → "Nessuna modifica da salvare"; no file changes (same bytes, same number of copies) → AC-5
- [ ] Type "Richiesta cliente 12" in Motivo della modifica, change a title, Salva → the entry's nota is the text; after the save Livello is back to Automatico and Motivo is empty → AC-6
- [ ] Stop `start.py`, change a title, Salva → error message; the form keeps the new title; the tree still shows the old one. Restart and Salva → it works → AC-2
- [ ] With the app open, edit by hand the description of another block in `libreria.json`, then Salva a block → red banner "La libreria è cambiata su disco" with Ricarica la libreria and Sovrascrivi; the Salva button is disabled → AC-7
- [ ] Choose Sovrascrivi → the changelog has an `esterna` entry (patch, block with `descrizione`) followed by yours; the hand edited block keeps its description → AC-7, AC-8
- [ ] Repeat the conflict and choose Ricarica la libreria → the block reopens with the disk content, only the form changes are lost → AC-7
- [ ] Put the project in Conflitto (edit its file by hand, wait for the autosave), then Salva a block → "Risolvi prima il conflitto del progetto", no library file touched → AC-7
- [ ] With the app closed, delete a requirement from `libreria.json` by hand, start → yellow notice "La libreria è stata modificata fuori dall'app: registrata come versione X"; `major` entry with the requirement `rimosso`; `libreria.json` not rewritten → AC-8
- [ ] Re-indent `libreria.json`, save it with Windows line endings and change only its `versione` field, reload → no `esterna` entry → AC-8
- [ ] Salva 4 times → `_versioni/` never holds more than 3 copies (`libreria.1..3.json`) plus `libreria.riferimento.json` → AC-10
- [ ] Load `docs/<some library>.json` with 🔄 (copy one there first) → label `Sola lettura` with the reason on hover; Salva and Crea copia disabled with the reason as tooltip; dragging blocks to the canvas still works; version `n/d` (or the file's `versione`) → AC-11
- [ ] Load `https://example.com/lib.json` or any web address → read only, version `n/d`, Changelog button disabled → AC-11
- [ ] Corrupt `shared/libreria.changelog.json`, reload → library opens read only with the notice "Il changelog non è leggibile…" → AC-11
- [ ] Load `shared/inesistente.json` with 🔄 → error message; the previous library stays; a Salva still writes to the previous file → AC-2, AC-11
- [ ] In the Changelog window type an id of a requirement of another block → only entries touching it; open Storia from a block → window already filtered on that block → AC-12
- [ ] After a Salva, open another project that uses a different library → no confirmation about the library → AC-15

## Commands
- [ ] `curl -X POST -H "Content-Type: application/json" -d "{\"percorso\":\"../settings.json\"}" http://localhost:8080/api/libreria/salva` → 400 `percorso_non_valido` → AC-14
- [ ] Same with `settings.json` → 403 `percorso_non_scrivibile`; `shared/_versioni/libreria.1.json` → 403; `shared/libreria.changelog.json` → 400 → AC-14
- [ ] A `salva` whose block uses a requirement id of another block → 400 `id_duplicato`, no file touched → AC-14
- [ ] `GET /api/libreria/apri` → 405; `POST` without `Content-Type: application/json` → 415 → AC-14

## Value sourcing
- [ ] Salva `livello`: pick Minor on a title only change → calcolato patch, effettivo minor, version `M.(m+1).0`
- [ ] Salva `nota`: surrounding spaces are trimmed; 2001 characters are refused by the input (maxlength)
- [ ] Voce `data`: shown in local time with `it-IT` format; the file holds ISO 8601 with offset
- [ ] Voce `autore`: matches your Windows user name
- [ ] Voce `impronta` / `improntaContenuto`: after a Salva, the last entry's values match the SHA1 of the file bytes and of the canonical `library`
- [ ] Copie di sicurezza: set `"libreria": { "versioni": 1 }` in `settings.json`, restart, Salva twice → only `libreria.1.json`
- [ ] Percorso normalizzato: `.\shared\libreria.json` and `/shared/libreria.json?x=1` in the path box both open the same writable library
- [ ] Voce iniziale versione: a library file with `"versione": "2.3.4"` and no changelog → iniziale `2.3.4`; with an invalid value → `1.0.0`
- [ ] Sovrascrivi corpo: after Sovrascrivi the saved block is the one you had in the form, not the disk one

## Acceptance-criteria coverage
- AC-1 … steps 2, 3, 5 · AC-2 … steps 8, 19 · AC-3 … steps 2, 4, 5 · AC-4 … steps 2, 5, value sourcing livello · AC-5 … step 6 · AC-6 … step 7 · AC-7 … steps 9 to 12 · AC-8 … steps 10, 13, 14 · AC-9 … step 1 · AC-10 … steps 2, 15 · AC-11 … steps 16 to 19 · AC-12 … steps 4, 20 · AC-13 … steps 1, 2 · AC-14 … commands · AC-15 … step 21
