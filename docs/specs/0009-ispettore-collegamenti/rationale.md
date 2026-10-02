# 0009. Rationale: ispettore dei collegamenti

## Context

Oggi un filo si può solo creare, spostare con gli snodi ed eliminare con il clic destro. Il suo tooltip dice classe e id dei due estremi, ma non i testi, il metodo di verifica o il blocco. Per capire una derivazione bisogna aprire i blocchi. Il pannello destro mostra già il form di un blocco o il dettaglio di un requisito cliente; la selezione di un blocco è `activeNodeId` in `state.js`. Annulla, Ripeti e Ricarica sostituiscono gli oggetti del modello, quindi ogni selezione va tenuta per id.

## Options considered

### Option 1: selezione nel renderer e dettaglio nell'ispettore (scelta)
**Pros**: segue i pattern esistenti (selezione del blocco, dettaglio del cliente); nessun modulo nuovo.
**Cons**: `renderer.js`, già lungo, cresce ancora un po'.

### Option 2: modulo `collegamenti.js` dedicato
**Pros**: separa la funzione.
**Cons**: dovrebbe importare molte funzioni private del renderer (estremi, livello), aumentando il ciclo di import.

### Option 3: tooltip più ricco, senza selezione
**Pros**: nessuno stato nuovo.
**Cons**: niente pulsante di eliminazione, testi lunghi illeggibili in un tooltip, non soddisfa "il filo selezionato è evidenziato".

## Rationale

La selezione per id con risoluzione in `render()` è lo stesso schema usato dalla Gerarchia per la scelta, già verificato con Annulla e Ricarica. Il dettaglio nell'ispettore riusa `rigaDettaglio()` e lo stile del dettaglio cliente.

### Decisioni prese in autonomia

Spec scritta in modalità autonoma su richiesta dell'utente (opzione raccomandata a ogni scelta): clic sinistro seleziona, sfondo deseleziona senza rompere il pan, sezioni Padre/Figlio o Da/A, eliminazione condivisa con il clic destro, nessun riferimento esterno.
