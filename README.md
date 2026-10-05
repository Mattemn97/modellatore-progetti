# Modellatore di Requisiti a Blocchi (MBSE)

Un programma desktop per Windows per descrivere un sistema come un insieme di blocchi annidati, collegati da fili che rappresentano i requisiti. Parti dai requisiti del cliente, li fai scendere fino ai blocchi che li soddisfano e alla fine ottieni la matrice di tracciabilità e i documenti formali MIL-STD-498 (SSS, SSDD, IRS, IDD, SRS, SDD) in Markdown.

MBSE sta per Model Based Systems Engineering: invece di scrivere i requisiti in tanti documenti separati, costruisci un modello unico e i documenti nascono da quello.

Il programma lavora in locale, per una persona alla volta, sul tuo computer. Non serve internet (solo per il controllo degli aggiornamenti) e non servono diritti di amministratore.

## Cosa puoi fare

| Funzionalità | In breve | Guida |
|---|---|---|
| Editor a blocchi | Trascini blocchi dalla libreria sul canvas, li colleghi con fili, entri dentro un blocco per modellarne l'interno | [Interfaccia e canvas](docs/guida/03-interfaccia-e-canvas.md) |
| Pannelli agganciabili | Sposti, impili e ridimensioni i pannelli come in un IDE, li stacchi in finestre separate anche su un altro monitor; la disposizione si ricorda | [Tutorial](packaging/TUTORIAL.md#parte-3-conoscere-la-finestra) |
| Libreria dei blocchi | Crei e modifichi blocchi riutilizzabili con i loro requisiti; ogni modifica avanza una versione e finisce in un changelog | [Libreria](docs/guida/04-libreria.md) |
| Progetti con salvataggio automatico | Ogni modifica si salva da sola su disco, con Annulla e Ripeti fino a 3 passi | [Progetti](docs/guida/05-progetti.md) |
| Requisiti cliente | Importi le frasi del cliente da Excel o CSV, anche migliaia, e le colleghi al modello | [Requisiti cliente](docs/guida/06-requisiti-cliente.md) |
| Filtri | Attenui o nascondi blocchi e fili per classe, documento, categoria e sottocategoria | [Filtri](docs/guida/07-filtri.md) |
| Controllo di coerenza | Vedi subito quali requisiti non sono ancora collegati o coperti | [Coerenza](docs/guida/08-coerenza.md) |
| Gerarchia dei requisiti | Scegli un requisito e vedi tutti i suoi antenati e discendenti, su tutti i livelli | [Gerarchia](docs/guida/09-gerarchia.md) |
| Ispettore dei collegamenti | Clicchi un filo e vedi i due requisiti che collega | [Interfaccia e canvas](docs/guida/03-interfaccia-e-canvas.md#ispettore-dei-collegamenti) |
| Matrice di tracciabilità | Tabella padre e figli, filtrabile ed esportabile in Markdown | [Matrice](docs/guida/10-matrice.md) |
| Documenti MIL-STD-498 | Generi un documento Markdown con i capitoli del DID e i testi dei requisiti al posto giusto | [Documenti](docs/guida/11-documenti.md) |

## Avvio rapido

1. Scarica `Modellatore-MBSE-Setup-<versione>.exe` dalla pagina Releases del repository (accanto c'è `TUTORIAL.md`, una guida passo passo).
2. Avvialo: si installa solo per te, senza diritti di amministratore, e crea i collegamenti nel menu Start e sul desktop.
3. Al primo avvio conferma la cartella di lavoro (di solito `Documenti\Modellatore MBSE`): lì finiscono progetti, librerie e impostazioni.

Windows SmartScreen potrebbe avvisarti che il setup non è riconosciuto: clicca "Ulteriori informazioni" e poi "Esegui comunque". Il programma si aggiorna da solo: quando esce una versione nuova te lo dice con un banner.

Usavi la versione 1 (lo zip con `start.exe`)? Installa la 2 e da **⚙ Impostazioni › Importa dalla versione 1…** copi i tuoi dati, senza toccare la vecchia cartella.

Tutti i dettagli sono in [Installazione e avvio](docs/guida/02-installazione-e-avvio.md).

## Da dove cominciare a leggere

Se non hai mai visto l'app, ti consiglio questo ordine:

1. [Concetti di base](docs/guida/01-concetti.md): blocchi, requisiti di interfaccia e di capacità, livelli, fili. Dieci minuti che ti fanno capire tutto il resto.
2. [Installazione e avvio](docs/guida/02-installazione-e-avvio.md)
3. [Interfaccia e canvas](docs/guida/03-interfaccia-e-canvas.md)
4. [Un percorso di lavoro completo](docs/guida/00-indice.md#un-percorso-di-lavoro-tipico), dal file del cliente al documento finale.

L'indice completo della guida è in [docs/guida/00-indice.md](docs/guida/00-indice.md).

## Com'è fatto il repository

```
src/main/           processo desktop (Electron): finestra, protocollo app://, API dei file, aggiornamento
src/preload/        il ponte sicuro tra la pagina e il processo desktop
src/renderer/       l'editor: HTML, CSS e moduli TypeScript (canvas, pannelli, libreria, matrice, documenti…)
settings.json       valori predefiniti (griglia, colori, documenti, limiti); quello vero sta nella cartella di lavoro
scripts/build.mjs   compilazione con esbuild in out/
packaging/          tutorial, file di esempio e note delle Release
tests/              test unitari (Vitest) ed end to end sull'app desktop (Playwright)
.github/            CI su develop e rilascio su main
docs/guida/         la documentazione per chi usa il programma
docs/specs/         le specifiche di ogni funzionalità, con le decisioni prese
docs/scope/         il piano delle funzionalità e il loro stato
```

## Per chi sviluppa

Ti serve Node.js 24.

```bash
npm ci              # dipendenze
npm run dev         # compila e apre il programma; la cartella di lavoro è il repository (F12: strumenti per sviluppatori)
npm run verifica    # tipi, lint, test unitari ed end to end
npm run dist        # setup Windows in release/
```

* `develop` è il ramo di integrazione: ogni funzionalità parte da lì in un `feat/<nome>` e ci torna con un merge; la CI gira a ogni push.
* `main` è quello che ricevono gli utenti: un push su `main` pubblica la Release `v<version di package.json>` con setup, `latest.yml` (per l'aggiornamento automatico) e tutorial. Per un rilascio nuovo alza `version`; le note stanno in `packaging/note/<versione>.md`. Non servono segreti oltre al token di GitHub Actions.
* Testi dell'interfaccia, commenti e messaggi sono in italiano.
* Il contesto tecnico (moduli, modello dati, convenzioni, trappole note) è in [AGENTS.md](AGENTS.md) e [src/renderer/AGENTS.md](src/renderer/AGENTS.md); il perché di ogni scelta è in [docs/specs/](docs/specs/).

## Limiti noti

* Una persona alla volta: la libreria non è pensata per essere modificata da più persone insieme su una cartella di rete.
* I documenti si esportano solo in Markdown (niente Word o PDF).
* Dai file Excel si leggono `.xlsx` e `.xlsm`, non i vecchi `.xls` né i file protetti da password; le date arrivano come numeri di Excel.
* La libreria non ha un Annulla dentro l'app: ci sono le copie di sicurezza in `shared/_versioni/`, da ripristinare a mano.
