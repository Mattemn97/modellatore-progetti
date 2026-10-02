# 11. Documenti MIL-STD-498

L'app genera dal modello un documento Markdown per ogni tipo di documento MIL-STD-498, con la capitolazione formale del suo DID (lo schema dei capitoli che lo standard prescrive). Ogni testo da esportare finisce nel capitolo giusto: le capacità in un capitolo, le interfacce in un altro, i metodi di verifica nelle disposizioni di qualifica, i padri nel capitolo di tracciabilità.

Il documento generato è una base di partenza: i capitoli che il modello non può riempire (per esempio gli stati e modi, o i requisiti di sicurezza) restano con la scritta `_Da completare._`, così vedi a colpo d'occhio cosa scrivere a mano.

## Prima di generare: i testi da esportare

Un requisito entra in un documento solo se ha almeno un **testo da esportare** destinato a quel documento. I testi si scrivono nella libreria, nel form del blocco, con `+ Testo da esportare` (vedi [Libreria](04-libreria.md#i-requisiti-di-un-blocco)).

Per esempio, un requisito "Alimentazione 24V" può avere:

* un testo per l'**SSS**: "Il sistema deve funzionare con alimentazione a 24 V";
* un testo per l'**IRS**: "L'interfaccia di alimentazione accetta 24 V ± 10% su connettore X1".

I requisiti cliente non entrano mai nei documenti: compaiono solo come padri nel capitolo di tracciabilità.

## Generare un documento

1. Premi **`📄 Documenti`** nella barra del canvas.
2. Nel selettore **Documento** scegli quale generare. Trovi le voci di `settings.json` (SSS, SSDD, IRS, IDD, SRS, SDD) e poi gli eventuali altri documenti usati nei testi della libreria.
3. Guarda il riepilogo e l'anteprima.
4. Premi **`⬇ Esporta .md`**.

Il file si chiama `<progetto>-<documento>.md`, per esempio `impianto-sss.md`, e contiene sempre il documento completo.

La finestra lavora su una fotografia del modello presa quando la apri; si chiude con `✕`. Aprirla e scaricare non cambia il progetto. La prossima volta che la apri trovi selezionato il documento dell'ultima volta.

## Il riepilogo e l'anteprima

Sotto il selettore vedi una riga come questa:

`Requisiti: 24 (capacità 15, interfacce 9) · Testi: 31 · Senza metodo: 2 · Senza padre: 1 · Non usati nel progetto: 3`

* **Senza metodo**: requisiti del documento senza metodo di verifica.
* **Senza padre**: requisiti del documento che in qualche istanza non derivano da nulla.
* **Non usati nel progetto**: requisiti della libreria che hanno un testo per questo documento ma non compaiono in nessun punto del modello. Non entrano nel documento. Se ti aspettavi di vederli, trascina il loro blocco nel progetto.

Sotto c'è l'anteprima del file. Se è molto lunga si tronca a 200.000 caratteri (`documentiExport.anteprimaCaratteri`) con un avviso; il file scaricato contiene comunque tutto. Se nessun requisito ha testi per quel documento, l'app te lo dice e il file avrà solo i capitoli.

## Come è fatto il file

In testa trovi il titolo `# <documento> · <titolo del DID> · <nome del progetto>` e la riga con data e libreria con la sua versione. Poi i capitoli, numerati come nel DID.

Capitoli comuni a tutti i documenti:

* **1 Scopo**: 1.1 Identificazione (scritto dall'app: documento, progetto, libreria, data), 1.2 Panoramica e 1.3 Panoramica del documento (da completare).
* **2 Documenti di riferimento**: l'elenco dei documenti dei requisiti padre, con `Cliente` per primo.
* **Tracciabilità dei requisiti**: una tabella con ID, titolo, sezione del documento, requisiti padre, documenti dei padri e note (senza padre, padre cliente ritirato).
* **Note**: un sottocapitolo Acronimi e glossario da completare, e in fondo la riga che ricorda che i capitoli "Da completare" non sono coperti dal modello.

### I capitoli dei singoli documenti

| Documento | Titolo del DID | Dove vanno i requisiti |
|---|---|---|
| **SSS** | Specifica del sistema/sottosistema | 3.2 capacità, 3.3 interfacce esterne; 4 Disposizioni di qualifica; 5 Tracciabilità; 6 Note. Da 3.4 a 3.18 i capitoli del DID da completare. |
| **SRS** | Specifica dei requisiti software | Come SSS, riferito al CSCI (il componente software) invece che al sistema |
| **IRS** | Specifica dei requisiti di interfaccia | 3.1 Identificazione delle interfacce, poi un capitolo per tipologia, poi "Altri requisiti" per le capacità (solo se ce ne sono); 4 Qualifica; 5 Tracciabilità; 6 Note |
| **SSDD** | Descrizione del progetto del sistema/sottosistema | 4.1 Componenti del sistema (capacità raggruppate per blocco), 4.3 Progetto delle interfacce; 5 Tracciabilità; 6 Note |
| **SDD** | Descrizione del progetto software | Come SSDD riferito al CSCI, più 5 Progetto di dettaglio (da completare); 6 Tracciabilità; 7 Note |
| **IDD** | Descrizione del progetto delle interfacce | 3.1 Identificazione, un capitolo per tipologia, "Altri requisiti"; 4 Tracciabilità; 5 Note |
| altro | Documento di requisiti | 3.1 capacità, 3.2 interfacce; 4 Qualifica; 5 Tracciabilità; 6 Note |

### Le interfacce

Ogni capitolo di interfacce si apre con **Identificazione delle interfacce e diagrammi**: una tabella con una riga per tipologia (quanti requisiti, quali blocchi) e la riga `_Diagrammi da completare._`. Poi c'è un sottocapitolo `Interfaccia <tipologia>` per ogni tipologia presente, con i suoi requisiti.

### I componenti (SSDD e SDD)

Il capitolo 4.1 Componenti si apre con una tabella `Blocco | Categoria | Requisiti nel documento`, poi un sottocapitolo per ogni blocco con la sua descrizione come primo paragrafo e, dentro, i suoi requisiti di capacità.

### Le disposizioni di qualifica (SSS, SRS, IRS e altro)

Una frase con i metodi di qualifica previsti e una tabella con una riga per requisito e una colonna per ogni metodo di verifica (Ispezione, Analisi, Dimostrazione, Test): una `X` segna il metodo del requisito. La nota dice "Metodo non definito" se manca.

### Il singolo requisito

Ogni requisito ha un sottocapitolo con titolo `<numero> <ID> · <titolo>`, poi i suoi testi per quel documento (nell'ordine in cui li hai scritti, con il Markdown che contengono), e un elenco con metodo di verifica, blocco e requisiti da cui deriva.

Dentro un capitolo i requisiti seguono l'ordine della matrice: prima per livello, poi per id.

## Quale documento scegliere

Una regola pratica, se lo standard è nuovo per te:

* **SSS** per i requisiti del sistema nel suo insieme, quelli che derivano direttamente dal cliente;
* **SSDD** per descrivere come il sistema è diviso in componenti;
* **IRS** per i requisiti delle interfacce, **IDD** per il loro progetto;
* **SRS** e **SDD** sono l'equivalente di SSS e SSDD per un componente software.

Puoi aggiungere altri documenti in `settings.json` (chiave `documenti`): l'app li tratta con la struttura generica "Documento di requisiti".

## Limiti

* Il formato è solo Markdown. Per avere Word o PDF puoi convertire il file con uno strumento esterno (per esempio Pandoc).
* I diagrammi non vengono generati.
