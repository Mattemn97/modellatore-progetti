# 0034. Blocchi di libreria con l'interno (matrioska)

**Date**: 2026-10-07
**Status**: Done

## Summary

Un blocco di libreria può avere un **interno standard**: i blocchi figli con i loro interni, i fili e le posizioni dei blocchi tondi. Lo si salva dall'Ispettore di un'istanza con `📦 Salva l'interno in libreria`; ogni nuova istanza trascinata dalla libreria nasce con quella struttura dentro, a ogni livello. Le istanze già nel progetto non cambiano. La modifica passa dal salvataggio della libreria (spec 0002) ed entra nel changelog.

## Context

Oggi un blocco di libreria è solo titolo, descrizione, categoria e requisiti (`tipi.ts`, `Blocco`); l'interno vive nell'istanza (`node.internal_graph`). Un sottosistema ricorrente va ricostruito a mano in ogni progetto. Voce 61 dello scope ([feedback-utenti.md](../scope/feedback-utenti.md)).

## Requirements

**Acceptance criteria**:
- **AC-1**: `Blocco.interno?: Grafo` nel file della libreria (`{ nodes, edges, parentReqPositions? }`, come `internal_graph`). Facoltativo: una libreria della 2.1.0 si apre e si salva come prima; `normalizzaBlocco()` conserva `interno` e ogni salvataggio di un blocco dall'Ispettore lo rimanda (prima si perdeva ogni campo non noto).
- **AC-2**: Nell'Ispettore di un'istanza, sezione `Questa istanza`, `📦 Salva l'interno in libreria` (disattivato se l'interno dell'istanza è vuoto o la libreria è in sola lettura) chiede conferma con il riepilogo (`N blocchi, M fili`) e salva il blocco con `interno` = copia dell'interno dell'istanza, tutti i livelli compresi. Usa Livello e Motivo del form; il changelog registra il campo `interno standard` del blocco.
- **AC-3**: Rifiuti al salvataggio, con un messaggio che dice cosa fare: un interno che contiene, a qualsiasi profondità, un'istanza del blocco stesso (anche attraverso l'interno standard di un altro blocco); un interno con blocchi che la libreria non ha (elencati).
- **AC-4**: Un blocco trascinato dalla libreria sul canvas nasce con una copia del suo interno standard: id nuovi per nodi e fili, fili e posizioni ripuliti dai requisiti che non esistono più. Un blocco figlio con l'interno vuoto ma con un interno standard in libreria lo riceve a sua volta (matrioska), con un limite di profondità contro i cicli. Le istanze già presenti non cambiano.
- **AC-5**: Blocchi figli assenti dalla libreria: al rilascio non si creano e un avviso li elenca, insieme ai fili tolti perché non più validi. Nell'albero della libreria un blocco con interno standard ha il segno 📦; se il suo interno usa blocchi assenti, il segno ⚠ con l'elenco nel suggerimento.
- **AC-6**: Con un interno standard, l'Ispettore dell'istanza mostra `Interno standard in libreria: N blocchi, M fili` e `✕ Togli l'interno dalla libreria` (con conferma, un salvataggio della libreria senza `interno`).
- **AC-7**: Rinominare i requisiti di un blocco dall'Ispettore aggiorna anche i riferimenti del suo interno standard (fili verso i blocchi tondi, posizioni). Rinominare l'id di un blocco (spec 0010) aggiorna il tipo delle sue istanze dentro gli interni standard di tutti i blocchi. Eliminarlo dalla libreria avvisa, nella conferma, quali interni standard lo usano.
- **AC-8**: Aiuto: `ispettore.salvaInterno`, `ispettore.togliInterno`, `libreria.interno`.

## Decision

- **L'interno è una fotografia dell'istanza**, con tutti i livelli: chi lo salva vede esattamente cosa riceveranno le nuove istanze. In più, un figlio con l'interno vuoto prende l'interno standard del suo tipo (matrioska), così un sottosistema aggiornato in libreria arriva anche dentro gli altri. Scartato: solo riferimenti ai tipi, un livello alla volta (un interno personalizzato di un figlio andrebbe perso).
- **Applicato solo alla creazione**: le istanze esistenti non cambiano da sole (richiesta esplicita); niente sincronizzazione continua, che cambierebbe progetti già consegnati.
- **Nessun cambio dell'API di salvataggio**: il server salva il blocco così com'è e `confrontaBlocco()` confronta già ogni campo del blocco, quindi `interno` finisce nel changelog come campo modificato (livello patch, o quello scelto nel form). Solo la rinomina di un blocco (processo principale) aggiorna i tipi dentro gli interni.
- **Modulo puro `matrioska.ts`**: istanziazione, controlli e riepiloghi testabili senza pagina.

## Build plan

1. `matrioska.ts` (istanziazione, contiene se stesso, blocchi mancanti, riepilogo, rinomina dei requisiti nell'interno) con test unitari; `normalizzaBlocco()` e salvataggio dall'Ispettore che conservano `interno`.
2. Rilascio sul canvas con l'interno; Ispettore con Salva e Togli; segni nell'albero; rinomina nel processo principale; conferma dell'eliminazione.
3. E2e: salvo l'interno da un'istanza, il changelog lo registra, un nuovo blocco trascinato lo ha; un blocco che contiene se stesso è rifiutato.

## Consequences

- Positivo: un sottosistema ricorrente si costruisce una volta e si riusa in ogni progetto.
- Negativo: il file della libreria cresce con gli interni; rinominare i requisiti di un blocco *figlio* non aggiorna gli interni standard che lo contengono: i fili non più validi si tolgono al rilascio, con un avviso, e basta salvare di nuovo l'interno.
