# 12. Impostazioni e file

Questo capitolo è per chi vuole adattare l'app (nuove tipologie, nuovi documenti, limiti diversi) o capire com'è fatto un file su disco.

## settings.json

Il file `settings.json` sta nella cartella di lavoro (da **⚙ Impostazioni › Apri settings.json**). Il programma lo legge all'avvio: dopo una modifica chiudilo e riaprilo.

Se una chiave manca, il programma usa il valore predefinito. Gli aggiornamenti non toccano il tuo `settings.json`: sta fuori dalla cartella del programma.

| Chiave | Predefinito | A cosa serve |
|---|---|---|
| `libraryPath` | `shared/libreria.json` | La libreria usata dai progetti nuovi |
| `progetti.debounceMs` | `1000` | Quanti millisecondi aspettare dopo l'ultima modifica prima del salvataggio automatico |
| `progetti.versioni` | `3` | Quante versioni di ogni progetto tenere per Annulla (letta all'avvio del server) |
| `libreria.versioni` | `3` | Quante copie di sicurezza della libreria tenere in `_versioni/` (letta all'avvio del server) |
| `cliente.prefisso` | `CLI-` | Il prefisso degli id dei requisiti cliente, copiato nel progetto al primo import |
| `cliente.maxFileMB` | `20` | La dimensione massima di un file da importare |
| `cliente.righeAnteprima` | `200` | Quante righe mostrare nella scheda Nuovi dell'anteprima di import |
| `cliente.righePannello` | `300` | Quante righe mostrare nella scheda Cliente |
| `coerenza.righePerGruppo` | `200` | Quante voci mostrare per gruppo nella scheda Coerenza |
| `gerarchia.righeAperte` | `300` | Quante righe della scheda Gerarchia aprire in automatico |
| `matrice.gruppiVisibili` | `300` | Quanti gruppi della matrice mostrare alla volta |
| `documentiExport.anteprimaCaratteri` | `200000` | Lunghezza massima dell'anteprima di un documento |
| `documentiExport.modello.azienda` | `""` | Il nome dell'azienda sul frontespizio e in testa alle pagine di Word e PDF |
| `documentiExport.modello.logo` | `""` | Il logo del frontespizio: un PNG o JPEG dentro la cartella di lavoro, es. `modello/logo.png` (al massimo 2 MB) |
| `documentiExport.modello.classificazione` | `""` | La classificazione scritta sul frontespizio (es. `Riservato`) |
| `documentiExport.modello.piePagina` | `""` | Il testo del piè di pagina, prima di `Pagina N di M` |
| `documentiExport.modello.autore` | `""` | L'autore proposto in una nuova riga del registro delle revisioni |
| `grid.size` | `20` | Il passo della griglia del canvas, in pixel |
| `node.width`, `node.height` | `160`, `60` | La dimensione di un blocco appena posato |
| `node.selectedBorderColor` | `#0078d4` | Il colore del bordo del blocco selezionato |
| `parentBlock.radius` | `28` | Il raggio dei blocchi tondi |
| `requirements.radius` | `7` | Il raggio di porte e pin |
| `requirements.capabilityColor` | `#8e44ad` | Il colore dei requisiti di capacità |
| `requirements.typeColors` | Elettrica, Segnale, Meccanica, Fluidica | Le **tipologie di interfaccia** e i loro colori |
| `metodiVerifica` | Ispezione, Analisi, Dimostrazione, Test | I metodi di verifica proposti nell'ispettore e usati nei documenti |
| `documenti` | SSS, SSDD, IRS, IDD, SRS, SDD | L'ordine dei documenti nell'ispettore e nella finestra Documenti, e le voci dei filtri e della matrice |
| `documentiPerClasse` | interfaccia: IRS, IDD; capacita: SSS, SSDD, SRS, SDD | Quali documenti accettano requisiti di interfaccia e quali di capacità. Un documento in nessuna lista non si può usare. Una lista vuota (`[]`) non ammette nessun documento; un valore sbagliato (non una lista di testi) usa il predefinito |

### Aggiungere una tipologia

Aggiungi una riga in `requirements.typeColors`, per esempio `"Ottica": "#16a085"`, e ricarica la pagina. La nuova tipologia compare nell'ispettore, nei filtri, nella matrice e nei documenti (con un suo capitolo di interfaccia). Una tipologia nuova accetta collegamenti solo con requisiti della stessa tipologia.

### Aggiungere un documento

Aggiungi il nome nella lista giusta di `documentiPerClasse`, per esempio `"capacita": ["SSS", "SSDD", "SRS", "SDD", "OCD"]`, e riavvia. Compare nell'ispettore per i requisiti di quel tipo e nella finestra Documenti, dove viene generato con la struttura generica "Documento di requisiti". Per sceglierne la posizione nei menu aggiungilo anche in `documenti`.

## Il file di un progetto

`progetti/<nome>.json`:

```json
{
  "formatVersion": 2,
  "nome": "Impianto",
  "libraryPath": "shared/libreria.json",
  "workspace": { "nodes": [], "edges": [] },
  "cliente": { "prefisso": "CLI-", "requisiti": [], "ultimoImport": {} },
  "revisioniDocumenti": { "SSS": [{ "revisione": "A", "data": "2026-10-06", "descrizione": "Prima emissione", "autore": "M. Rossi" }] }
}
```

* `formatVersion` è 2 per i file scritti dalla versione attuale. L'app apre anche i file in formato 1, scritti prima dei requisiti cliente.
* `cliente` c'è solo dopo il primo import di requisiti cliente.
* `revisioniDocumenti` c'è solo dopo la prima revisione scritta nel pannello Documenti: il registro delle revisioni di ogni documento, usato da Word e PDF.
* `workspace` è il grafo della radice. Ogni nodo (un'istanza di blocco) ha id, tipo (l'id del blocco di libreria), etichetta, dimensioni, posizione, posizioni delle porte e il suo `internal_graph`, cioè il livello interno, che a sua volta ha nodi e fili. Così il file rispecchia le matriosche.
* Ogni filo ha i due estremi (nodo e id del requisito, oppure un blocco tondo del livello) e gli snodi.

## Il file di una libreria

`shared/<nome>.json`:

```json
{
  "formatVersion": 1,
  "versione": "1.3.0",
  "library": {
    "centralina": {
      "id": "centralina",
      "titolo": "Centralina",
      "descrizione": "…",
      "categoria": "Elettrica",
      "sottocategoria": "Controllo",
      "requisiti": [
        {
          "id": "centralina_001",
          "titolo": "Alimentazione 24V",
          "tipologia": "Elettrica",
          "metodoVerifica": "Test",
          "testiExport": [{ "testo": "…", "documento": "IRS" }]
        }
      ]
    }
  }
}
```

Un requisito con `"tipologia": null` è di capacità. Accanto alla libreria stanno `<nome>.changelog.json` (la storia delle versioni) e, in `shared/_versioni/`, le copie di sicurezza e `<nome>.riferimento.json`, l'ultimo contenuto noto che serve a riconoscere le modifiche fatte a mano.

L'app accetta anche librerie nei formati vecchi (una semplice mappa di blocchi, oppure `{ "library": … }`, anche con i nomi dei campi in inglese delle prime versioni) e le converte al formato attuale al primo salvataggio.

## Modificare i file a mano

Si può fare, ma con qualche attenzione:

* **Progetto**: modificalo con l'app chiusa, oppure aspetta che il badge dica `Salvato`. Se lo modifichi mentre è aperto, al salvataggio successivo l'app segnala un conflitto e ti fa scegliere.
* **Libreria**: l'app registra la tua modifica nel changelog come "Modifica esterna" e avanza la versione. Gli id dei requisiti devono restare unici in tutta la libreria.

## I file e la sicurezza

Non c'è un server né una porta aperta: la pagina del programma chiede al processo desktop di leggere e scrivere i file, tramite indirizzi interni `app://modellatore/api/…` che nessun altro programma raggiunge:

| Indirizzo | Uso |
|---|---|
| `/api/progetti` | Elenco, lettura, scrittura, annulla, rinomina ed eliminazione dei progetti |
| `/api/ultimo` | L'ultimo progetto aperto |
| `/api/libreria/apri`, `/salva`, `/elimina`, `/rinomina`, `/changelog` | Lettura e modifica delle librerie |

Qualche protezione da conoscere:

* il programma scrive solo dentro `progetti/` della cartella di lavoro (progetti, versioni, cestino) e dentro la cartella delle librerie (librerie, changelog, copie di sicurezza);
* rifiuta percorsi assoluti, percorsi con `..`, nomi riservati di Windows e file che non finiscono in `.json`;
* la pagina non ha accesso a Node né al disco: passa sempre dal processo desktop;
* rifiuta corpi oltre 50 MB;
* la cartella `progetti/` non è servita come file statici;
* le operazioni sui file passano una alla volta, così due richieste insieme non si pestano i piedi.

## Dove trovare le decisioni

Ogni funzionalità ha una specifica in `docs/specs/`, con i criteri di accettazione, le scelte fatte e le alternative scartate. Se ti chiedi "perché funziona così?", la risposta è lì. Il piano complessivo, con le funzionalità rimandate, è in `docs/scope/index.md`.
