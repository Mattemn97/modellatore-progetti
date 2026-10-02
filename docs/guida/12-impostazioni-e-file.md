# 12. Impostazioni e file

Questo capitolo è per chi vuole adattare l'app (nuove tipologie, nuovi documenti, limiti diversi) o capire com'è fatto un file su disco.

## settings.json

Il file `settings.json` sta accanto a `index.html` (e a `start.exe`). L'app lo legge a ogni caricamento della pagina: dopo una modifica ti basta ricaricare il browser. Fanno eccezione le due chiavi `versioni`, che il server legge solo all'avvio: per quelle chiudi e riavvia `start.exe`.

Se una chiave manca, l'app usa il valore predefinito. Prima di aggiornare l'app a una nuova versione salva una copia del tuo `settings.json`, perché l'aggiornamento lo sostituisce.

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
| `grid.size` | `20` | Il passo della griglia del canvas, in pixel |
| `node.width`, `node.height` | `160`, `60` | La dimensione di un blocco appena posato |
| `node.selectedBorderColor` | `#0078d4` | Il colore del bordo del blocco selezionato |
| `parentBlock.radius` | `28` | Il raggio dei blocchi tondi |
| `requirements.radius` | `7` | Il raggio di porte e pin |
| `requirements.capabilityColor` | `#8e44ad` | Il colore dei requisiti di capacità |
| `requirements.typeColors` | Elettrica, Segnale, Meccanica, Fluidica | Le **tipologie di interfaccia** e i loro colori |
| `metodiVerifica` | Ispezione, Analisi, Dimostrazione, Test | I metodi di verifica proposti nell'ispettore e usati nei documenti |
| `documenti` | SSS, SSDD, IRS, IDD, SRS, SDD | I documenti proposti per i testi da esportare, nei filtri, nella matrice e nella finestra Documenti |

### Aggiungere una tipologia

Aggiungi una riga in `requirements.typeColors`, per esempio `"Ottica": "#16a085"`, e ricarica la pagina. La nuova tipologia compare nell'ispettore, nei filtri, nella matrice e nei documenti (con un suo capitolo di interfaccia). Una tipologia nuova accetta collegamenti solo con requisiti della stessa tipologia.

### Aggiungere un documento

Aggiungi il nome in `documenti`, per esempio `"OCD"`. Compare nell'ispettore e nei filtri; nella finestra Documenti viene generato con la struttura generica "Documento di requisiti".

## Il file di un progetto

`progetti/<nome>.json`:

```json
{
  "formatVersion": 2,
  "nome": "Impianto",
  "libraryPath": "shared/libreria.json",
  "workspace": { "nodes": [], "edges": [] },
  "cliente": { "prefisso": "CLI-", "requisiti": [], "ultimoImport": {} }
}
```

* `formatVersion` è 2 per i file scritti dalla versione attuale. L'app apre anche i file in formato 1, scritti prima dei requisiti cliente.
* `cliente` c'è solo dopo il primo import di requisiti cliente.
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

## Il server e la sicurezza

Il server (`start.py`, oppure `start.exe`) ascolta solo sull'indirizzo locale `127.0.0.1`, porta `8080`: dagli altri computer della rete non si raggiunge. Oltre a servire i file dell'app offre alcune API:

| Indirizzo | Uso |
|---|---|
| `/api/progetti` | Elenco, lettura, scrittura, annulla, rinomina ed eliminazione dei progetti |
| `/api/ultimo` | L'ultimo progetto aperto |
| `/api/libreria/apri`, `/salva`, `/elimina`, `/rinomina`, `/changelog` | Lettura e modifica delle librerie |

Qualche protezione da conoscere:

* il server scrive solo dentro `progetti/` (progetti, versioni, cestino) e dentro `shared/` (librerie, changelog, copie di sicurezza);
* rifiuta percorsi assoluti, percorsi con `..`, nomi riservati di Windows e file che non finiscono in `.json`;
* accetta richieste alle API solo dalla pagina servita da lui stesso (`localhost` o `127.0.0.1` sulla sua porta);
* rifiuta corpi oltre 50 MB;
* la cartella `progetti/` non è servita come file statici;
* le operazioni sui file passano una alla volta, così due richieste insieme non si pestano i piedi.

## Dove trovare le decisioni

Ogni funzionalità ha una specifica in `docs/specs/`, con i criteri di accettazione, le scelte fatte e le alternative scartate. Se ti chiedi "perché funziona così?", la risposta è lì. Il piano complessivo, con le funzionalità rimandate, è in `docs/scope/scope.md`.
