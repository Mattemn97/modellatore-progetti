# 0031. Filtri per colonna nella Matrice

**Date**: 2026-10-07
**Status**: Done

## Summary

Ogni intestazione delle tabelle della Matrice di tracciabilità (spec 0006, pannello della spec 0022) ha un pulsante ▼ che apre un menu come quello di Excel: ordinamento A→Z e Z→A, una casella di ricerca, l'elenco dei valori della colonna da spuntare. I filtri di più colonne si combinano fra loro e con Documento, Lato, Classe e Ricerca; `Pulisci filtri` azzera tutto. L'export Markdown segue filtri e ordinamento.

## Context

La Matrice oggi ha quattro filtri globali (spec 0006, AC-8). Chi lavora su matrici di centinaia di derivazioni chiede di restringere per un blocco, un metodo o una nota senza combinare a mano quei filtri. Voce 58 dello scope ([feedback-utenti.md](../scope/feedback-utenti.md)). La tabella delle derivazioni è raggruppata per padre (celle del padre con `rowspan`), quella `Senza padre` ha una riga per requisito.

## Requirements

**Acceptance criteria**:
- **AC-1**: Ogni intestazione delle due tabelle ha un pulsante ▼ (`.menu-colonna`, `data-colonna="<chiave>"`). Il menu, dentro il pannello, ha: `Ordina A→Z`, `Ordina Z→A`, una casella `Cerca…`, la voce `(Seleziona tutto)`, un valore per riga con la sua casella (i valori vuoti come `(vuote)`), `OK` e `Annulla`. Esc o un clic fuori dal menu lo chiude senza applicare.
- **AC-2**: I valori del menu sono quelli distinti della colonna nelle righe che passano tutti gli altri filtri (globali e delle altre colonne), in ordine naturale (`Intl.Collator('it', { numeric: true })`). Le colonne Documenti danno un valore per documento. La ricerca restringe l'elenco senza maiuscole e minuscole; con una ricerca attiva `OK` tiene solo i valori spuntati fra quelli visibili.
- **AC-3**: Una riga passa il filtro di una colonna se il suo valore è fra quelli scelti (per Documenti: se almeno uno dei suoi documenti lo è). Nella tabella delle derivazioni la riga è una coppia padre → figlio (un padre senza figli è una riga con le celle del figlio vuote); un gruppo resta se ha almeno una riga. Tutti spuntati = nessun filtro sulla colonna. I filtri di colonna si combinano in AND fra loro e con i filtri globali.
- **AC-4**: Ordinamento, uno per tabella: sulle colonne del padre e su Note si ordinano i gruppi; sulle colonne del figlio, Classe e Istanze si ordinano le righe dentro ogni gruppo e i gruppi per la loro prima riga. Senza ordinamento resta l'ordine della spec 0006 (AC-7).
- **AC-5**: Una colonna filtrata ha il pulsante evidenziato (`.filtrata`) e il simbolo del filtro; una colonna ordinata mostra ↑ o ↓ accanto al nome. `Pulisci filtri` nella barra azzera filtri globali, filtri di colonna e ordinamenti; è disattivato quando non c'è niente da pulire.
- **AC-6**: L'export `.md` usa le righe filtrate e ordinate; la riga `Filtri:` elenca anche i filtri di colonna (`Blocco padre: Alimentatore, Batteria`) e l'ordinamento (`Ordine: Metodo figlio Z→A`).
- **AC-7**: Funziona con il pannello staccato (spec 0023): il menu si apre nella finestra del pannello. I filtri di colonna restano finché la pagina è aperta, come quelli globali (spec 0006, AC-12); un valore scelto che sparisce dal modello non rompe nulla.
- **AC-8**: Aiuto: `data-aiuto="matrice.colonna"` sul pulsante ▼, `matrice.pulisci` su `Pulisci filtri`; il tour della Matrice cita i menu delle colonne.

## Decision

- **Filtro per riga, nella funzione pura**: `filtraMatrice()` riceve anche `colonne` (chiave → valori scelti) e `ordine` (per tabella) e restituisce righe già filtrate e ordinate; `valoriColonna()` calcola l'elenco del menu rifiltrando senza quella colonna. Tutto testabile senza pagina, export e video usano lo stesso risultato.
- **Inclusione, non esclusione**: si salvano i valori scelti, come Excel. Un requisito nuovo con un valore non scelto non compare finché il filtro è attivo: è il comportamento che gli utenti conoscono.
- **Menu dentro il pannello**: un solo elemento `#menuColonnaMatrice` figlio di `#pannelloMatrice`, posizionato sul pulsante; si sposta con il pannello quando si stacca, quindi nessun listener sul `document` della pagina principale (AGENTS.md, gotcha dei pannelli staccati).
- Scartato: una riga di filtri sotto le intestazioni (occupa spazio in un pannello basso) e una libreria di tabelle (nessuna dipendenza nuova per una tabella raggruppata con `rowspan`).

## Build plan

1. Colonne con le loro funzioni di valore, `filtraMatrice()` con filtri di colonna e ordinamento, `valoriColonna()`, descrizione nell'export; test unitari.
2. Intestazioni con ▼, menu, `Pulisci filtri`, stili, aiuto e tour.
3. E2e: filtro su Blocco figlio, ordinamento, combinazione con Documento, export, Pulisci filtri.

## Consequences

- Positivo: si trova al volo una derivazione in una matrice grande, e l'export riflette quello che si vede.
- Negativo: con un filtro di colonna attivo un requisito nuovo resta nascosto finché non si pulisce il filtro (come in Excel).
