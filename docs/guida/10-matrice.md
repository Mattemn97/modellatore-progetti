# 10. Matrice di tracciabilità

La matrice è la tabella che dice, per ogni requisito padre, quali requisiti figli ne derivano e in quali documenti stanno entrambi. È il riepilogo della tracciabilità di tutto il modello, che puoi guardare a video ed esportare in Markdown.

## Aprirla

Premi **`📊 Matrice Requisiti`** nella barra del canvas. Si apre una finestra quasi a tutto schermo, calcolata sul modello di quel momento. Si chiude con `✕`.

Aprire, filtrare, esportare e chiudere la matrice non cambia il progetto e non tocca le modalità Coerenza e Gerarchia. Mentre la finestra è aperta, `Ctrl+Z` e `Ctrl+Y` non agiscono.

Se la libreria non è caricata la finestra dice "Libreria non caricata: la matrice si calcola quando la carichi". Se il modello non ha derivazioni né problemi dice "Nessuna derivazione nel modello".

## Come è fatta la tabella

La tabella è **raggruppata per padre**: le celle del padre compaiono una volta, estese su tutte le righe dei suoi figli, e c'è una riga per ogni figlio.

| Colonna | Contenuto |
|---|---|
| ID padre, ID figlio | L'id del requisito, oppure l'ID del cliente per un requisito cliente |
| Titolo padre, Titolo figlio | Il titolo |
| Blocco padre, Blocco figlio | Il titolo del blocco di libreria che possiede il requisito (`Cliente` per un requisito cliente). Passando il mouse vedi i percorsi delle istanze. |
| Metodo padre, Metodo figlio | Il metodo di verifica (vuoto per un requisito cliente) |
| Documenti padre, Documenti figlio | I documenti dei testi da esportare del requisito (`Cliente` per un requisito cliente) |
| Classe | `Capacità` o la tipologia. Una sola colonna, perché padre e figlio di un filo valido hanno sempre la stessa classe. |
| Istanze | In quante istanze distinte quel figlio deriva da quel padre |
| Note | Segnalazioni come "Senza figli" o "Ritirato" |

Una riga è una **coppia padre e figlio**, anche se compare in più istanze: la colonna Istanze ti dice quante. Le righe vengono solo da fili di derivazione validi, con le stesse regole della [Gerarchia](09-gerarchia.md).

### Padri senza figli

Un padre che non scende a nessun figlio è segnalato, con le regole della [Coerenza](08-coerenza.md):

* se nessuna istanza ha figli, il gruppo ha una sola riga con le celle del figlio vuote e la nota "Senza figli";
* se alcune istanze hanno figli e altre no, il gruppo mostra i figli e la nota "Senza figli in X istanze su Y".

Un requisito che sta solo in blocchi foglia non viene segnalato.

### Il gruppo Senza padre

In fondo c'è una tabella a parte, **Senza padre**, con i requisiti dei blocchi che in almeno un'istanza non hanno un padre valido. La nota dice "Senza padre" se succede in tutte le istanze, "Senza padre in X istanze su Y" se solo in alcune. Un requisito cliente ritirato non conta come padre.

### Requisiti cliente ritirati

Un requisito cliente ritirato con fili validi è un padre come gli altri: il suo gruppo ha ID e titolo barrati e la nota "Ritirato".

### Ordine

Prima i requisiti cliente, nell'ordine della lista cliente. Poi i requisiti dei blocchi per livello (1 per i blocchi della radice, 2 per quelli dentro, e così via) e, a parità di livello, per id in ordine naturale (`CEN_002` prima di `CEN_010`).

## Filtri

In testa alla finestra trovi i filtri, che valgono tutti insieme:

* **Documento**: `Tutti`, oppure un documento (SSS, IRS, …, o `Cliente`). Accanto, **Lato**: `Uno dei due` (predefinito), `Padre` o `Figlio`, per dire su quale lato della riga deve stare quel documento.
* **Classe**: `Tutte`, `Capacità` o una tipologia.
* **Ricerca**: testo libero su ID e titolo di padre e figlio, senza distinguere maiuscole e minuscole.

Sopra la tabella vedi i conteggi del risultato filtrato: **Padri**, **Derivazioni**, **Senza figli** e **Senza padre**. Se nessuna riga resta vedi "Nessuna riga con questi filtri".

Per restare veloce anche con modelli grandi, la finestra mostra 300 gruppi alla volta (`matrice.gruppiVisibili` in `settings.json`); il pulsante "Mostra altri N gruppi" ne aggiunge altrettanti. Conteggi ed export riguardano sempre tutto il risultato, non solo i gruppi visibili.

I filtri restano quelli dell'ultima volta quando riapri la finestra, finché la pagina resta aperta.

## Dalla matrice alla Gerarchia

Un clic sull'ID o sul titolo di un requisito chiude la finestra, accende la [Gerarchia](09-gerarchia.md), apre il livello dell'istanza e sceglie quel requisito. Per un padre senza figli ti porta alla prima istanza senza figli; per un requisito senza padre alla prima istanza senza padre. Così passi subito dal "cosa manca" al "dove sistemarlo".

## Esportare

**`⬇ Esporta .md`** scarica un file Markdown con tutto il risultato filtrato:

* il titolo `# Matrice di tracciabilità: <nome del progetto>`;
* la data e la libreria con la sua versione;
* i filtri usati (oppure "Filtri: nessuno") e i conteggi;
* la sezione `## Derivazioni` con la tabella;
* la sezione `## Senza padre` con la sua tabella.

Il file si chiama `<progetto>-matrice.md`, oppure `<progetto>-matrice-<documento>.md` se hai filtrato per documento (per esempio `impianto-matrice-sss.md`). Il pulsante è disattivato quando il risultato filtrato è vuoto.
