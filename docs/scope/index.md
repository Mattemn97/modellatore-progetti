# Scope: Modellatore di Requisiti a Blocchi (MBSE)

Editor di sistemi a blocchi annidati, collegati da fili che rappresentano i requisiti. Parte dai requisiti cliente, li fa scendere fino ai blocchi che li coprono e genera i documenti formali MIL-STD-498 (SSS, SSDD, IRS, IDD…) con la matrice di tracciabilità. Un utente, in locale, su Windows.

**Build approach:** Tracer Bullet (ogni funzionalità completa e funzionante, dai dati all'interfaccia al file, prima della successiva). Nella riscrittura v2 vuol dire "a strati": prima il guscio desktop con il codice di oggi, poi i file senza server, poi TypeScript, poi i pannelli, con l'app sempre completa a ogni passo.
**Workflow:** Beta (dopo `/develop`, `/check verify` poi `/test`). È il livello di rigore predefinito dalla v2; le voci della v1 sono state chiuse con Alpha. `/architect` è la prima tappa consigliata per una funzionalità con una decisione da prendere, ma puoi saltarla se sai già come costruirla. Ogni funzionalità può avere un suo tag (es. `· GA`) per fare di più o di meno.

_Sono consigli per costruire con ordine, non obblighi. Salta quello che non ti serve: se sai già come costruire una funzionalità, usa `/develop` e salta `/architect`. Decidi tu quando una funzionalità è `done`._

## Epic

- [v1-web.md](v1-web.md): editor web con server locale (1.x). 18 voci, tutte `done` o `existing`.
- [v2-desktop.md](v2-desktop.md): app desktop Windows in TypeScript, pannelli agganciabili, installabile (2.0.0). 15 voci; prossima la 19.

## At a glance

| # | Feature | Epic | Phase | Status |
|---|---------|------|-------|--------|
| A | Editor a blocchi annidati | v1 | Esistente | existing |
| B | Modello dati interfaccia e capacità | v1 | Esistente | existing |
| C | Import ed export JSON manuale | v1 | Esistente | existing |
| 1 | Salvataggio automatico del progetto | v1 | Foundation | done |
| 2 | Libreria su disco con changelog | v1 | Foundation | done |
| 3 | Import requisiti cliente | v1 | Slice 1 | done |
| 4 | Controllo di coerenza | v1 | Slice 2 | done |
| 5 | Gerarchia dei requisiti | v1 | Slice 3 | done |
| 6 | Matrice di tracciabilità | v1 | Slice 3 | done |
| 7 | Export documenti MIL-STD-498 | v1 | Slice 3 | done |
| 8 | Filtri avanzati | v1 | Slice 4 | done |
| 9 | Ispettore dei collegamenti | v1 | Slice 4 | done |
| 10 | Gestione completa della libreria | v1 | Slice 4 | done |
| 11 | Rifiniture dell'editor | v1 | Slice 4 | done |
| 12 | Tutorial e aiuto contestuale | v1 | Slice 5 | done |
| 13 | Protezione dei dati negli aggiornamenti | v1 | Slice 6 | done |
| 14 | Console del server più leggibile | v1 | Slice 6 | done |
| 15 | Controllo e aggiornamento automatico | v1 | Slice 6 | done |
| 16 | Stack desktop e struttura TypeScript | v2 | Foundation | done |
| 17 | Standard, strumenti e CI su develop | v2 | Foundation | done |
| 18 | Rete di sicurezza end to end | v2 | Foundation | done |
| 19 | Progetti su disco senza server | v2 | Slice 1 | planned |
| 20 | Libreria, changelog e import senza server | v2 | Slice 1 | planned |
| 21 | Impostazioni e cartelle di lavoro | v2 | Slice 1 | planned |
| 22 | Import dei dati dalla versione 1 | v2 | Slice 1 | planned |
| 23 | Passaggio del codice a TypeScript | v2 | Slice 2 | planned |
| 24 | Sistema a pannelli agganciabili | v2 | Slice 3 | planned |
| 25 | Matrice, Documenti e Changelog come pannelli | v2 | Slice 3 | planned |
| 26 | Pannelli in finestre staccate | v2 | Slice 3 | planned |
| 27 | Tour, aiuto e tutorial sui pannelli | v2 | Slice 3 | planned |
| 28 | Installabile Windows per utente | v2 | Slice 4 | planned |
| 29 | Aggiornamento automatico della versione desktop | v2 | Slice 4 | planned |
| 30 | Rilascio 2.0.0 e passaggio dalla 1.x | v2 | Slice 4 | planned |

## Legend

**La casella di decisione.** Ogni funzionalità ne ha una, quella che finisce con `(spec)`. Il testo può variare, quindi le skill la trovano dal suffisso `(spec)`, mai dal testo esatto. Tutte le altre caselle sono di esecuzione e `/architect` non le spunta mai.

**Ciclo di vita di una funzionalità**:

| Stato | Chi lo imposta | Cosa mostra |
|---|---|---|
| `planned` · needs a decision | `/scope` | una casella: `Design it (spec): /architect <funzionalità>` |
| `in-progress` (progettata) | `/architect` alla cattura della spec | `Design it` spuntata, spec collegata, `Build it: /develop <funzionalità>` con 2 a 5 tappe, poi `Verify it` (Alpha e oltre), `Test it` (Beta e oltre) |
| `in-progress` (in costruzione) | `/develop` | le tappe si spuntano una alla volta, compare il puntatore al codice |
| `in-progress` (verificata) | `/check verify` | `Build it` e `Verify it` spuntate |
| `done` | tu, quando decidi; `/sync` riallinea | Alpha: dopo `/check verify`; Beta: dopo `/test` |

- **Prossimo passo** = la prima casella non spuntata.
- **needs a decision** = prima `/architect`, altrimenti direttamente `/develop`.
- I compiti di dettaglio stanno nel `## Build plan` della spec, non qui.
- **Status**: `planned` → `in-progress` → `done`, più `existing` (fatto prima di questo flusso) e `dropped` (tolto dal piano, tenuto per storia).
- **Tag di livello** accanto al titolo (es. `· Beta`): più o meno rigore per quella sola funzionalità. Senza tag vale il livello dell'epic: Alpha per v1, Beta per v2.
- **Workflow**: Prototype = niente dopo `/develop`; Alpha = `/check verify`; Beta = `/check verify` poi `/test`; GA = aggiunge `/check review` e `/document`.
- **Riga puntatore** (`spec <n> · code in <path>`): la spec la aggiunge `/architect`, il codice `/develop`.
