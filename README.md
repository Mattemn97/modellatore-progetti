# Modellatore di Requisiti a Blocchi (MBSE)

Un editor che gira nel browser per descrivere un sistema come un insieme di blocchi annidati, collegati da fili che rappresentano i requisiti. Parti dai requisiti del cliente, li fai scendere fino ai blocchi che li soddisfano e alla fine ottieni la matrice di tracciabilità e i documenti formali MIL-STD-498 (SSS, SSDD, IRS, IDD, SRS, SDD) in Markdown.

MBSE sta per Model Based Systems Engineering: invece di scrivere i requisiti in tanti documenti separati, costruisci un modello unico e i documenti nascono da quello.

L'app lavora in locale, per una persona alla volta, sul tuo computer. Non serve internet e non serve installare nulla oltre all'app stessa.

## Cosa puoi fare

| Funzionalità | In breve | Guida |
|---|---|---|
| Editor a blocchi | Trascini blocchi dalla libreria sul canvas, li colleghi con fili, entri dentro un blocco per modellarne l'interno | [Interfaccia e canvas](docs/guida/03-interfaccia-e-canvas.md) |
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

### Se hai il pacchetto pronto (Windows)

1. Scarica `ModellatoreMBSE-<versione>.zip` dalla pagina Releases del repository. Dentro c'è `TUTORIAL.md`, una guida passo passo per iniziare.
2. Estrai tutto in una cartella a tua scelta.
3. Fai doppio clic su `start.exe`. Si apre una finestra nera (è il piccolo server locale) e poi il browser su `http://localhost:8080`.
4. Per chiudere l'app chiudi la finestra nera.

Windows SmartScreen potrebbe avvisarti che l'app non è riconosciuta: clicca "Ulteriori informazioni" e poi "Esegui comunque".

### Se parti dal codice sorgente

Ti serve Python 3.11 (va bene anche una versione vicina). Poi, dalla cartella del repository:

```bash
python start.py
```

Il server parte su `http://localhost:8080` e apre il browser da solo.

Apri sempre l'app così, mai facendo doppio clic su `index.html`: il browser blocca i moduli JavaScript e la lettura dei file quando la pagina arriva da `file://`.

Trovi tutti i dettagli (cartelle dei dati, aggiornamenti, porta occupata) in [Installazione e avvio](docs/guida/02-installazione-e-avvio.md).

## Da dove cominciare a leggere

Se non hai mai visto l'app, ti consiglio questo ordine:

1. [Concetti di base](docs/guida/01-concetti.md): blocchi, requisiti di interfaccia e di capacità, livelli, fili. Dieci minuti che ti fanno capire tutto il resto.
2. [Installazione e avvio](docs/guida/02-installazione-e-avvio.md)
3. [Interfaccia e canvas](docs/guida/03-interfaccia-e-canvas.md)
4. [Un percorso di lavoro completo](docs/guida/00-indice.md#un-percorso-di-lavoro-tipico), dal file del cliente al documento finale.

L'indice completo della guida è in [docs/guida/00-indice.md](docs/guida/00-indice.md).

## Com'è fatto il repository

```
index.html          la pagina dell'app
style.css           stili del layout e del canvas
settings.json       valori regolabili (griglia, colori, documenti, limiti)
js/                 tutta la logica dell'app, moduli JavaScript senza build
start.py            server locale e API dei file (solo libreria standard di Python)
start.spec          ricetta PyInstaller per creare start.exe
packaging/          script che crea lo zip di distribuzione, il tutorial e i file di esempio
.github/            rilascio automatico su GitHub a ogni push su main o tag v*
shared/             librerie dei blocchi (dati, condivise tra progetti)
progetti/           i tuoi progetti (dati, creata al primo avvio, non versionata)
docs/guida/         questa documentazione per chi usa l'app
docs/specs/         le specifiche di ogni funzionalità, con le decisioni prese
docs/scope/         il piano delle funzionalità e il loro stato
```

L'app non ha dipendenze esterne: niente npm, niente bundler, niente framework. Il browser carica i moduli direttamente da `index.html`, e il server usa solo la libreria standard di Python.

## Per chi sviluppa

Comandi utili:

```bash
# Avvia l'app in sviluppo (server su http://localhost:8080)
python start.py

# Crea start.exe (serve PyInstaller: pip install pyinstaller)
pyinstaller start.spec

# Crea il pacchetto zip in dist/
powershell -ExecutionPolicy Bypass -File packaging/crea-pacchetto.ps1 -Versione 1.0.0

# Pubblica una release: basta un push su main (merge o commit diretto).
# Il workflow compila, prova l'avvio dell'exe e crea la Release v<ultima patch + 1>
# con lo zip e il messaggio del commit come descrizione
git push origin main

# Per alzare minor o major pubblica tu il tag: i rilasci successivi partono da lì
git tag v2.0.0 && git push origin v2.0.0
```

Qualche regola del progetto che ti conviene conoscere:

* Testi dell'interfaccia, commenti e messaggi sono in italiano.
* I valori regolabili stanno in `settings.json`, non nel codice. Trovi l'elenco in [Impostazioni e file](docs/guida/12-impostazioni-e-file.md).
* Non c'è un test runner: ogni funzionalità è verificata guidando l'app vera contro i criteri di accettazione della sua specifica (`docs/specs/NNNN-*/verify.md`).
* Il contesto tecnico per chi mette mano al codice (moduli, modello dati, convenzioni, trappole note) è in [AGENTS.md](AGENTS.md) e [js/AGENTS.md](js/AGENTS.md).
* Il perché di ogni scelta è nelle specifiche in [docs/specs/](docs/specs/), una cartella per funzionalità.

## Limiti noti

* Una persona alla volta: la libreria non è pensata per essere modificata da più persone insieme su una cartella di rete.
* I documenti si esportano solo in Markdown (niente Word o PDF).
* Dai file Excel si leggono `.xlsx` e `.xlsm`, non i vecchi `.xls` né i file protetti da password; le date arrivano come numeri di Excel.
* La libreria non ha un Annulla dentro l'app: ci sono le copie di sicurezza in `shared/_versioni/`, da ripristinare a mano.
