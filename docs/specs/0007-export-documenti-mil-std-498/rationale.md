# 0007. Rationale: export dei documenti MIL-STD-498

## Context

Il modello contiene già tutto ciò che serve ai documenti formali: ogni requisito di libreria ha testi da esportare legati a un documento (SSS, SSDD, IRS, IDD, SRS, SDD o un nome scritto a mano), un metodo di verifica, una classe (capacità o tipologia di interfaccia) e, grazie ai fili di derivazione, i suoi requisiti padre. Oggi però per scrivere un documento bisogna copiare a mano centinaia di testi, rifare la tabella di qualifica e la tracciabilità, con il rischio che il documento e il modello divergano alla prima modifica.

MIL-STD-498 prescrive per ogni documento un DID (Data Item Description), cioè l'elenco dei capitoli con numero e contenuto. I documenti di requisiti (SSS, SRS, IRS) hanno capitoli per capacità e interfacce, le disposizioni di qualifica (con quale metodo si verifica ogni requisito) e la tracciabilità verso il livello superiore; i documenti di progetto (SSDD, SDD, IDD) descrivono componenti e interfacce e hanno anch'essi la tracciabilità ma non la qualifica. Molti capitoli (stati e modi, decisioni di progetto, ambiente) non hanno un corrispondente nel modello.

Vincoli: niente build e niente npm, un solo utente in locale, UI in italiano. Gerarchia (spec 0005), Coerenza (spec 0004) e Matrice (spec 0006) hanno già regole condivise su chi è padre di chi e su cosa è un requisito senza padre: un quarto strumento che le ricalcolasse a modo suo rischierebbe di contraddirle. La voce è marcata Beta nello scope, quindi va verificata con particolare cura.

## Options considered

### Option 1: generatore dichiarativo sopra la matrice (scelta)

Un modulo `js/documenti.js` con i DID descritti come dati (albero di capitoli con un tipo), numerati da una funzione e riempiti dai requisiti presi dalla matrice della spec 0006. Una finestra con selettore, riepilogo, anteprima ed export.

**Pros**:
- Regole di derivazione e senza padre identiche alla matrice.
- Capitoli opzionali e numerazione gestiti da un solo passo; aggiungere un DID è aggiungere dati.
- Anteprima prima di scaricare.

**Cons**:
- Un modulo nuovo di qualche centinaio di righe e una piccola estensione di `calcolaMatrice()` già verificata.
- La capitolazione è fissata nel codice.

### Option 2: modelli Markdown con segnaposto in `settings.json` o in file

Un file modello per documento con segnaposto (`{{capacita}}`, `{{qualifica}}`) che il generatore sostituisce.

**Pros**:
- L'utente può cambiare la capitolazione senza toccare il codice.

**Cons**:
- La numerazione va scritta a mano nel modello e si rompe con i capitoli opzionali (le tipologie presenti cambiano da progetto a progetto, così i numeri dei sottocapitoli).
- Serve un piccolo linguaggio di modelli da progettare, documentare e validare; nessuna richiesta di personalizzazione è emersa.

### Option 3: export unico con tutti i documenti

Un solo file con un capitolo per documento, o uno zip.

**Pros**:
- Un clic per tutto.

**Cons**:
- Lo scope chiede un file per documento con la sua capitolazione; uno zip richiede una libreria (niente npm) o un formato fatto a mano.

## Rationale

La forza principale è la coerenza con gli strumenti esistenti: la matrice calcola già padri, documenti e senza padre con le regole della Coerenza, e il capitolo di tracciabilità di un documento è esattamente una vista filtrata di quella tabella. Partire da `calcolaMatrice()` costa un campo in più (`voci`) e toglie ogni possibilità di contraddizione, come la spec 0006 aveva previsto nelle sue conseguenze.

La descrizione dichiarativa dei DID con numerazione calcolata risponde al problema concreto della numerazione variabile: in IRS ogni tipologia presente diventa un capitolo, e il capitolo Precedenza scala di numero; in SSS i capitoli 4 e 5 citano i numeri del 3. Un modello testuale (Option 2) sposterebbe questa complessità su chi scrive il modello, senza un bisogno espresso di personalizzazione. Se servirà, la costante `DID` è già il punto unico da rendere configurabile.

Per le interfacce esterne e interne si è scelto di non indovinare: il modello non porta questa informazione e una regola basata sul livello del blocco sbaglierebbe sui sottosistemi annidati. Mettere tutto in 3.3 è prevedibile e facile da correggere a mano.

### Decisioni prese in autonomia

La funzionalità è stata progettata in modalità autonoma su richiesta dell'utente (scelta sempre dell'opzione raccomandata). Le scelte principali, con l'alternativa scartata, sono nel `## Decision` di [index.md](index.md): fonte dati dalla matrice, DID dichiarativi, interfacce tutte esterne, voci del selettore dalla libreria intera, anteprima troncata, nessun riferimento esterno nella spec.
