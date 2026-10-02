# 2. Installazione e avvio

L'app è una pagina web servita da un piccolo server locale. Il server gira sul tuo computer, risponde solo a te (indirizzo `127.0.0.1`, porta `8080`) e si occupa di leggere e scrivere i file dei progetti e delle librerie.

## Cosa ti serve

* Windows 10 o 11 se usi `start.exe`. Con il codice sorgente va bene qualsiasi sistema con Python 3.11.
* Un browser recente: Chrome, Edge o Firefox.
* La porta `8080` libera. Se un altro programma la sta già usando il server non parte; chiudi quel programma e riprova.

## Avvio con il pacchetto (consigliato per chi usa l'app)

1. Scarica dalla pagina Releases del repository il file `ModellatoreMBSE-<versione>.zip`. Non servono diritti di amministratore.
2. Fai clic destro sullo zip, scegli "Estrai tutto…" ed estrai in una cartella in cui hai il permesso di scrivere (per esempio in Documenti, non in Programmi). Nasce la sottocartella `ModellatoreMBSE` con `start.exe`, i file dell'app, le cartelle vuote `progetti/` e `shared/`, la cartella `esempi/` con un file di requisiti cliente di prova, `TUTORIAL.md` (un tutorial passo passo per iniziare) e `VERSIONE.txt` (il numero della versione installata).
3. Fai doppio clic su `start.exe`.
4. Si apre una finestra nera con l'indirizzo dell'app e la cartella dei progetti, e dopo circa un secondo il browser su `http://localhost:8080`.
5. Quando hai finito, chiudi la finestra nera: il server si ferma. Prima di chiuderla controlla che in alto il badge dica `Salvato`.

Windows SmartScreen potrebbe dirti che l'app non è riconosciuta, perché l'eseguibile non è firmato. Clicca "Ulteriori informazioni" e poi "Esegui comunque".

Se chiudi solo la scheda del browser, il server resta acceso: puoi riaprire `http://localhost:8080` quando vuoi.

## Avvio dal codice sorgente (per chi sviluppa)

Dalla cartella del repository:

```bash
python start.py
```

Succede la stessa cosa dell'exe. Non servono pacchetti aggiuntivi: il server usa solo la libreria standard di Python.

Non aprire `index.html` con un doppio clic. Il browser, con una pagina caricata da `file://`, blocca i moduli JavaScript e la lettura di `settings.json` e della libreria, e l'app non parte.

## Cosa succede al primo avvio

* Il server crea, accanto a `start.exe` (o a `start.py`), la cartella `shared/` con una libreria di esempio `libreria.json` che contiene un solo blocco, "Centralina Condivisa".
* Crea la cartella `progetti/`.
* L'app non trova progetti, quindi crea e apre `progetti/nuovo_progetto.json`, con nome "Nuovo progetto" e canvas vuoto.

Agli avvii successivi l'app riapre l'ultimo progetto su cui hai lavorato, con la sua libreria. Se quel file non esiste più ma ci sono altri progetti, ti mostra l'elenco con il messaggio "L'ultimo progetto non è stato trovato".

## Dove finiscono i tuoi dati

| Cartella | Contenuto |
|---|---|
| `progetti/` | Un file `.json` per progetto, più `_ultimo.json` (l'ultimo aperto) |
| `progetti/_versioni/` | Le ultime versioni di ogni progetto, usate da Annulla |
| `progetti/_cestino/` | I progetti che hai eliminato dal menu |
| `shared/` | Le librerie dei blocchi e, accanto a ciascuna, il suo `.changelog.json` |
| `shared/_versioni/` | Le copie di sicurezza di ogni libreria e il riferimento usato per riconoscere le modifiche fatte a mano |

Per fare un backup completo ti basta copiare `progetti/` e `shared/`.

## Aggiornare a una nuova versione

1. Chiudi la finestra nera dell'app.
2. Se avevi modificato `settings.json`, salvane una copia: l'aggiornamento lo sostituisce.
3. Estrai la nuova versione nello stesso posto della precedente, così la cartella `ModellatoreMBSE` è la stessa, e conferma la sovrascrittura.
4. Se serve, rimetti le tue modifiche in `settings.json`.

Nel pacchetto `progetti/` e `shared/` sono vuote apposta, quindi i tuoi dati non vengono toccati.

## Come si crea il pacchetto

Questa parte serve solo a chi pubblica nuove versioni.

* `pyinstaller start.spec` crea `dist/start.exe`. L'eseguibile contiene solo il server: i file dell'app (`index.html`, `style.css`, `settings.json`, `js/`) li legge dalla sua stessa cartella, non da dentro l'exe.
* `packaging/crea-pacchetto.ps1 -Versione 1.0.0` compila l'exe, gli mette accanto i file dell'app, `TUTORIAL.md` (da `packaging/TUTORIAL.md`), la cartella `esempi/` e le cartelle vuote `progetti/` e `shared/`, e crea in `dist/` lo zip. Non c'è l'autoestraente: Windows chiede i diritti di amministratore per ogni exe con "setup" nel nome. Se aggiungi un file che l'app deve leggere quando gira, ricordati di aggiungerlo all'elenco delle copie in quello script.
* Il workflow `.github/workflows/rilascio.yml` fa tutto da solo su GitHub: a ogni push su `main` (un merge o un commit diretto) compila il pacchetto su Windows, prova ad avviare `start.exe` e controlla che risponda, poi pubblica una Release con lo zip.
* La versione è automatica: l'ultimo tag `v*` con la patch aumentata di uno (`v1.0.0` per il primo rilascio). Per passare a una nuova minor o major fai push del tag a mano (es. `git tag v2.0.0 && git push origin v2.0.0`): il workflow pubblica quella Release e i push successivi ripartono da lì.
* La descrizione della Release è il messaggio del commit. Per un merge c'è anche l'elenco dei commit del branch unito, ciascuno con il suo messaggio (lo script è `.github/scripts/note-rilascio.sh`).
* Avviato a mano dalla scheda Actions produce solo i file da scaricare, senza Release.
