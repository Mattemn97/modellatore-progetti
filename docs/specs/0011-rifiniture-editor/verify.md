# Verify: Rifiniture dell'editor · spec 0011 · updated 2026-10-02
_Steps derived from spec 0011 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Rilascio di un blocco a zoom 1, a zoom 2,1 con pan e a zoom 0,4 → angolo in `round((P − dimensione/2) / griglia) × griglia`, cursore dentro il blocco → AC-1
- [x] Porte con classe `porta-interfaccia`: cursore `crosshair`, con Shift `move`, rilasciato Shift o perso il fuoco `crosshair`; suggerimento del pin invariato → AC-3
- [x] Riga di aiuto visibile con il testo della spec, un clic sul testo arriva al canvas, `✕` la nasconde, dopo il ricaricamento resta nascosta → AC-2
- [x] Con `localStorage` bloccato la pagina funziona, la riga è visibile e `✕` la nasconde → AC-2
- [x] Nessun errore in console

## Acceptance-criteria coverage
- AC-1 … rilascio a tre zoom · AC-2 … aiuto, ricarica, senza localStorage · AC-3 … cursore con Shift
