# 0036. Cavi fisici: strato separato dalle interfacce logiche

**Date**: 2026-10-19
**Status**: Done

## Summary

Ogni filo di interfaccia fra due blocchi (link logico) può essere realizzato da un cavo fisico. Un cavo collega due blocchi dello stesso livello e contiene uno o più fili fra quei due blocchi. Sulla lavagna i due strati non si mescolano mai: un selettore **Interfacce | Cavi** mostra o i fili logici o i cavi. Un pannello **Cavi** elenca tutti i cavi del progetto come la lista cavi dell'IDV Interface Manager (sigla, estremi, tipo, connettori, lunghezza, P/N, fili contenuti), con ricerca, ordinamento e CSV.

## Context

Richiesta dell'utente del 2026-10-19: gestire i cavi fisici che contengono i link logici, con due strati distinti che non si mescolano e una lista dei cavi come in `IDV_Interface_Manager.html` (lì un cavo ha id, interfaccia, componenti e porte A/B, tipo, connettori A/B, lunghezza, schermatura, P/N, stato). La spec 0035 li aveva lasciati fuori per non cambiare il formato dei progetti.

## Requirements

- **AC-1 Modello**: `Grafo.cavi?: Cavo[]`, facoltativo; un progetto senza cavi si salva identico alla 2.3 (la chiave non compare). `Cavo = { id, sigla, da, a, fili, tipo?, connettoreDa?, connettoreA?, lunghezza?, pn?, note? }`: `da`/`a` sono nodi del livello, `fili` gli id dei fili contenuti.
- **AC-2 Regole**: un cavo sta fra due blocchi diversi dello stesso livello. Contiene solo fili di interfaccia (non capacità, non derivazioni verso i blocchi tondi) che vanno da `da` ad `a` (in un verso o nell'altro, porte propagate comprese). Un filo sta in al massimo un cavo. Cancellare un filo lo toglie dal cavo; cancellare un blocco cancella i suoi cavi. La sigla proposta è la prima libera nel progetto (`W001`, `W002`…) e si può cambiare.
- **AC-3 Strati**: selettore **Interfacce | Cavi** nella barra della lavagna (preferenza del PC come Etichette e Legenda). Strato Interfacce: come oggi, nessun cavo. Strato Cavi: blocchi e cavi soltanto; niente fili, etichette dei fili, blocchi tondi, legenda dei fili; dalle porte non si tirano fili. Le porte piene sono quelle con un filo cablato.
- **AC-4 Disegno dei cavi**: linea continua spessa (colore `cavi.colore`) da un lato all'altro dei due blocchi, instradata intorno ai blocchi come i fili (spec 0033); più cavi sullo stesso lato si distribuiscono lungo il bordo. Etichetta con sigla e numero di fili (con Etichette accese). Clic: seleziona e apre il dettaglio nell'Ispettore; clic destro: elimina (con conferma).
- **AC-5 Creazione**: nello strato Cavi ogni blocco ha una maniglia (connettore) nell'intestazione: trascinandola su un altro blocco nasce un cavo con dentro tutti i fili di interfaccia ancora senza cavo fra i due blocchi. Dall'Ispettore di un filo di interfaccia (strato Interfacce): riga **Cavo** con la scelta fra i cavi fra gli stessi blocchi, "nessuno" o **+ Nuovo cavo**.
- **AC-6 Ispettore del cavo**: sigla, tipo (suggerimenti da `cavi.tipi`), connettore lato A e lato B (suggerimenti da `cavi.connettori`), lunghezza in metri, P/N, note; elenco con spunta dei fili fra i due blocchi (un filo già in un altro cavo mostra quale e si sposta se spuntato); Elimina cavo.
- **AC-7 Pannello Cavi**: sezione con contatore nella testata, pannello nel gruppo sotto la lavagna. Colonne: sigla, da, a, livello, tipo, connettore A, connettore B, lunghezza, P/N, fili (numero e id dei requisiti). Ricerca, ordinamento, CSV con `;`. Clic: apre il livello, passa allo strato Cavi e seleziona il cavo. Interfacce ha la colonna **Cavo**; la Dashboard il riquadro **Cablaggio** (fili di interfaccia in un cavo, x / y).
- **AC-8 Matrioska**: l'interno di un blocco di libreria porta anche i suoi cavi; istanziandolo i cavi si copiano con i nuovi id (un cavo che perde un estremo si scarta, i fili scartati escono dal cavo).
- **AC-9 Aiuto**: voci in `SUGGERIMENTI` per i pulsanti e i campi nuovi.

## Decision

- **Cavo nel livello, fili per id**: il cavo vive nel grafo del livello dove stanno i suoi due blocchi, come i fili; riferisce i fili per id. Nessun dato nella libreria, nessun campo nuovo nei fili: lo strato logico resta identico e non sa nulla dei cavi.
- **Un cavo = coppia di blocchi, molti fili**: è il caso del cablaggio reale (un connettore porta più segnali). Scartato il cavo per singola interfaccia dell'IDV (con due blocchi collegati da dieci fili diventano dieci cavi) e il cavo a più tratti attraverso connettori intermedi (rinviato).
- **Strati esclusivi, non sovrapposti**: un selettore e non due interruttori, così i due disegni non compaiono mai insieme (richiesta esplicita). Le immagini dei diagrammi (spec 0029) restano dello strato Interfacce.
- **Pulizia in `render()`**: `riallineaCavi()` toglie riferimenti a fili e blocchi spariti in tutto il progetto, così Annulla, Ripeti, Salva di un blocco ed eliminazioni restano coerenti senza codice in ogni punto.
- **Nessun controllo di Coerenza nuovo**: un filo senza cavo non è un errore (molte interfacce non sono elettriche); lo dicono il pannello Cavi e la Dashboard.

## Build plan

1. `cavi.ts` puro: regole, sigla libera, nuovo cavo, assegnazione, `riallineaCavi()`, geometria degli estremi, elenco per il pannello; test unitari.
2. Lavagna: strato in `vista`, `#caviLayer`, disegno, maniglia, selezione; Ispettore del cavo e riga Cavo nel filo.
3. Pannello Cavi, colonna Cavo, riquadro Dashboard, contatore; impostazioni `cavi`; matrioska; aiuto, tutorial; e2e.
