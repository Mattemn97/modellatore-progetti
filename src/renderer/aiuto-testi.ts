/* --- TESTI DELL'AIUTO: SUGGERIMENTI DELLE (i) E PASSI DEI TOUR (spec 0012) --- */

export interface Suggerimento {
    titolo: string;
    testo: string;
}

// Un passo di un tour: area = selettore CSS (null = fumetto al centro); prepara = pannelloSinistro | pannelloDestro | pannello:<id>
export interface PassoTour {
    area: string | null;
    titolo: string;
    testo: string;
    prepara?: string;
}

// Ogni data-aiuto="chiave" dell'interfaccia ha qui la sua voce. Chiavi a punti per area.
export const SUGGERIMENTI: Record<string, Suggerimento> = {
    // Header
    'header.annulla': { titolo: 'Annulla (Ctrl+Z)', testo: "Torna allo stato del progetto prima dell'ultima modifica salvata. Usa le copie che il server tiene in progetti/_versioni/." },
    'header.ripeti': { titolo: 'Ripeti (Ctrl+Y)', testo: "Rifà la modifica appena annullata. Si svuota appena fai una modifica nuova." },
    'header.salvataggio': { titolo: 'Stato del salvataggio', testo: "Ogni modifica viene scritta da sola sul file del progetto dopo circa un secondo. Verde: salvato. Giallo: modifica in attesa. Rosso: errore o conflitto, leggi il banner sotto l'header." },
    'header.progetto': { titolo: 'Menu Progetto', testo: "Crea, apri, copia, rinomina o elimina un progetto della cartella progetti/. Da qui puoi anche importare o scaricare il progetto come JSON." },
    'header.aiuto': { titolo: 'Aiuto', testo: "Rilancia il tour guidato dell'interfaccia e mostra o nasconde le icone (i) accanto ai campi." },
    'header.finestra': { titolo: 'Finestra', testo: "I pannelli dell'interfaccia: la spunta indica quelli aperti. Scegline uno chiuso per riaprirlo, uno aperto per portarlo in primo piano. Ripristina layout torna alla disposizione di partenza. La disposizione si salva da sola." },
    'finestra.ripristina': { titolo: 'Ripristina layout', testo: "Rimette i pannelli come al primo avvio: Libreria e Cliente a sinistra, Canvas al centro, Ispettore a destra. Le finestre staccate tornano dentro. Il progetto non cambia." },
    'pannelli.stacca': { titolo: 'Stacca o riaggancia', testo: "⧉ apre questo gruppo di pannelli in una finestra separata, che puoi spostare su un altro monitor. Nella finestra staccata ⤓ lo rimette nella finestra principale; chiuderla fa lo stesso. Il Canvas resta sempre nella finestra principale." },
    'header.impostazioni': { titolo: 'Impostazioni', testo: "Dove stanno i tuoi progetti e le tue librerie, e il file settings.json con griglia, colori, tipologie e documenti." },

    // Finestra Impostazioni (spec 0019)
    'impostazioni.lavoro': { titolo: 'Cartella di lavoro', testo: "Contiene progetti/ (con versioni e cestino) e settings.json. Cambiandola, l'editor si riapre sui progetti della cartella nuova." },
    'impostazioni.librerie': { titolo: 'Cartella delle librerie', testo: "Dove stanno le librerie dei blocchi con changelog e copie. I progetti la chiamano shared/ (es. shared/libreria.json): spostandola, anche su un disco di rete, i progetti continuano a trovarla." },
    'impostazioni.settings': { titolo: "Impostazioni dell'editor", testo: "Il file settings.json della cartella di lavoro: griglia, dimensioni, colori delle tipologie, metodi di verifica e documenti. Le modifiche valgono dal prossimo avvio." },
    'impostazioni.cambia': { titolo: 'Cambia cartella', testo: "Scegli un'altra cartella. Il cambiamento vale solo dopo Applica." },
    'impostazioni.apri': { titolo: 'Apri in Esplora risorse', testo: 'Apre la cartella in Esplora risorse di Windows.' },
    'impostazioni.predefinita': { titolo: 'Cartella predefinita', testo: 'Rimette le librerie nella cartella shared dentro la cartella di lavoro.' },
    'impostazioni.apriSettings': { titolo: 'Apri settings.json', testo: "Apre settings.json con il programma associato ai file .json. Salva il file e riavvia il modellatore per vedere le modifiche." },
    'impostazioni.importaV1': { titolo: 'Dati della versione 1', testo: "Se usavi la versione 1 (start.exe), qui copi i suoi progetti e le sue librerie nelle cartelle di questa versione, con versioni, cestino, changelog e settings.json." },
    'impostazioni.importaV1Pulsante': { titolo: 'Importa dalla versione 1', testo: "Scegli la cartella dove c'era start.exe: ti mostro quanti file copio e ti chiedo cosa fare con quelli che esistono già. La cartella vecchia resta com'è." },
    'impostazioni.applica': { titolo: 'Applica', testo: "Salva il progetto aperto, prepara le cartelle nuove se servono e riapre l'editor su di esse." },

    // Banner dell'aggiornamento (spec 0015)
    'aggiornamento.novita': { titolo: 'Novità', testo: "Mostra le note della nuova versione, come scritte nella Release su GitHub." },
    'aggiornamento.installa': { titolo: 'Aggiorna e riavvia', testo: "Scarica la nuova versione, ne controlla l'impronta e sostituisce solo i file dell'app: progetti/, shared/ e settings.json non vengono toccati. L'app si riavvia da sola; se la nuova versione non parte, torna quella di prima." },
    'aggiornamento.pagina': { titolo: 'Pagina della versione', testo: "Apre la Release su GitHub: da lì puoi scaricare lo zip ed estrarlo sopra la cartella dell'app." },
    'aggiornamento.rimanda': { titolo: 'Più tardi', testo: "Nasconde l'avviso fino al prossimo avvio di start.exe. Per spegnere del tutto il controllo metti aggiornamenti.controllo a false in settings.json." },

    // Libreria (pannello sinistro)
    'libreria.titolo': { titolo: 'Libreria Blocchi', testo: "I tipi di blocco che puoi usare nel progetto, salvati su disco. Il numero accanto è la versione della libreria: sale da sola a ogni modifica (patch, minor o major) e ogni passo finisce nel Changelog." },
    'libreria.nonAmmessi': { titolo: 'Testi su documenti non ammessi', testo: "Questo blocco ha testi in un documento che il tipo del requisito non ammette (regola documentiPerClasse di settings.json). Aprilo: i testi sbagliati sono in rosso. Finché non li correggi il blocco non si salva e quei testi restano fuori dai documenti." },
    'libreria.changelog': { titolo: 'Changelog', testo: "Elenco di tutte le modifiche alla libreria: quando, quale blocco, quali requisiti e con quale livello di versione." },
    'libreria.solaLettura': { titolo: 'Sola lettura', testo: "La libreria non si può modificare (file protetto o versione futura). Puoi usarne i blocchi, ma non salvarli." },
    'libreria.percorso': { titolo: 'Percorso della libreria', testo: "Il file JSON della libreria usata da questo progetto, relativo alla cartella dell'app (es. shared/libreria.json). Cambialo e premi 🔄 per passare a un'altra libreria." },
    'libreria.ricarica': { titolo: 'Ricarica la libreria', testo: "Rilegge dal disco la libreria del percorso scritto a sinistra e la collega al progetto." },
    'libreria.ricerca': { titolo: 'Cerca nella libreria', testo: "Filtra l'albero dei blocchi per titolo, id, categoria o sottocategoria. Trascina un blocco dall'albero sul canvas per usarlo; un clic lo apre nell'ispettore." },

    // Cliente (pannello sinistro)
    'cliente.importa': { titolo: 'Importa requisiti cliente', testo: "Legge le frasi del cliente da un file Excel (.xlsx) o CSV. Diventano requisiti cliente: blocchi tondi che trascini sulla radice e da cui tiri i fili verso i blocchi di sistema." },
    'cliente.visti': { titolo: 'Segna tutti come visti', testo: "Spegne il segno Mod (modificato dall'ultimo import) su tutti i requisiti cliente." },
    'cliente.ricerca': { titolo: 'Cerca nei requisiti cliente', testo: "Filtra l'elenco per ID del cliente, titolo o testo." },
    'cliente.stato': { titolo: 'Stato', testo: "Non collegati: senza nessun filo verso il sistema. Modificati: cambiati dall'ultimo import. Ritirati: spariti dal file del cliente, restano per non perdere i fili." },
    'cliente.sezione': { titolo: 'Sezione', testo: "Mostra solo i requisiti di una sezione del documento del cliente (la colonna Sezione dell'import)." },

    // Coerenza (pannello sinistro)
    'coerenza.ricerca': { titolo: 'Cerca nei problemi', testo: "Filtra i problemi di coerenza per id, ID del cliente o titolo. Un clic su una voce ti porta al blocco che la contiene." },

    // Barra del canvas
    'barra.libreria': { titolo: 'Pannello sinistro', testo: "Mostra o nasconde il pannello con Libreria, Cliente, Coerenza e Gerarchia, per avere più spazio sul canvas." },
    'barra.proprieta': { titolo: 'Pannello destro', testo: "Mostra o nasconde l'ispettore." },
    'barra.filtri': { titolo: 'Filtri', testo: "Filtra blocchi e fili per classe (capacità o tipologia di interfaccia), documento, categoria e sottocategoria. Gli esclusi si attenuano o si nascondono; i filtri restano attivi entrando e uscendo dai blocchi." },
    'barra.matrice': { titolo: 'Matrice Requisiti', testo: "Apre la matrice di tracciabilità: ogni derivazione padre → figlio con i documenti di ciascun lato, filtrabile ed esportabile in Markdown." },
    'barra.documenti': { titolo: 'Documenti', testo: "Genera un documento MIL-STD-498 (SSS, SSDD, IRS, IDD, SRS, SDD) in Markdown, con i testi dei requisiti nei capitoli giusti. Ogni testo entra solo se il suo documento è ammesso per il tipo del requisito." },
    'barra.coerenza': { titolo: 'Verifica Coerenza', testo: "Accende o spegne il controllo: evidenzia in rosso i requisiti senza padre o senza figli e apre la scheda Coerenza con l'elenco dei problemi." },
    'barra.gerarchia': { titolo: 'Gerarchia', testo: "Accende o spegne la modalità Gerarchia: clicca un pin o un blocco tondo e vedi la catena completa dei suoi antenati e discendenti, sul canvas e nella scheda Gerarchia." },
    'barra.resetVista': { titolo: 'Reset Vista', testo: "Riporta zoom e spostamento del canvas alla vista iniziale." },

    // Ispettore: blocco di libreria
    'ispettore.nuovoBlocco': { titolo: 'Nuovo blocco', testo: "Apre un modulo vuoto per creare un nuovo tipo di blocco nella libreria." },
    'ispettore.titolo': { titolo: 'Titolo Blocco', testo: "Il nome del tipo di blocco, uguale per tutte le sue istanze. Per un blocco nuovo genera anche l'ID." },
    'ispettore.id': { titolo: 'ID Blocco', testo: "Identificativo univoco del tipo di blocco nella libreria, generato dal titolo. Le istanze sul canvas lo usano per sapere che blocco sono: cambialo solo con Rinomina ID, che aggiorna anche il progetto." },
    'ispettore.rinomina': { titolo: 'Rinomina ID', testo: "Cambia l'ID del blocco nella libreria e aggiorna tutte le sue istanze nel progetto aperto." },
    'ispettore.storia': { titolo: 'Storia', testo: "Le voci del Changelog che toccano questo blocco." },
    'ispettore.descrizione': { titolo: 'Descrizione', testo: "Cosa fa il blocco, in parole tue. Finisce nei documenti esportati." },
    'ispettore.categoria': { titolo: 'Categoria', testo: "Primo livello dell'albero della libreria (es. Elettrica). Si usa anche nei Filtri. Vuota diventa Generali." },
    'ispettore.sottocategoria': { titolo: 'Sottocategoria', testo: "Secondo livello dell'albero, dentro la categoria (es. Controllo). Facoltativa, filtrabile." },
    'ispettore.requisiti': { titolo: 'Requisiti Blocco', testo: "Cosa il blocco deve garantire. Un requisito con tipologia è di interfaccia: porta colorata sul bordo, da collegare a una porta della stessa tipologia. Senza tipologia è di capacità: pin quadrato viola dentro il blocco. Dentro il blocco ogni requisito diventa un blocco tondo, padre dei requisiti dei figli." },
    'ispettore.aggiungiRequisito': { titolo: 'Aggiungi requisito', testo: "Aggiunge un requisito con un ID libero proposto (<blocco>_001, _002…), che puoi cambiare." },
    'ispettore.req.id': { titolo: 'ID del requisito', testo: "Univoco in tutta la libreria. I fili lo usano per agganciarsi: se lo cambi, al salvataggio i fili lo seguono." },
    'ispettore.req.titolo': { titolo: 'Titolo del requisito', testo: "Una frase breve che si legge sul canvas, nella matrice e nei documenti." },
    'ispettore.req.tipologia': { titolo: 'Tipologia', testo: "Con una tipologia (Elettrica, Segnale, Meccanica, Fluidica…) il requisito è di interfaccia: porta sul bordo, si collega solo a porte della stessa tipologia. Vuota (Capacità) è un requisito di capacità: pin quadrato interno, si collega solo a capacità. Tipologie e colori stanno in settings.json." },
    'ispettore.req.metodo': { titolo: 'Metodo di verifica', testo: "Come si dimostrerà che il requisito è soddisfatto: Ispezione, Analisi, Dimostrazione o Test. Va nelle disposizioni di qualifica dei documenti." },
    'ispettore.req.documento': { titolo: 'Documento', testo: "In quale documento finisce il testo sotto. Il menu propone solo i documenti ammessi per il tipo del requisito: con il valore predefinito un'interfaccia va in IRS o IDD, una capacità in SSS, SSDD, SRS o SDD. Un documento che non c'è va aggiunto a documentiPerClasse in settings.json, poi riavvia. Un requisito può avere più testi, uno per documento." },
    'ispettore.req.testo': { titolo: 'Testo da esportare', testo: "La frase formale del requisito come apparirà nel documento scelto. I testi lasciati del tutto vuoti non vengono salvati." },
    'ispettore.livello': { titolo: 'Livello della versione', testo: "Automatico calcola il passo di versione dalla modifica: major se togli o rinomini un requisito o cambi una tipologia, minor se aggiungi, patch per il resto. Puoi alzarlo a mano; un livello più basso di quello calcolato viene ignorato." },
    'ispettore.motivo': { titolo: 'Motivo della modifica', testo: "Facoltativo. Una nota che finisce nella voce del Changelog, per ricordare perché hai cambiato il blocco." },
    'ispettore.salva': { titolo: 'Salva in libreria', testo: "Scrive il blocco nella libreria su disco, alza la versione e aggiunge una voce al Changelog. La modifica vale per tutte le istanze del blocco nel progetto." },
    'ispettore.copia': { titolo: 'Nuovo blocco simile', testo: "Salva una copia come nuovo tipo di blocco, con un nuovo ID e nuovi ID dei requisiti. Il blocco originale non cambia." },
    'ispettore.eliminaLibreria': { titolo: 'Elimina dalla libreria', testo: "Toglie il tipo di blocco dalla libreria. Non è possibile se il progetto aperto lo usa: prima ti mostra dove." },
    'ispettore.eliminaGrafico': { titolo: 'Elimina dal grafico', testo: "Toglie solo questa istanza dal canvas, con i suoi fili. Il tipo di blocco resta in libreria." },

    // Ispettore: requisito cliente
    'cliente.dett.idCliente': { titolo: 'ID del cliente', testo: "L'identificativo che il requisito ha nel file del cliente (colonna ID dell'import). Un nuovo import lo usa per aggiornare invece di duplicare." },
    'cliente.dett.idModello': { titolo: 'Id nel modello', testo: "L'identificativo interno (prefisso + ID del cliente) usato dai fili e dalla matrice." },
    'cliente.dett.sezione': { titolo: 'Sezione', testo: "La sezione del documento del cliente da cui viene il requisito." },
    'cliente.dett.classe': { titolo: 'Classe', testo: "Capacità o la tipologia di interfaccia: decide a quali requisiti di sistema può collegarsi." },
    'cliente.dett.stato': { titolo: 'Stato', testo: "Attivo o Ritirato (sparito dall'ultimo file del cliente), più modificato dall'ultimo import e se è sul canvas." },
    'cliente.dett.fili': { titolo: 'Fili', testo: "Quanti fili partono da questo requisito verso i blocchi di sistema. Zero vuol dire che non è ancora coperto." },
    'cliente.dett.gerarchia': { titolo: 'Mostra gerarchia', testo: "Accende la Gerarchia su questo requisito: vedi tutti i requisiti che ne derivano, a ogni livello." },
    'cliente.dett.visto': { titolo: 'Segna come visto', testo: "Spegne il segno Mod su questo requisito: hai letto la modifica arrivata con l'ultimo import." },
    'cliente.dett.togli': { titolo: 'Togli dal canvas', testo: "Toglie il blocco tondo dalla radice, non il requisito. Si può solo se non ha fili." },

    // Ispettore: collegamento
    'coll.relazione': { titolo: 'Relazione', testo: "Derivazione: un requisito padre (blocco tondo) scende su un requisito di un blocco figlio. Collegamento tra blocchi: due porte o due capacità allo stesso livello." },
    'coll.classe': { titolo: 'Classe', testo: "Capacità o tipologia di interfaccia del requisito: i due estremi devono avere la stessa." },
    'coll.metodo': { titolo: 'Metodo di verifica', testo: "Il metodo di verifica del requisito, preso dal blocco di libreria." },
    'coll.testi': { titolo: 'Testi da esportare', testo: "I testi del requisito con il documento in cui finiscono." },
    'coll.elimina': { titolo: 'Elimina collegamento', testo: "Toglie questo filo dal modello. Puoi rimediare con Annulla." },

    // Filtri
    'filtri.classi': { titolo: 'Classe', testo: "Capacità o una tipologia di interfaccia: lascia passare solo i requisiti e i fili di quelle classi." },
    'filtri.documenti': { titolo: 'Documento', testo: "Lascia passare i requisiti che hanno almeno un testo da esportare nei documenti scelti." },
    'filtri.categorie': { titolo: 'Categoria', testo: "Lascia passare i blocchi delle categorie scelte." },
    'filtri.sottocategorie': { titolo: 'Sottocategoria', testo: "Lascia passare i blocchi delle sottocategorie scelte." },
    'filtri.modo': { titolo: 'Elementi esclusi', testo: "Attenua li lascia visibili ma sbiaditi; Nascondi li toglie dal canvas." },
    'filtri.azzera': { titolo: 'Azzera filtri', testo: "Toglie tutte le spunte: torna visibile tutto." },

    // Matrice
    'matrice.documento': { titolo: 'Documento', testo: "Mostra solo le derivazioni in cui un requisito ha un testo per questo documento." },
    'matrice.lato': { titolo: 'Lato', testo: "Su quale lato deve stare il documento scelto: il padre, il figlio o uno dei due." },
    'matrice.classe': { titolo: 'Classe', testo: "Mostra solo le derivazioni di una classe: capacità o una tipologia di interfaccia." },
    'matrice.ricerca': { titolo: 'Ricerca', testo: "Filtra per ID o titolo, del padre o del figlio. Un clic su un requisito della tabella lo apre nella Gerarchia." },
    'matrice.esporta': { titolo: 'Esporta .md', testo: "Scarica la matrice filtrata come tabella Markdown." },

    // Documenti
    'documenti.documento': { titolo: 'Documento', testo: "Il tipo di documento MIL-STD-498 da generare, con i capitoli del suo DID (Data Item Description, la traccia ufficiale del documento)." },
    'documenti.nonAmmessi': { titolo: 'Testi su documenti non ammessi', testo: "Testi della libreria in un documento che il tipo del requisito non ammette. Non entrano in nessun documento generato. Un clic apre il blocco nell'Ispettore per correggerli." },
    'documenti.word': { titolo: 'Esporta Word', testo: "Scarica il documento come file Word (.docx) con il modello aziendale: frontespizio con logo, registro delle revisioni, intestazione e numeri di pagina. Il modello si regola in settings.json (documentiExport.modello)." },
    'documenti.pdf': { titolo: 'Esporta PDF', testo: "Scarica il documento come PDF con lo stesso modello aziendale del Word, pronto da consegnare." },
    'documenti.revisioni': { titolo: 'Registro delle revisioni', testo: "Le emissioni di questo documento: revisione, data, descrizione della modifica e autore. Finisce nel Word e nel PDF, e l'ultima riga è la revisione corrente scritta nel frontespizio e in testa a ogni pagina. Si salva nel progetto." },
    'documenti.nuovaRevisione': { titolo: 'Nuova revisione', testo: "Aggiunge una riga con la revisione successiva (dopo A viene B, dopo 3 viene 4), la data di oggi e l'autore del modello. Scrivi la descrizione della modifica prima di esportare." },
    'documenti.esporta': { titolo: 'Esporta .md', testo: "Scarica il documento generato come file Markdown, senza il modello aziendale." },

    // Import cliente
    'import.foglio': { titolo: 'Foglio', testo: "Il foglio del file Excel da leggere. Un CSV ha un solo foglio." },
    'import.riga': { titolo: 'Riga di intestazione', testo: "La riga che contiene i nomi delle colonne. Le righe sopra vengono ignorate, quelle sotto sono i requisiti." },
    'import.colonna.id': { titolo: 'Colonna ID', testo: "Obbligatoria. L'identificativo del requisito nel file del cliente: deve essere univoco, serve per aggiornare invece di duplicare." },
    'import.colonna.testo': { titolo: 'Colonna Testo', testo: "Obbligatoria. La frase del requisito del cliente." },
    'import.colonna.titolo': { titolo: 'Colonna Titolo', testo: "Facoltativa. Un titolo breve che si legge sul canvas e negli elenchi." },
    'import.colonna.note': { titolo: 'Colonna Note', testo: "Facoltativa. Note del cliente, visibili nel dettaglio." },
    'import.colonna.sezione': { titolo: 'Colonna Sezione', testo: "Facoltativa. La sezione del documento del cliente, per filtrare l'elenco." },
    'import.colonna.tipologia': { titolo: 'Colonna Tipologia', testo: "Facoltativa. Una tipologia di interfaccia; vuota vuol dire capacità." },
    'import.modalita': { titolo: 'Modalità', testo: "Sostituisci: il file è l'insieme completo, chi manca diventa ritirato. Aggiungi e aggiorna: aggiunge i nuovi e aggiorna gli esistenti, nessuno viene ritirato." },

    // Changelog
    'changelog.filtro': { titolo: 'Filtra il changelog', testo: "Mostra solo le voci che toccano un blocco (id o titolo) o un id di requisito." },

    // Pulsanti dei mini tour
    'finestra.tour': { titolo: 'Guida di questa finestra', testo: "Un breve tour che ti spiega le parti di questa finestra." }
};

// Passi dei tour: area = selettore CSS (null = fumetto al centro); prepara = pannelloSinistro | pannelloDestro | pannello:<id>
export const TOUR: Record<string, PassoTour[]> = {
    principale: [
        { area: null, titolo: 'Benvenuto nel Modellatore', testo: "Qui disegni il sistema come blocchi annidati e colleghi i requisiti con dei fili, dai requisiti del cliente fino ai blocchi più piccoli. Questo giro ti mostra ogni area in pochi passi.\n\nUsa → o Invio per andare avanti, ← per tornare indietro, Esc per uscire." },
        { area: '#breadcrumb', titolo: 'Dove ti trovi', testo: "Il percorso dei livelli aperti. Con un doppio clic su un blocco entri al suo interno (come una matrioska): qui compare il suo nome. Clicca un livello del percorso, o Indietro, per risalire." },
        { area: '#btnAnnulla', titolo: 'Salvataggio automatico', testo: "Non c'è un pulsante Salva: ogni modifica finisce da sola sul file del progetto. Il badge accanto ne mostra lo stato. Annulla e Ripeti (Ctrl+Z, Ctrl+Y) lavorano sulle copie salvate." },
        { area: '#btnMenuProgetto', titolo: 'Menu Progetto', testo: "Crea un progetto nuovo, apri un altro, salvane una copia, rinominalo o eliminalo. Da qui anche import e download del JSON." },
        { area: '#btnMenuAiuto', titolo: 'Menu Aiuto', testo: "Da qui rilanci questo tour quando vuoi e mostri o nascondi le icone (i) accanto ai campi." },
        { area: '#btnMenuFinestra', titolo: 'Pannelli', testo: "Libreria, Cliente, Coerenza, Gerarchia, Canvas e Ispettore sono pannelli: trascinane la scheda per spostarli, affiancarli o impilarli, tira i bordi per ridimensionarli. Con ⧉ stacchi un gruppo in una finestra separata (anche su un altro monitor). Dal menu Finestra riapri un pannello chiuso o ripristini la disposizione di partenza." },
        { area: '#schedaLibreria', titolo: 'Libreria', prepara: 'pannello:libreria', testo: "I blocchi disponibili, divisi per categoria e sottocategoria. Trascinane uno sul canvas per usarlo, cliccalo per modificarlo. In alto la versione della libreria e il Changelog; sotto il percorso del file e la ricerca." },
        { area: '#schedaCliente', titolo: 'Requisiti cliente', prepara: 'pannello:cliente', testo: "Importa da Excel o CSV le frasi del cliente. Ognuna diventa un requisito che trascini sulla radice come blocco tondo: da lì tiri i fili verso i requisiti dei blocchi di sistema." },
        { area: '#workspaceSvg', titolo: 'Il canvas', prepara: 'pannello:canvas', testo: "Il piano di lavoro. Rotella: zoom verso il cursore. Trascina lo sfondo: sposta la vista. Trascina da un pin a un altro pin della stessa classe per creare un filo. Doppio clic su un blocco per entrare, clic per selezionarlo." },
        { area: '#aiutoCanvas', titolo: 'I gesti senza pulsante', prepara: 'pannello:canvas', testo: "Questa riga ricorda i gesti nascosti: Shift+trascina per spostare una porta lungo il bordo, doppio clic su un filo per aggiungere uno snodo, clic destro per eliminarlo." },
        { area: '#btnFiltri', titolo: 'Filtri', prepara: 'pannello:canvas', testo: "Attenua o nascondi blocchi e fili per classe, documento, categoria e sottocategoria. Dentro il pannello trovi un ❓ con la sua guida." },
        { area: '#btnReqMatrix', titolo: 'Matrice e Documenti', prepara: 'pannello:canvas', testo: "Matrice Requisiti: la tabella di tracciabilità padre → figlio, esportabile. Documenti: genera i documenti MIL-STD-498 in Markdown. Si aprono come pannelli sotto il canvas e si aggiornano mentre modelli; ognuno ha un ❓ con la sua guida." },
        { area: '#btnDRC', titolo: 'Verifica Coerenza', prepara: 'pannello:canvas', testo: "Evidenzia in rosso cosa manca: requisiti cliente senza figli, requisiti di blocco senza padre, fili rotti. L'elenco compare nella scheda Coerenza; un clic su una voce ti porta lì." },
        { area: '#btnGerarchia', titolo: 'Gerarchia', prepara: 'pannello:canvas', testo: "Accendila e clicca un pin: vedi tutta la catena dei suoi antenati e discendenti attraverso i livelli, sul canvas e nella scheda Gerarchia." },
        { area: '#btnResetView', titolo: 'Vista e pannelli', prepara: 'pannello:canvas', testo: "Reset Vista riporta zoom e spostamento all'inizio. I pulsanti ☰ ai lati della barra chiudono e riaprono i pannelli Libreria e Ispettore." },
        { area: '#propertiesPanel', titolo: 'Ispettore', prepara: 'pannelloDestro', testo: "Mostra e modifica quello che selezioni: un blocco con i suoi requisiti, un requisito cliente o un filo. + Nuovo Blocco crea un tipo di blocco nella libreria." },
        { area: null, titolo: 'Fatto!', testo: "Ora conosci l'interfaccia. Accanto ai campi trovi le icone (i): passaci sopra con il mouse (o arrivaci con Tab) per sapere cosa rappresenta ogni campo. Matrice, Documenti, Import cliente e Filtri hanno un ❓ con una guida dedicata. Puoi rifare questo tour dal menu ❓ Aiuto." }
    ],
    matrice: [
        { area: null, titolo: 'Matrice di tracciabilità', testo: "Ogni riga è una derivazione: un requisito padre e un figlio che ne deriva, con i documenti di ciascun lato. I padri senza figli e i figli senza padre sono segnalati." },
        { area: '#matriceFiltri', titolo: 'Filtri', testo: "Restringi per documento (e su quale lato deve stare), per classe, o cerca per ID e titolo." },
        { area: '#matriceConteggi', titolo: 'Conteggi', testo: "Quante derivazioni e quanti problemi ci sono con i filtri di adesso." },
        { area: '#matriceContenuto', titolo: 'Tabella', testo: "Le derivazioni raggruppate per padre. Clicca un requisito per aprirlo nella Gerarchia." },
        { area: '#btnEsportaMatrice', titolo: 'Esporta', testo: "Scarica la matrice filtrata come file Markdown (.md)." }
    ],
    documenti: [
        { area: null, titolo: 'Documenti MIL-STD-498', testo: "Genera un documento formale con i capitoli del suo DID, mettendo ogni testo da esportare nel capitolo giusto." },
        { area: '#documentiScelta', titolo: 'Documento', testo: "Scegli il tipo: SSS, SSDD, IRS, IDD, SRS o SDD. Entrano i requisiti che hanno un testo per quel documento." },
        { area: '#documentiRiepilogo', titolo: 'Riepilogo', testo: "Quanti requisiti (capacità e interfacce) e quanti testi entrano nel documento." },
        { area: '#anteprimaDocumento', titolo: 'Anteprima', testo: "Il Markdown che verrà scaricato, così com'è." },
        { area: '#btnEsportaDocumento', titolo: 'Esporta', testo: "Scarica il documento come file .md." }
    ],
    importCliente: [
        { area: null, titolo: 'Import dei requisiti cliente', testo: "Da un file Excel o CSV ai requisiti cliente in tre mosse: scegli foglio e riga di intestazione, collega le colonne, controlla l'anteprima e conferma." },
        { area: '.import-file', titolo: 'File', testo: "Il file che stai importando e il suo formato." },
        { area: '.import-riga', titolo: 'Foglio e intestazione', testo: "Il foglio da leggere e la riga con i nomi delle colonne." },
        { area: '.import-campi', titolo: 'Colonne', testo: "Dì quale colonna contiene ogni campo. ID e Testo sono obbligatori." },
        { area: '.import-modalita', titolo: 'Modalità', testo: "Sostituisci l'insieme (chi manca diventa ritirato) oppure Aggiungi e aggiorna (nessuno viene ritirato)." },
        { area: '#impAnteprima', titolo: 'Anteprima', testo: "Cosa succederà: nuovi, modificati, ritirati, righe scartate con il motivo e duplicati." },
        { area: '.import-pulsanti', titolo: 'Conferma', testo: "Conferma import applica le modifiche al progetto. Annulla chiude senza cambiare nulla." }
    ],
    filtri: [
        { area: null, titolo: 'Filtri del canvas', testo: "Le spunte di un gruppo si sommano (basta una), i gruppi diversi devono valere tutti insieme." },
        { area: '#pannelloFiltri .griglia-filtri', titolo: 'Gruppi', testo: "Classe, Documento, Categoria e Sottocategoria. Senza spunte un gruppo lascia passare tutto." },
        { area: '#pannelloFiltri .piede-filtri', titolo: 'Esclusi e Azzera', testo: "Scegli se gli esclusi si attenuano o si nascondono, e azzera tutte le spunte con un clic. A destra quanti blocchi e fili sono esclusi in questo livello." }
    ]
};
