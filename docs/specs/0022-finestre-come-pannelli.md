# 0022. Matrice, Documenti e Changelog come pannelli

**Date**: 2026-10-05
**Status**: Accepted

## Summary

Le finestre Matrice di tracciabilità, Documenti MIL-STD-498 e Changelog della libreria diventano pannelli del sistema della spec 0021: si tengono aperti accanto al canvas mentre lavori e si aggiornano da soli quando il modello (o la libreria) cambia. Apri progetto e l'import cliente restano finestre, perché sono scelte da fare una volta e poi chiudere. Nessuna nuova libreria: si riusa `pannelli.ts`.

## Requirements

**Acceptance criteria**:
- **AC-1**: I pulsanti 📊 Matrice Requisiti, 📄 Documenti e 📜 Changelog (e il link al changelog di un blocco nell'Ispettore) aprono il pannello corrispondente o lo portano in primo piano. Il primo dei tre si apre in un gruppo sotto il Canvas (circa il 40% dell'altezza); gli altri si impilano a schede nello stesso gruppo se è ancora aperto. Il menu Finestra elenca anche Matrice, Documenti e Changelog.
- **AC-2**: Con il pannello aperto, una modifica al modello (blocchi, fili, requisiti, cliente, Annulla e Ripeti, un altro progetto) aggiorna Matrice e Documenti entro mezzo secondo, senza perdere filtri, documento scelto e posizione di scorrimento. Un pannello nascosto dietro un'altra scheda non ricalcola: lo fa quando torna visibile.
- **AC-3**: Il Changelog si rilegge quando la libreria cambia (salvataggio, eliminazione o rinomina di un blocco, ricarica, un'altra libreria) e quando il pannello torna visibile; il testo del filtro resta. Senza una libreria aperta tramite l'app il pannello lo dice al suo interno, senza `alert`.
- **AC-4**: Filtri, conteggi, "mostra altri", export `.md`, clic su un requisito della Matrice (apre la Gerarchia su quel requisito, la Matrice resta aperta) e i mini tour ❓ Guida funzionano come oggi.
- **AC-5**: I pannelli non sono finestre modali: con uno di essi attivo Ctrl+Z e Ctrl+Y annullano e ripetono (fuori dai campi di testo), Esc fa quello che fa sul canvas e non chiude il pannello. Si chiudono con la ✕ della scheda o dal menu Finestra.
- **AC-6**: Il layout salvato con questi pannelli aperti si riapre con loro aperti e calcolati; un layout salvato prima di questa voce resta valido.

## Decision

**Chosen option**: tre pannelli nuovi in `pannelli.ts` (`matrice`, `documenti`, `changelog`), con i contenuti di oggi spostati dalle finestre modali; Apri progetto resta in `#reportModal`.

**Decisioni di dettaglio**:
- **Apri progetto resta finestra**: senza un progetto aperto deve bloccare la pagina finché non ne scegli o crei uno, e dopo la scelta si chiude. Un pannello non porta niente qui. `#reportModal` serve solo a lei; il Changelog ha il suo contenitore `#pannelloChangelog`.
- **Contenitori**: `#pannelloMatrice`, `#pannelloDocumenti`, `#pannelloChangelog` dentro `#pannelliParcheggiati`, con gli stessi id interni di oggi (`#matriceFiltri`, `#anteprimaDocumento`, …). La testata della finestra lascia il posto a una riga con il solo pulsante ❓ Guida (il titolo è sulla scheda, la ✕ pure); spariscono `#btnChiudiMatrice`, `#btnChiudiDocumenti`, `#matriceModal`, `#documentiModal`.
- **Posizione**: nuova funzione di posizione in `pannelli.ts`: per questi tre, dentro il gruppo di un altro dei tre se aperto, altrimenti `direction: 'below'` rispetto al Canvas con `initialHeight` pari al 40% dell'area. Titoli delle schede: Matrice, Documenti, Changelog.
- **Aggiornamento**: `render()` chiama `segnaMatriceDaAggiornare()` e `segnaDocumentiDaAggiornare()`; ognuna fa partire un timer di 250 ms (si ricalcola una volta dopo una raffica di modifiche) e ricalcola solo se `pannelloVisibile()`, altrimenti resta un segno "da aggiornare" consumato da `allaVista`. Il calcolo è quello di oggi all'apertura (`calcolaGerarchia` + `calcolaMatrice`, più `preparaDatiDocumenti`), con i filtri e il documento scelto mantenuti e lo scorrimento ripristinato.
- **Changelog**: `mostraChangelog(filtro?)` apre il pannello e lo carica; `adotta()` in `libreria.ts` (ogni cambio di stato della libreria) chiama `segnaChangelogDaAggiornare()`, che rilegge subito se il pannello si vede, altrimenti alla prossima vista. Il filtro è un campo fisso nel pannello (non più ricreato a ogni apertura), così il testo resta.
- **Chiusura**: alla chiusura del pannello Matrice e Documenti liberano il risultato calcolato come fa oggi `chiudiMatrice()`; i filtri restano finché la pagina è aperta.
- **Scorciatoie**: `modaleAperta()` non conta più Matrice, Documenti e Changelog (solo tour, Apri progetto, Impostazioni, import cliente).
- **Layout salvato**: i nuovi id entrano in `PANNELLI`; la versione del layout resta 1, perché un layout vecchio contiene solo id ancora validi.

## Build plan

1. `pannelli.ts`: tre id nuovi, titoli, posizione sotto il Canvas, voci del menu Finestra; HTML dei tre contenitori al posto delle finestre, `#reportModal` solo per Apri progetto; satisfies **AC-1**, **AC-6**
2. Matrice e Documenti come pannelli con aggiornamento differito da `render()`, filtri e scorrimento mantenuti, clic verso la Gerarchia senza chiudere; satisfies **AC-2**, **AC-4**
3. Changelog come pannello con filtro fisso, ricarica al cambio di libreria e messaggio senza libreria; `modaleAperta()` ridotta; satisfies **AC-3**, **AC-5**
4. Test: aggiornare `tracciabilita.spec.ts` e `libreria.spec.ts`; un test e2e che con la Matrice aperta aggiunge un filo e la vede aggiornata, e Ctrl+Z la riporta indietro; satisfies **AC-2**, **AC-5**

## Consequences

**Positive**: Matrice e Documenti si consultano mentre modelli, anche su un secondo monitor con la voce 26.
**Negative**: un ricalcolo della matrice dopo ogni raffica di modifiche quando il pannello si vede; su modelli molto grandi il ritardo di 250 ms è la valvola, da alzare se serve.
**Neutral**: i test che chiudevano le finestre con la ✕ cambiano selettore; il tutorial si aggiorna nella voce 27.
