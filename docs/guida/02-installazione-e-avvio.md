# 2. Installazione e avvio

Il Modellatore è un programma desktop per Windows. Legge e scrive direttamente i file dei progetti e delle librerie nella tua cartella di lavoro: non c'è un server, non c'è un browser, non serve internet (solo il controllo degli aggiornamenti la usa, se c'è).

## Cosa ti serve

* Windows 10 o 11, 64 bit.
* Circa 300 MB liberi. Non servono diritti di amministratore.

## Installazione

1. Scarica dalla pagina Releases del repository il file `Modellatore-MBSE-Setup-<versione>.exe`.
2. Fai doppio clic. L'installazione è per il solo utente: Windows non chiede conferme di sicurezza (UAC), dura pochi secondi e non fa domande.
3. Trovi **Modellatore MBSE** nel menu Start e sul desktop.

Windows SmartScreen potrebbe dirti che il setup non è riconosciuto, perché non è firmato. Clicca "Ulteriori informazioni" e poi "Esegui comunque".

Il programma finisce in `%LOCALAPPDATA%\Programs\modellatore-mbse\`. Lì c'è anche `resources\esempi\` con un file di requisiti cliente di prova. I tuoi dati non stanno lì.

Per disinstallare: Impostazioni di Windows › App › App installate › Modellatore MBSE › Disinstalla. Cartella di lavoro, configurazione e disposizione dei pannelli restano; se reinstalli, il programma li ritrova.

## Primo avvio

Al primo avvio il programma ti propone una cartella di lavoro, di solito `Documenti\Modellatore MBSE`. Confermando la crea con:

* `progetti/`, dove finiscono i progetti;
* `shared/`, la cartella delle librerie, con una libreria di esempio `libreria.json` che contiene un solo blocco, "Centralina Condivisa";
* `settings.json` con i valori predefiniti.

Poi crea e apre "Nuovo progetto" con il canvas vuoto, e parte il tour guidato.

Agli avvii successivi riapre l'ultimo progetto su cui hai lavorato, con la sua libreria e i pannelli come li avevi lasciati. Se la cartella di lavoro non c'è più (un disco esterno scollegato, una cartella spostata) ti mostra la pagina di benvenuto per sceglierne un'altra o crearla.

Il programma ha una sola finestra principale: se lo lanci di nuovo, torna in primo piano quella già aperta.

## Dove finiscono i tuoi dati

| Cartella | Contenuto |
|---|---|
| `progetti/` | Un file `.json` per progetto, più `_ultimo.json` (l'ultimo aperto) |
| `progetti/_versioni/` | Le ultime versioni di ogni progetto, usate da Annulla |
| `progetti/_cestino/` | I progetti che hai eliminato dal menu |
| `shared/` | Le librerie dei blocchi e, accanto a ciascuna, il suo `.changelog.json` |
| `shared/_versioni/` | Le copie di sicurezza di ogni libreria e il riferimento usato per riconoscere le modifiche fatte a mano |

Cartella di lavoro e cartella delle librerie si cambiano da **⚙ Impostazioni**. Per un backup completo copia la cartella di lavoro (e quella delle librerie, se l'hai spostata altrove).

## Passare dalla versione 1

La versione 1 era uno zip con `start.exe` e i dati accanto. Per portarli nella versione desktop:

1. Installa la versione desktop e scegli la cartella di lavoro.
2. Apri **⚙ Impostazioni › Importa dalla versione 1…** e indica la cartella della vecchia installazione (quella con `start.exe`).
3. Il programma copia progetti, librerie, changelog, versioni, cestino e `settings.json`; per un file che esiste già con un contenuto diverso ti chiede se sostituirlo. La cartella vecchia non viene toccata.

## Aggiornamenti

All'avvio il programma controlla su GitHub se c'è una versione più recente e, se c'è, mostra un banner con le novità. **Aggiorna e riavvia** scarica il nuovo setup, ne controlla l'impronta, lo installa e riapre il programma; i dati restano dove sono. Per spegnere il controllo metti `"controllo": false` nella sezione `"aggiornamenti"` di `settings.json`.

## Avvio dal codice sorgente (per chi sviluppa)

Ti serve Node.js 24. Dalla cartella del repository:

```bash
npm ci
npm run dev
```

Con `--dev` (lo mette `npm run dev`) la cartella di lavoro è il repository stesso. I comandi di controllo, test e pacchetto sono in [AGENTS.md](../../AGENTS.md).

## Come si pubblica una versione

Questa parte serve solo a chi pubblica nuove versioni.

* `npm run dist` crea in `release/` il setup, il suo `.blockmap` e `latest.yml` (l'impronta che l'aggiornamento automatico controlla).
* Il workflow `.github/workflows/rilascio.yml` fa tutto su GitHub a ogni push su `main`: verifica completa, setup, prova del programma impacchettato e Release `v<version>` con setup, `latest.yml`, tutorial ed esempio.
* La versione è il campo `version` di `package.json`: per un rilascio nuovo alzalo. Se il tag esiste già il workflow non pubblica niente.
* Le note della Release sono `packaging/note/<versione>.md` se c'è, altrimenti il messaggio del commit.
* Non servono segreti: basta il token che GitHub dà a ogni esecuzione.
