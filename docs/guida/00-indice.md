# Guida al Modellatore di Requisiti a Blocchi

Questa guida descrive tutto quello che l'app sa fare oggi. È scritta per chi la usa per la prima volta e non ha seguito il suo sviluppo: non serve sapere nulla del codice.

## Capitoli

| # | Capitolo | Di cosa parla |
|---|---|---|
| 1 | [Concetti di base](01-concetti.md) | Blocchi, requisiti, livelli, fili, regole di collegamento. Leggilo per primo. |
| 2 | [Installazione e avvio](02-installazione-e-avvio.md) | Come si avvia, dove finiscono i dati, come si aggiorna |
| 3 | [Interfaccia e canvas](03-interfaccia-e-canvas.md) | Le tre colonne, il canvas, zoom, fili, porte, snodi, ispettore dei collegamenti, tasti |
| 4 | [Libreria dei blocchi](04-libreria.md) | Creare e modificare blocchi, versioni, changelog, rinominare, eliminare |
| 5 | [Progetti](05-progetti.md) | Salvataggio automatico, Annulla e Ripeti, menu Progetto, conflitti |
| 6 | [Requisiti cliente](06-requisiti-cliente.md) | Importare da Excel o CSV, reimportare una revisione, portare i requisiti sul canvas |
| 7 | [Filtri](07-filtri.md) | Attenuare o nascondere blocchi e fili |
| 8 | [Controllo di coerenza](08-coerenza.md) | Trovare requisiti scoperti e fili da riparare |
| 9 | [Gerarchia dei requisiti](09-gerarchia.md) | Antenati e discendenti di un requisito su tutti i livelli |
| 10 | [Matrice di tracciabilità](10-matrice.md) | La tabella padre e figli, filtri ed export |
| 11 | [Documenti MIL-STD-498](11-documenti.md) | Generare SSS, SSDD, IRS, IDD, SRS, SDD in Markdown |
| 12 | [Impostazioni e file](12-impostazioni-e-file.md) | `settings.json`, cartelle, formati dei file, sicurezza del server |

## Un percorso di lavoro tipico

Ecco come puoi usare l'app dall'inizio alla fine. Ogni passo rimanda al capitolo che lo spiega; salta pure quelli che non ti servono.

1. **Avvia l'app** con `start.exe` o `python start.py`. Al primo avvio trovi un progetto vuoto già aperto, "Nuovo progetto". ([Installazione](02-installazione-e-avvio.md))
2. **Dai un nome al progetto** dal menu `Progetto ▾` › `Rinomina…`. ([Progetti](05-progetti.md))
3. **Prepara la libreria**: crea i blocchi del tuo sistema (per esempio "Centralina", "Pompa", "Sensore") con `+ Nuovo Blocco`, e per ognuno i requisiti con tipologia, metodo di verifica e testi da esportare. ([Libreria](04-libreria.md))
4. **Importa i requisiti del cliente** dalla scheda Cliente, scegliendo un file Excel o CSV e indicando quali colonne sono ID e testo. ([Requisiti cliente](06-requisiti-cliente.md))
5. **Costruisci il modello**: trascina i blocchi sul canvas, trascina i requisiti cliente alla radice, tira i fili dai requisiti cliente ai requisiti dei blocchi. Entra in un blocco con un doppio clic e ripeti al livello di sotto. ([Interfaccia e canvas](03-interfaccia-e-canvas.md))
6. **Controlla cosa manca** con `⚠️ Verifica Coerenza`: ti elenca i requisiti cliente non ancora coperti e i requisiti dei blocchi che non derivano da nulla. ([Coerenza](08-coerenza.md))
7. **Segui una catena** con `🌳 Gerarchia` quando vuoi capire da dove viene un requisito o fin dove arriva. ([Gerarchia](09-gerarchia.md))
8. **Esporta la tracciabilità** con `📊 Matrice Requisiti` › `⬇ Esporta .md`. ([Matrice](10-matrice.md))
9. **Genera i documenti** con `📄 Documenti`: scegli SSS, SSDD, IRS o un altro e scarica il Markdown. ([Documenti](11-documenti.md))

Non devi mai salvare a mano: ogni modifica al progetto finisce su disco da sola dopo circa un secondo, e ogni modifica alla libreria si scrive quando premi il pulsante di salvataggio nell'ispettore.

## Glossario veloce

| Termine | Significato |
|---|---|
| Blocco | Un componente del sistema (es. "Centralina"). Ha una definizione in libreria e può comparire più volte nel progetto. |
| Istanza | Una copia di un blocco di libreria posata sul canvas. Tutte le istanze condividono gli stessi requisiti; cambia solo l'etichetta. |
| Requisito di interfaccia | Requisito con una tipologia (Elettrica, Segnale, Meccanica, Fluidica…). Appare come porta colorata sul bordo del blocco. |
| Requisito di capacità | Requisito senza tipologia: una cosa che il blocco sa fare. Appare come pin quadrato viola dentro il blocco. |
| Classe | La tipologia di un requisito di interfaccia, oppure "Capacità". Due requisiti si collegano solo se hanno la stessa classe. |
| Livello | Il contenuto di un blocco. La radice è il livello più alto; entrando in un blocco scendi di un livello. |
| Blocco tondo | Dentro un blocco, ogni suo requisito diventa un cerchio: è il padre da cui tiri i fili verso i requisiti dei blocchi interni. Alla radice i blocchi tondi sono i requisiti cliente. |
| Derivazione | Un filo da un blocco tondo (padre) al requisito di un blocco interno (figlio). È la relazione che costruisce la tracciabilità. |
| Collegamento tra blocchi | Un filo tra due blocchi dello stesso livello. Descrive un'interfaccia, ma non crea un rapporto padre e figlio. |
| Occorrenza | Un requisito in un'istanza precisa, individuata dal percorso dei blocchi dalla radice. Serve a Gerarchia e Coerenza. |
| Testo da esportare | Un paragrafo associato a un requisito e a un documento (SSS, IRS…). Finisce nel documento generato. |
| DID | Data Item Description: lo schema dei capitoli che lo standard MIL-STD-498 prescrive per ogni documento. |
