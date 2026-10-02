# 0015. Controllo e aggiornamento automatico: decisione e motivi

## Context

Ogni push su `main` pubblica una Release su GitHub con lo zip del pacchetto (`.github/workflows/rilascio.yml`). Oggi chi usa l'app non sa che esiste una versione nuova finché qualcuno non glielo dice, e per aggiornare deve scaricare lo zip ed estrarlo a mano sopra la cartella. La spec 0013 ha reso quell'estrazione sicura per i dati dell'utente e ha fissato in `PERCORSI_UTENTE` cosa non si tocca mai.

L'utente ha chiesto che il programma, all'avvio, controlli la repo e proponga di scaricare la versione nuova, aggiornandosi da solo, senza mai cancellare il lavoro fatto.

Le forze in gioco: l'app gira su Windows come `start.exe` non firmato, in una cartella dove l'utente ha i permessi di scrittura; lo `start.exe` in esecuzione non si può sovrascrivere; la console del server non è interattiva mentre serve l'app; molte installazioni possono essere senza rete o dietro un proxy; un aggiornamento rotto lascerebbe l'utente senza app.

## Options considered

### Option 1: Solo avviso, aggiornamento a mano

L'app controlla e mostra il link alla Release; l'utente scarica ed estrae.

**Pros**:
- Nessun codice che tocca file o processi.

**Cons**:
- Non è quello che l'utente ha chiesto ("aggiorna da solo").
- L'estrazione a mano resta un passo che molti saltano.

### Option 2: start.py si aggiorna da solo, con controllo di salute e ripristino

Scarica, controlla impronta e contenuto, sostituisce i file con copia, riparte, verifica la nuova versione, ripristina se non parte.

**Pros**:
- Un clic; nessun programma in più da distribuire.
- I dati dell'utente sono protetti due volte: lista ammessa dallo zip e controllo su `PERCORSI_UTENTE`.
- Un exe nuovo che non parte non lascia l'installazione rotta.

**Cons**:
- Codice delicato (rete, file, processi) senza test automatici.

### Option 3: Programma updater separato

Un secondo exe che aspetta la chiusura di `start.exe`, sostituisce i file e lo riavvia.

**Pros**:
- Sostituisce i file a programma chiuso, senza rinominare l'exe in uso.

**Cons**:
- Un secondo eseguibile da costruire, impacchettare e aggiornare a sua volta (chi aggiorna l'updater?).
- Gli stessi problemi di ripristino, in un processo in più.

## Rationale

L'opzione 1 non risponde alla richiesta. Tra le altre due, il problema tecnico che giustificherebbe un updater separato (non poter sovrascrivere l'exe in uso) su Windows si risolve rinominando l'exe, cosa permessa anche mentre gira. Resta quindi un solo programma, e la parte difficile, il ripristino, è uguale nei due casi: meglio averla in un solo posto.

L'impronta SHA256 fornita da GitHub per ogni asset chiude il rischio più concreto (uno zip troncato da una rete instabile) senza dover pubblicare firme a parte. La lista ammessa presa dallo zip, più il controllo su `PERCORSI_UTENTE`, segue l'indicazione emersa nella spec 0013: un file dell'utente nuovo, che nessuna lista conosce, resta comunque al sicuro perché non è nello zip.

Il controllo di salute costa qualche secondo di attesa al riavvio, ma è l'unica difesa contro il caso peggiore: un exe nuovo che non parte, per esempio perché un antivirus lo blocca. In quel caso l'utente si ritrova la versione di prima con un messaggio chiaro, invece di una finestra che si chiude.
