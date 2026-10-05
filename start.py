import io
import os
import re
import csv
import sys
import json
import math
import base64
import zipfile
import binascii
import posixpath
import time
import getpass
import errno
import hashlib
import shutil
import socket
import subprocess
import threading
import webbrowser
import urllib.error
import urllib.request
from datetime import datetime
from urllib.parse import urlsplit, unquote, parse_qs
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import xml.etree.ElementTree as ET

PORT = 8080

# --- Console (vedi docs/specs/0014-console-server-leggibile) ---
# rich è facoltativo: senza, start.py scrive le stesse informazioni in testo semplice
if sys.stdout is not None and not sys.stdout.isatty():
    # Uscita rediretta su file o pipe: UTF-8, così bordi e lettere accentate non fanno fallire l'avvio
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass
try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.markup import escape as escape_markup
except Exception:
    Console = None

def crea_console(**opzioni):
    # Con NO_COLOR nessuna sequenza di escape, nemmeno grassetto e attenuato
    if Console is None:
        return None
    try:
        if os.environ.get('NO_COLOR'):
            opzioni.setdefault('color_system', None)
        return Console(highlight=False, **opzioni)
    except Exception:
        return None

CONSOLE = crea_console()

VERSIONE_SVILUPPO = 'sviluppo'
RIGA_CHIUDI = "Chiudi questa finestra per fermare il server."

def stampa_semplice(testo):
    try:
        print(testo, flush=True)
    except Exception:
        pass

def stampa_con_stile(testo, stile, prefisso=''):
    # Una riga di console con rich se c'è, altrimenti in testo semplice con lo stesso prefisso
    if CONSOLE is not None:
        try:
            etichetta = f"[bold]{prefisso}[/bold] " if prefisso else ''
            # soft_wrap: niente a capo inseriti, un link resta intero anche nell'uscita rediretta
            CONSOLE.print(f"[{stile}]{etichetta}{escape_markup(testo)}[/{stile}]", soft_wrap=True)
            return
        except Exception:
            pass
    stampa_semplice(f"{prefisso} {testo}" if prefisso else testo)

def stampa_info(testo):
    stampa_con_stile(testo, 'dim')

def stampa_avviso(testo):
    stampa_con_stile(testo, 'yellow', 'Attenzione:')

def stampa_errore(testo):
    stampa_con_stile(testo, 'red', 'Errore:')

def leggi_versione(base_dir):
    # Contenuto di VERSIONE.txt (scritto da crea-pacchetto.ps1); 'sviluppo' se manca o è vuoto
    try:
        with open(os.path.join(base_dir, 'VERSIONE.txt'), encoding='utf-8-sig') as f:
            versione = f.read().strip()
        return versione or VERSIONE_SVILUPPO
    except OSError:
        return VERSIONE_SVILUPPO

def stampa_avvio(versione, url, base_dir, cartella_progetti, cartella_librerie):
    righe = [("Versione:", versione), ("Apri l'app:", url), ("Cartella dell'app:", base_dir),
             ("Progetti:", cartella_progetti), ("Librerie:", cartella_librerie)]
    larghezza_etichette = max(len(e) for e, _ in righe)
    if CONSOLE is not None:
        try:
            # Riquadro solo se la riga del link ci sta intera: etichetta, spazio, URL, bordi e margini
            if CONSOLE.width >= larghezza_etichette + 2 + len(url) + 6:
                griglia = Table.grid(padding=(0, 2))
                # Etichette sempre intere; i percorsi lunghi vanno a capo dentro la loro colonna
                griglia.add_column(style='dim', no_wrap=True, min_width=larghezza_etichette)
                griglia.add_column(overflow='fold')
                for etichetta, valore in righe:
                    if valore == url:
                        griglia.add_row(etichetta, f"[bold cyan][link={url}]{url}[/link][/bold cyan]")
                    else:
                        griglia.add_row(etichetta, escape_markup(str(valore)))
                CONSOLE.print(Panel.fit(griglia, title="[bold]Modellatore MBSE[/bold]", border_style='cyan', padding=(1, 2)))
            else:
                # Finestra troppo stretta: righe libere, che il terminale manda a capo senza tagliarle
                CONSOLE.print("Modellatore MBSE", style='bold cyan', soft_wrap=True)
                for etichetta, valore in righe:
                    if valore == url:
                        CONSOLE.print(f"[dim]{etichetta}[/dim] [bold cyan][link={url}]{url}[/link][/bold cyan]", soft_wrap=True)
                    else:
                        CONSOLE.print(f"[dim]{etichetta}[/dim] {escape_markup(str(valore))}", soft_wrap=True)
            CONSOLE.print(RIGA_CHIUDI, style='dim', soft_wrap=True)
            CONSOLE.file.flush()
            return
        except Exception:
            pass
    stampa_semplice("=" * 55)
    stampa_semplice(" Modellatore MBSE")
    for etichetta, valore in righe:
        stampa_semplice(f" {etichetta} {valore}")
    stampa_semplice(f" {RIGA_CHIUDI}")
    stampa_semplice("=" * 55)

# Percorsi dell'utente, relativi alla cartella dell'app (vedi docs/specs/0013-protezione-dati-aggiornamenti):
# nessun aggiornamento può scriverli, spostarli o cancellarli. crea-pacchetto.ps1 legge questa riga
# e si ferma se il pacchetto contiene uno di questi file o un file dentro una di queste cartelle.
PERCORSI_UTENTE = ('progetti', 'shared', 'settings.json')
FILE_IMPOSTAZIONI = 'settings.json'
FILE_IMPOSTAZIONI_PREDEFINITE = 'settings.predefinite.json'

# Limiti e formati dell'API dei progetti (vedi docs/specs/0001-salvataggio-automatico-progetto)
MAX_CORPO = 50 * 1024 * 1024
# Formato del file progetto: si scrive sempre 2 (con la chiave facoltativa cliente), si leggono 1 e 2
FORMATO_PROGETTO = 2
FORMATI_PROGETTO_LETTI = (1, 2)
LUNGHEZZA_MAX_SLUG = 80
FORMATO_SLUG = re.compile(r'^[a-z0-9]+(_[a-z0-9]+)*$')
NOMI_RISERVATI = {'con', 'prn', 'aux', 'nul'} | {f'com{i}' for i in range(1, 10)} | {f'lpt{i}' for i in range(1, 10)}
VERSIONI_PREDEFINITE = 3
TENTATIVI_FILE_BLOCCATO = 5
ATTESA_FILE_BLOCCATO = 0.05

# Librerie con versione e changelog (vedi docs/specs/0002-libreria-disco-changelog)
FORMATO_LIBRERIA = 1
FORMATO_SEMVER = re.compile(r'^\d+\.\d+\.\d+$')
ORDINE_LIVELLI = {'patch': 0, 'minor': 1, 'major': 2}
LUNGHEZZA_MAX_NOTA = 2000
LUNGHEZZA_MAX_ID_BLOCCO = 200
FORMATO_ID_BLOCCO = re.compile(r'^[A-Za-z0-9_.-]+$')
SUFFISSO_CHANGELOG = '.changelog.json'

MSG_SLUG_NON_VALIDO = "Il nome deve contenere almeno una lettera o cifra e non può essere un nome riservato di Windows"
MSG_FILE_BLOCCATO = "Il file è bloccato da un altro programma, ad esempio OneDrive, un antivirus o un editor"
MSG_CHANGELOG_ILLEGGIBILE = "Il changelog non è leggibile: correggilo o spostalo per poter salvare"
MSG_FORMATO_FUTURO = "Libreria creata da una versione più recente dell'app: aperta in sola lettura"

# Import dei requisiti cliente da Excel o CSV (vedi docs/specs/0003-import-requisiti-cliente)
MAX_FILE_CLIENTE_MB_PREDEFINITO = 20
MAX_DECOMPRESSO = 200 * 1024 * 1024
CAMPIONE_SEPARATORE = 64 * 1024
FIRMA_OLE = bytes.fromhex('d0cf11e0')
ESTENSIONI_XLSX = ('.xlsx', '.xlsm')
MSG_FORMATO_CLIENTE = "Salva il file come .xlsx senza password e riprova."
MSG_FILE_ILLEGGIBILE = "Il file non è leggibile: è danneggiato o non è un file Excel o CSV valido."
csv.field_size_limit(10 * 1024 * 1024)

def get_base_dir():
    # Gestisce sia l'esecuzione da script che da file .exe compilato con PyInstaller
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def prepara_impostazioni(base_dir):
    # Crea settings.json dai valori di fabbrica solo se manca: un settings.json esistente
    # (anche non valido) non si scrive, non si sposta e non si cancella mai
    percorso = os.path.join(base_dir, FILE_IMPOSTAZIONI)
    predefinite = os.path.join(base_dir, FILE_IMPOSTAZIONI_PREDEFINITE)
    if os.path.exists(percorso) or not os.path.isfile(predefinite):
        return False
    try:
        shutil.copyfile(predefinite, percorso)
    except OSError as e:
        stampa_errore(f"Impossibile creare settings.json: {e}")
        return False
    stampa_info("Impostazioni create da settings.predefinite.json")
    return True

def ensure_shared_library(base_dir):
    # Crea automaticamente la cartella 'shared' e una libreria di prova se assenti
    shared_dir = os.path.join(base_dir, "shared")
    os.makedirs(shared_dir, exist_ok=True)

    lib_path = os.path.join(shared_dir, "libreria.json")
    if not os.path.exists(lib_path):
        dummy_lib = '''{
  "centralina_condivisa": {
    "id": "centralina_condivisa",
    "titolo": "Centralina Condivisa",
    "descrizione": "Blocco di esempio creato all'avvio",
    "categoria": "Elettrica",
    "sottocategoria": "Controllo",
    "requisiti": [
      {
        "id": "cen_condivisa_001",
        "titolo": "Alimentazione 24V",
        "tipologia": "Elettrica",
        "metodoVerifica": "Test",
        "testiExport": [
          { "testo": "La centralina deve essere alimentata a 24V", "documento": "IRS" }
        ]
      }
    ]
  }
}'''
        with open(lib_path, "w", encoding="utf-8") as f:
            f.write(dummy_lib)

def leggi_max_file_cliente(base_dir):
    # cliente.maxFileMB da settings.json: numero positivo; predefinito se manca o non è valido
    try:
        with open(os.path.join(base_dir, "settings.json"), encoding="utf-8") as f:
            valore = json.load(f).get("cliente", {}).get("maxFileMB")
        if type(valore) in (int, float) and valore > 0:
            return valore
    except (OSError, ValueError, AttributeError):
        pass
    return MAX_FILE_CLIENTE_MB_PREDEFINITO

def leggi_max_versioni(base_dir, sezione):
    # <sezione>.versioni da settings.json (progetti o libreria): intero, minimo 1; predefinito se manca o non è valido
    try:
        with open(os.path.join(base_dir, "settings.json"), encoding="utf-8") as f:
            valore = json.load(f).get(sezione, {}).get("versioni")
        if type(valore) is int and valore >= 1:
            return valore
    except (OSError, ValueError, AttributeError):
        pass
    return VERSIONI_PREDEFINITE

class ErroreApi(Exception):
    # Errore da restituire al browser come { errore, messaggio } con il suo codice HTTP
    def __init__(self, stato, codice, messaggio, **extra):
        super().__init__(messaggio)
        self.stato = stato
        self.codice = codice
        self.messaggio = messaggio
        self.extra = extra

def slug_valido(slug):
    return (isinstance(slug, str) and len(slug) <= LUNGHEZZA_MAX_SLUG
            and FORMATO_SLUG.match(slug) is not None and slug not in NOMI_RISERVATI)

def controlla_slug(slug):
    if not slug_valido(slug):
        raise ErroreApi(400, 'slug_non_valido', MSG_SLUG_NON_VALIDO)

def controlla_progetto(progetto):
    workspace = progetto.get('workspace') if isinstance(progetto, dict) else None
    valido = (isinstance(progetto, dict)
              and isinstance(progetto.get('nome'), str) and progetto['nome'].strip() != ''
              and isinstance(progetto.get('libraryPath'), str)
              and isinstance(workspace, dict)
              and isinstance(workspace.get('nodes'), list) and isinstance(workspace.get('edges'), list)
              and type(progetto.get('formatVersion')) is int and progetto['formatVersion'] in FORMATI_PROGETTO_LETTI
              and (progetto.get('cliente') is None or isinstance(progetto.get('cliente'), dict)))
    if not valido:
        raise ErroreApi(400, 'progetto_non_valido',
                        "Il progetto non ha la forma attesa: formatVersion 1 o 2, nome, libraryPath, workspace con nodes ed edges e cliente facoltativo.")

def con_cliente(progetto, origine):
    # Copia in progetto la chiave cliente di origine, se c'è: requisiti cliente e workspace viaggiano insieme
    cliente = origine.get('cliente') if isinstance(origine, dict) else None
    if isinstance(cliente, dict):
        progetto['cliente'] = cliente
    return progetto

def serializza(progetto):
    return json.dumps(progetto, ensure_ascii=False, indent=2).encode('utf-8')

def impronta_di(dati):
    # Il gettone che rileva i conflitti: SHA1 del contenuto, non l'ora di modifica
    return hashlib.sha1(dati).hexdigest()

def con_ritentativi(operazione):
    # Un file aperto da OneDrive, un antivirus o un editor si libera in pochi millisecondi
    for tentativo in range(TENTATIVI_FILE_BLOCCATO + 1):
        try:
            return operazione()
        except PermissionError:
            if tentativo == TENTATIVI_FILE_BLOCCATO:
                raise ErroreApi(503, 'file_bloccato', MSG_FILE_BLOCCATO)
            time.sleep(ATTESA_FILE_BLOCCATO)

def rimuovi_se_esiste(percorso):
    try:
        os.remove(percorso)
    except FileNotFoundError:
        pass

def leggi_bytes(percorso):
    def leggi():
        with open(percorso, 'rb') as f:
            return f.read()
    return con_ritentativi(leggi)

def scrivi_atomico(percorso, dati):
    # Scrive accanto in .tmp e poi sostituisce: il file principale è sempre JSON completo
    tmp = percorso + '.tmp'
    def scrivi():
        with open(tmp, 'wb') as f:
            f.write(dati)
        os.replace(tmp, percorso)
    try:
        con_ritentativi(scrivi)
    except ErroreApi:
        rimuovi_se_esiste(tmp)
        raise
    except OSError as e:
        rimuovi_se_esiste(tmp)
        raise ErroreApi(500, 'errore_scrittura', f"Impossibile scrivere il file: {e.strerror or e}")

def percorso_copia(cartella, nome, n):
    return os.path.join(cartella, f"{nome}.{n}.json")

def numeri_copie(cartella, nome):
    if not os.path.isdir(cartella):
        return []
    formato = re.compile(rf'^{re.escape(nome)}\.(\d+)\.json$')
    numeri = []
    for voce in os.listdir(cartella):
        trovato = formato.match(voce)
        if trovato:
            numeri.append(int(trovato.group(1)))
    return numeri

def ruota_copie(cartella, nome, attuali, massimo):
    # .1 uguale al file attuale: la rotazione l'ha già fatta un tentativo fallito (file bloccato).
    # Ripeterla riempirebbe le copie di doppioni e cancellerebbe la storia
    if os.path.exists(percorso_copia(cartella, nome, 1)) and leggi_bytes(percorso_copia(cartella, nome, 1)) == attuali:
        return
    # Le copie oltre il limite (anche se il limite è sceso) spariscono, poi .1→.2→.3
    for n in numeri_copie(cartella, nome):
        if n >= massimo:
            con_ritentativi(lambda n=n: rimuovi_se_esiste(percorso_copia(cartella, nome, n)))
    for n in range(massimo - 1, 0, -1):
        if os.path.exists(percorso_copia(cartella, nome, n)):
            con_ritentativi(lambda n=n: os.replace(percorso_copia(cartella, nome, n), percorso_copia(cartella, nome, n + 1)))
    scrivi_atomico(percorso_copia(cartella, nome, 1), attuali)

def interpreta_json(dati, messaggio):
    try:
        valore = json.loads(dati.decode('utf-8'))
    except (UnicodeDecodeError, ValueError):
        raise ErroreApi(422, 'json_non_valido', messaggio)
    if not isinstance(valore, dict):
        raise ErroreApi(422, 'json_non_valido', messaggio)
    return valore

class ArchivioProgetti:
    # Tutto il lavoro su progetti/; ogni metodo va chiamato tenendo il lucchetto
    def __init__(self, base_dir, max_versioni):
        self.cartella = os.path.join(base_dir, "progetti")
        self.cartella_versioni = os.path.join(self.cartella, "_versioni")
        self.cartella_cestino = os.path.join(self.cartella, "_cestino")
        self.file_ultimo = os.path.join(self.cartella, "_ultimo.json")
        self.max_versioni = max_versioni
        self.lucchetto = threading.Lock()

    def prepara(self):
        for cartella in (self.cartella, self.cartella_versioni, self.cartella_cestino):
            os.makedirs(cartella, exist_ok=True)
        # Scritture interrotte da un arresto precedente
        for cartella in (self.cartella, self.cartella_versioni):
            for nome in os.listdir(cartella):
                if nome.endswith('.tmp'):
                    try:
                        os.remove(os.path.join(cartella, nome))
                    except OSError:
                        pass

    def principale(self, slug):
        return os.path.join(self.cartella, f"{slug}.json")

    def versione(self, slug, n):
        return percorso_copia(self.cartella_versioni, slug, n)

    def numeri_versioni(self, slug):
        return numeri_copie(self.cartella_versioni, slug)

    def conta_versioni(self, slug):
        n = 0
        while n < self.max_versioni and os.path.exists(self.versione(slug, n + 1)):
            n += 1
        return n

    def rimuovi_versioni(self, slug):
        for n in self.numeri_versioni(slug):
            con_ritentativi(lambda n=n: rimuovi_se_esiste(self.versione(slug, n)))

    def leggi_esistente(self, slug):
        percorso = self.principale(slug)
        if not os.path.isfile(percorso):
            raise ErroreApi(404, 'non_trovato', f'Il progetto "{slug}" non esiste.')
        return leggi_bytes(percorso)

    def controlla_impronta(self, attuali, attesa):
        impronta = impronta_di(attuali)
        if attesa != impronta:
            raise ErroreApi(409, 'conflitto',
                            "Il file del progetto è cambiato sul disco dopo che l'app l'ha letto.",
                            impronta=impronta)

    # --- Elenco, lettura e creazione ---

    def elenco(self):
        progetti = []
        for voce in os.scandir(self.cartella):
            if not voce.is_file() or not voce.name.endswith('.json'):
                continue
            slug = voce.name[:-5]
            if not slug_valido(slug):
                continue
            nome, danneggiato = slug, False
            try:
                dati = json.loads(leggi_bytes(voce.path).decode('utf-8'))
                if not isinstance(dati, dict):
                    danneggiato = True
                elif isinstance(dati.get('nome'), str) and dati['nome'].strip():
                    nome = dati['nome']
            except (UnicodeDecodeError, ValueError):
                danneggiato = True
            except (ErroreApi, OSError):
                pass
            progetti.append({
                'slug': slug,
                'nome': nome,
                'modificato': int(voce.stat().st_mtime * 1000),
                'danneggiato': danneggiato,
            })
        progetti.sort(key=lambda p: p['modificato'], reverse=True)
        return {'progetti': progetti}

    def leggi(self, slug):
        dati = self.leggi_esistente(slug)
        progetto = interpreta_json(dati, f'Il file del progetto "{slug}" non è JSON valido.')
        return {'progetto': progetto, 'impronta': impronta_di(dati), 'versioni': self.conta_versioni(slug)}

    def crea(self, slug, progetto):
        controlla_slug(slug)
        controlla_progetto(progetto)
        if os.path.exists(self.principale(slug)):
            raise ErroreApi(409, 'esiste', f'Esiste già un progetto con il nome "{slug}".')
        # Versioni rimaste da un file tolto a mano: il nuovo progetto parte senza
        self.rimuovi_versioni(slug)
        dati = serializza(progetto)
        scrivi_atomico(self.principale(slug), dati)
        return {'slug': slug, 'impronta': impronta_di(dati), 'versioni': 0}

    # --- Scrittura con versioni ---

    def ruota_versioni(self, slug, attuali):
        ruota_copie(self.cartella_versioni, slug, attuali, self.max_versioni)

    def scrivi(self, slug, progetto, attesa, forza):
        controlla_progetto(progetto)
        attuali = self.leggi_esistente(slug)
        if not forza:
            self.controlla_impronta(attuali, attesa)
        nuovi = serializza(progetto)
        if nuovi != attuali:
            # Il file principale si scrive per ultimo: un'interruzione tocca solo le versioni
            self.ruota_versioni(slug, attuali)
            scrivi_atomico(self.principale(slug), nuovi)
        return {'impronta': impronta_di(nuovi), 'versioni': self.conta_versioni(slug)}

    def annulla(self, slug, attesa):
        attuali = self.leggi_esistente(slug)
        self.controlla_impronta(attuali, attesa)
        if not os.path.exists(self.versione(slug, 1)):
            raise ErroreApi(409, 'nessuna_versione', 'Non ci sono versioni precedenti da ripristinare.')
        precedente = interpreta_json(leggi_bytes(self.versione(slug, 1)), 'La versione precedente non è JSON valido.')
        attuale = interpreta_json(attuali, f'Il file del progetto "{slug}" non è JSON valido.')
        workspace = precedente.get('workspace')
        if not isinstance(workspace, dict):
            raise ErroreApi(422, 'json_non_valido', 'La versione precedente non contiene un workspace.')
        # Si ripristina solo il modello (workspace e requisiti cliente): nome e percorso della libreria restano quelli attuali
        progetto = con_cliente({
            'formatVersion': FORMATO_PROGETTO,
            'nome': attuale['nome'] if isinstance(attuale.get('nome'), str) else slug,
            'libraryPath': attuale['libraryPath'] if isinstance(attuale.get('libraryPath'), str) else '',
            'workspace': workspace,
        }, precedente)
        nuovi = serializza(progetto)
        scrivi_atomico(self.principale(slug), nuovi)
        # .2→.1, .3→.2: la versione usata sparisce, non se ne crea una nuova
        for n in range(1, self.max_versioni + 1):
            successiva = self.versione(slug, n + 1)
            if n + 1 <= self.max_versioni and os.path.exists(successiva):
                con_ritentativi(lambda n=n, s=successiva: os.replace(s, self.versione(slug, n)))
            else:
                con_ritentativi(lambda n=n: rimuovi_se_esiste(self.versione(slug, n)))
        for n in self.numeri_versioni(slug):
            if n > self.max_versioni:
                con_ritentativi(lambda n=n: rimuovi_se_esiste(self.versione(slug, n)))
        return {'progetto': progetto, 'impronta': impronta_di(nuovi), 'versioni': self.conta_versioni(slug)}

    # --- Rinomina ed eliminazione ---

    def rinomina(self, slug, nuovo_slug, nome, attesa):
        controlla_slug(nuovo_slug)
        if not isinstance(nome, str) or not nome.strip():
            raise ErroreApi(400, 'progetto_non_valido', 'Il nome del progetto non può essere vuoto.')
        attuali = self.leggi_esistente(slug)
        self.controlla_impronta(attuali, attesa)
        if nuovo_slug != slug and os.path.exists(self.principale(nuovo_slug)):
            raise ErroreApi(409, 'esiste', f'Esiste già un progetto con il nome "{nuovo_slug}".')
        attuale = interpreta_json(attuali, f'Il file del progetto "{slug}" non è JSON valido.')
        progetto = con_cliente({
            'formatVersion': FORMATO_PROGETTO,
            'nome': nome,
            'libraryPath': attuale['libraryPath'] if isinstance(attuale.get('libraryPath'), str) else '',
            'workspace': attuale.get('workspace'),
        }, attuale)
        nuovi = serializza(progetto)
        # Il nome non fa parte delle versioni: la rinomina non ne crea una nuova
        scrivi_atomico(self.principale(nuovo_slug), nuovi)
        if nuovo_slug != slug:
            self.rimuovi_versioni(nuovo_slug)
            for n in self.numeri_versioni(slug):
                con_ritentativi(lambda n=n: os.replace(self.versione(slug, n), self.versione(nuovo_slug, n)))
            con_ritentativi(lambda: os.remove(self.principale(slug)))
            if self.leggi_ultimo() == slug:
                self.scrivi_ultimo(nuovo_slug)
        return {'slug': nuovo_slug, 'impronta': impronta_di(nuovi), 'versioni': self.conta_versioni(nuovo_slug)}

    def elimina(self, slug):
        percorso = self.principale(slug)
        if not os.path.isfile(percorso):
            raise ErroreApi(404, 'non_trovato', f'Il progetto "{slug}" non esiste.')
        base = f"{slug}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        destinazione = os.path.join(self.cartella_cestino, f"{base}.json")
        contatore = 2
        while os.path.exists(destinazione):
            destinazione = os.path.join(self.cartella_cestino, f"{base}_{contatore}.json")
            contatore += 1
        con_ritentativi(lambda: os.rename(percorso, destinazione))
        self.rimuovi_versioni(slug)
        if self.leggi_ultimo() == slug:
            self.scrivi_ultimo(None)

    # --- Ultimo progetto aperto ---

    def leggi_ultimo(self):
        try:
            slug = json.loads(leggi_bytes(self.file_ultimo).decode('utf-8')).get('progetto')
        except (OSError, ValueError, AttributeError, ErroreApi):
            return None
        return slug if slug_valido(slug) else None

    def scrivi_ultimo(self, slug):
        scrivi_atomico(self.file_ultimo, json.dumps({'progetto': slug}).encode('utf-8'))

# --- Librerie: confronto dei blocchi, livello semver e changelog ---

MANCANTE = object()

def forma_canonica(valore):
    # Stessa forma per lo stesso contenuto: niente spazi, chiavi in ordine
    return json.dumps(valore, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')

def valori_uguali(a, b):
    if a is MANCANTE or b is MANCANTE:
        return a is b
    return forma_canonica(a) == forma_canonica(b)

def semver_valido(valore):
    return isinstance(valore, str) and FORMATO_SEMVER.match(valore) is not None

def avanza_versione(versione, livello):
    major, minor, patch = (int(x) for x in versione.split('.'))
    if livello == 'major':
        return f"{major + 1}.0.0"
    if livello == 'minor':
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"

def formato_di(oggetto):
    valore = oggetto.get('formatVersion')
    return valore if type(valore) is int and valore > 0 else 0

def contenuto_di(oggetto):
    # Formato 1 e { library }: la mappa dei blocchi è in library; il formato vecchio è la mappa stessa
    for chiave in ('library', 'libreria'):
        if isinstance(oggetto.get(chiave), dict):
            return oggetto[chiave]
    return oggetto

def requisiti_di(blocco):
    requisiti = blocco.get('requisiti') if isinstance(blocco, dict) else None
    if not isinstance(requisiti, list):
        return []
    return [r for r in requisiti if isinstance(r, dict) and isinstance(r.get('id'), str)]

def titolo_di(blocco, id_blocco):
    titolo = blocco.get('titolo') if isinstance(blocco, dict) else None
    return titolo if isinstance(titolo, str) and titolo.strip() else id_blocco

def campi_cambiati(prima, dopo, esclusi):
    # Confronto generico: un campo aggiunto in futuro è coperto senza toccare il server
    chiavi = list(prima) + [k for k in dopo if k not in prima]
    return [k for k in chiavi
            if k not in esclusi and not valori_uguali(prima.get(k, MANCANTE), dopo.get(k, MANCANTE))]

def confronta_blocco(id_blocco, prima, dopo, rinomine=None):
    # Modifica di un blocco per il changelog, oppure None se non è cambiato nulla
    rinomine = rinomine or {}
    if not isinstance(prima, dict) and not isinstance(dopo, dict):
        return None
    if not isinstance(prima, dict):
        return {'blocco': id_blocco, 'titolo': titolo_di(dopo, id_blocco), 'tipo': 'creato', 'campiBlocco': [],
                'requisiti': [{'id': r['id'], 'tipo': 'aggiunto', 'campi': []} for r in requisiti_di(dopo)]}
    if not isinstance(dopo, dict):
        return {'blocco': id_blocco, 'titolo': titolo_di(prima, id_blocco), 'tipo': 'eliminato', 'campiBlocco': [],
                'requisiti': [{'id': r['id'], 'tipo': 'rimosso', 'campi': []} for r in requisiti_di(prima)]}

    campi_blocco = campi_cambiati(prima, dopo, {'id', 'requisiti'})
    req_prima = requisiti_di(prima)
    req_dopo = requisiti_di(dopo)

    # Prima le rinomine, poi l'abbinamento per id nuovo: uno scambio a→b, b→a dà due rinominato
    abbinati = {}
    for r in req_prima:
        if r['id'] in rinomine:
            abbinati[rinomine[r['id']]] = r
    for r in req_prima:
        if r['id'] not in rinomine and r['id'] not in abbinati:
            abbinati[r['id']] = r
    nuovo_id_di = {id(r): nuovo for nuovo, r in abbinati.items()}
    ids_dopo = [r['id'] for r in req_dopo]
    presenti = set(ids_dopo)

    ordine_prima = [nuovo_id_di[id(r)] for r in req_prima if id(r) in nuovo_id_di and nuovo_id_di[id(r)] in presenti]
    ordine_dopo = [i for i in ids_dopo if i in abbinati]
    if ordine_prima != ordine_dopo:
        campi_blocco.append('ordineRequisiti')

    modifiche = []
    usati = set()
    for r in req_dopo:
        vecchio = abbinati.get(r['id'])
        if vecchio is None:
            modifiche.append({'id': r['id'], 'tipo': 'aggiunto', 'campi': []})
            continue
        usati.add(id(vecchio))
        campi = campi_cambiati(vecchio, r, {'id'})
        if vecchio['id'] != r['id']:
            modifiche.append({'id': r['id'], 'tipo': 'rinominato', 'idPrecedente': vecchio['id'], 'campi': campi})
        elif campi:
            modifiche.append({'id': r['id'], 'tipo': 'modificato', 'campi': campi})
    for r in req_prima:
        if id(r) not in usati:
            modifiche.append({'id': r['id'], 'tipo': 'rimosso', 'campi': []})

    if not campi_blocco and not modifiche:
        return None
    return {'blocco': id_blocco, 'titolo': titolo_di(dopo, id_blocco), 'tipo': 'modificato',
            'campiBlocco': campi_blocco, 'requisiti': modifiche}

def confronta_librerie(prima, dopo):
    ids = list(prima) + [k for k in dopo if k not in prima]
    modifiche = []
    for id_blocco in ids:
        modifica = confronta_blocco(id_blocco, prima.get(id_blocco), dopo.get(id_blocco))
        if modifica:
            modifiche.append(modifica)
    return modifiche

def livello_di(modifiche):
    # major: requisito rimosso o rinominato, tipologia cambiata, blocco eliminato; minor: blocco o requisito nuovo
    livello = 'patch'
    for m in modifiche:
        if m['tipo'] in ('eliminato', 'rinominato'):
            return 'major'
        for r in m['requisiti']:
            if r['tipo'] in ('rimosso', 'rinominato') or 'tipologia' in r['campi']:
                return 'major'
        if m['tipo'] == 'creato' or any(r['tipo'] == 'aggiunto' for r in m['requisiti']):
            livello = 'minor'
    return livello

def autore_corrente():
    try:
        return getpass.getuser() or 'sconosciuto'
    except Exception:
        return 'sconosciuto'

def nuova_voce(origine, versione, livello, livello_calcolato, nota, dati, library, modifiche):
    return {
        'versione': versione,
        'data': datetime.now().astimezone().isoformat(timespec='seconds'),
        'autore': autore_corrente(),
        'origine': origine,
        'livello': livello,
        'livelloCalcolato': livello_calcolato,
        'nota': nota,
        'impronta': impronta_di(dati),
        'improntaContenuto': impronta_di(forma_canonica(library)),
        'modifiche': modifiche,
    }

def controlla_blocco(blocco):
    def rifiuta(messaggio):
        raise ErroreApi(400, 'blocco_non_valido', messaggio)
    if not isinstance(blocco, dict):
        rifiuta("Il blocco deve essere un oggetto.")
    id_blocco = blocco.get('id')
    if not isinstance(id_blocco, str) or not id_blocco.strip() or len(id_blocco) > LUNGHEZZA_MAX_ID_BLOCCO:
        rifiuta(f"L'ID del blocco deve essere un testo non vuoto di al massimo {LUNGHEZZA_MAX_ID_BLOCCO} caratteri.")
    if not isinstance(blocco.get('titolo'), str) or not blocco['titolo'].strip():
        rifiuta("Il titolo del blocco non può essere vuoto.")
    requisiti = blocco.get('requisiti')
    if not isinstance(requisiti, list):
        rifiuta("I requisiti del blocco devono essere un elenco.")
    visti = set()
    for req in requisiti:
        if not isinstance(req, dict) or not isinstance(req.get('id'), str) or not req['id'].strip():
            rifiuta("Ogni requisito deve essere un oggetto con un ID non vuoto.")
        if req['id'] in visti:
            rifiuta(f"L'ID \"{req['id']}\" è usato due volte in questo blocco.")
        visti.add(req['id'])

def dentro(percorso, cartella):
    percorso = os.path.normcase(percorso)
    cartella = os.path.normcase(cartella)
    return percorso.startswith(cartella + os.sep)

class FileLibreria:
    # I file di una libreria: il file stesso, il changelog accanto, copie e riferimento in _versioni/
    def __init__(self, reale, scrivibile):
        cartella, nome_file = os.path.split(reale)
        self.percorso = reale
        self.scrivibile = scrivibile
        self.nome = nome_file[:-5]
        self.changelog = os.path.join(cartella, self.nome + SUFFISSO_CHANGELOG)
        self.cartella_versioni = os.path.join(cartella, '_versioni')
        self.riferimento = os.path.join(self.cartella_versioni, f"{self.nome}.riferimento.json")

class ArchivioLibrerie:
    # Librerie dentro la cartella dell'app; ogni metodo va chiamato tenendo il lucchetto dei progetti
    def __init__(self, base_dir, max_versioni):
        self.base = os.path.realpath(base_dir)
        self.cartella_shared = os.path.join(self.base, 'shared')
        self.cartella_progetti = os.path.join(self.base, 'progetti')
        self.max_versioni = max_versioni

    def prepara(self):
        # Scritture interrotte da un arresto precedente, in shared/ e nelle sue _versioni/
        for radice, _, nomi in os.walk(self.cartella_shared):
            for nome in nomi:
                if nome.endswith('.tmp'):
                    try:
                        os.remove(os.path.join(radice, nome))
                    except OSError:
                        pass

    def risolvi(self, percorso):
        non_valido = ErroreApi(400, 'percorso_non_valido',
                               "Percorso della libreria non valido: serve un file .json relativo alla cartella dell'app, fuori da progetti/.")
        if (not isinstance(percorso, str) or not percorso or '\\' in percorso or ':' in percorso
                or percorso.startswith('/')):
            raise non_valido
        segmenti = percorso.split('/')
        minuscolo = percorso.lower()
        if (any(s in ('', '.', '..') for s in segmenti) or not minuscolo.endswith('.json')
                or minuscolo.endswith(SUFFISSO_CHANGELOG)):
            raise non_valido
        reale = os.path.realpath(os.path.join(self.base, *segmenti))
        if not dentro(reale, self.base) or dentro(reale, self.cartella_progetti):
            raise non_valido
        shared = os.path.realpath(self.cartella_shared)
        scrivibile = dentro(reale, shared) and '_versioni' not in [
            os.path.normcase(parte) for parte in os.path.relpath(reale, shared).split(os.sep)[:-1]]
        return FileLibreria(reale, scrivibile)

    # --- Lettura ---

    def leggi_libreria(self, f, percorso):
        if not os.path.isfile(f.percorso):
            raise ErroreApi(404, 'non_trovata', f'La libreria "{percorso}" non esiste.')
        dati = leggi_bytes(f.percorso)
        oggetto = interpreta_json(dati, f'Il file della libreria "{percorso}" non è JSON valido.')
        formato = formato_di(oggetto)
        if formato == FORMATO_LIBRERIA and not isinstance(oggetto.get('library'), dict):
            raise ErroreApi(422, 'json_non_valido', f'Il file della libreria "{percorso}" non contiene la mappa "library".')
        return dati, oggetto, formato

    def leggi_changelog(self, f):
        # None se il file manca; 422 se esiste ma non ha la forma attesa
        if not os.path.isfile(f.changelog):
            return None
        non_valido = ErroreApi(422, 'changelog_non_valido', MSG_CHANGELOG_ILLEGGIBILE)
        try:
            dati = json.loads(leggi_bytes(f.changelog).decode('utf-8'))
        except (UnicodeDecodeError, ValueError):
            raise non_valido
        voci = dati.get('voci') if isinstance(dati, dict) else None
        if (not isinstance(dati, dict) or dati.get('formatVersion') != 1 or not isinstance(voci, list)
                or not all(isinstance(v, dict) for v in voci)):
            raise non_valido
        if voci and not (semver_valido(voci[-1].get('versione')) and isinstance(voci[-1].get('improntaContenuto'), str)):
            raise non_valido
        return dati

    def leggi_riferimento(self, f):
        try:
            oggetto = json.loads(leggi_bytes(f.riferimento).decode('utf-8'))
        except (OSError, ValueError, UnicodeDecodeError, ErroreApi):
            return None
        return contenuto_di(oggetto) if isinstance(oggetto, dict) else None

    # --- Scrittura ---

    def aggiungi_voce(self, f, changelog, voce):
        # Il changelog cresce solo in fondo; restituisce il changelog nuovo solo se è su disco
        voci = (changelog['voci'] if changelog else []) + [voce]
        nuovo = {'formatVersion': 1, 'voci': voci}
        scrivi_atomico(f.changelog, serializza(nuovo))
        return nuovo

    def aggiorna_riferimento(self, f, dati):
        os.makedirs(f.cartella_versioni, exist_ok=True)
        scrivi_atomico(f.riferimento, dati)

    def scrivi_libreria(self, f, attuali, nuovi):
        # La versione precedente passa in _versioni/<nome>.1.json prima di sostituire il file
        os.makedirs(f.cartella_versioni, exist_ok=True)
        ruota_copie(f.cartella_versioni, f.nome, attuali, self.max_versioni)
        scrivi_atomico(f.percorso, nuovi)

    def allinea(self, f, oggetto, dati, contenuto, changelog):
        # Voce iniziale se il changelog manca, voce esterna se il contenuto non è quello dell'ultima voce
        voci = changelog['voci'] if changelog else []
        if not voci:
            versione = oggetto.get('versione') if semver_valido(oggetto.get('versione')) else '1.0.0'
            voce = nuova_voce('iniziale', versione, None, None, '', dati, contenuto, [])
        elif impronta_di(forma_canonica(contenuto)) != voci[-1]['improntaContenuto']:
            riferimento = self.leggi_riferimento(f)
            if riferimento is None:
                modifiche, livello, nota = [], 'patch', "Contenuto precedente non disponibile"
            else:
                modifiche = confronta_librerie(riferimento, contenuto)
                livello, nota = livello_di(modifiche), "Modifica fatta fuori dall'app"
            voce = nuova_voce('esterna', avanza_versione(voci[-1]['versione'], livello), livello, livello,
                              nota, dati, contenuto, modifiche)
        else:
            return changelog, []
        changelog = self.aggiungi_voce(f, changelog, voce)
        self.aggiorna_riferimento(f, dati)
        return changelog, [voce]

    # --- API ---

    def apri(self, percorso):
        f = self.risolvi(percorso)
        dati, oggetto, formato = self.leggi_libreria(f, percorso)
        versione_file = oggetto.get('versione') if semver_valido(oggetto.get('versione')) else None
        risposta = {'libreria': oggetto, 'impronta': impronta_di(dati), 'scrivibile': f.scrivibile,
                    'formato': formato, 'vociAggiunte': []}
        try:
            changelog = self.leggi_changelog(f)
        except ErroreApi as e:
            risposta.update(scrivibile=False, avviso=e.messaggio, versione=versione_file)
            return risposta
        if formato > FORMATO_LIBRERIA:
            risposta.update(scrivibile=False, avviso=MSG_FORMATO_FUTURO)
        elif f.scrivibile:
            # Aprire non modifica mai il file della libreria: si scrivono solo changelog e riferimento
            try:
                changelog, risposta['vociAggiunte'] = self.allinea(f, oggetto, dati, contenuto_di(oggetto), changelog)
            except ErroreApi as e:
                risposta['avviso'] = f"Il changelog non è stato aggiornato: {e.messaggio}"
        voci = changelog['voci'] if changelog else []
        risposta['versione'] = voci[-1]['versione'] if voci else (versione_file or ('1.0.0' if risposta['scrivibile'] else None))
        return risposta

    def salva(self, corpo):
        percorso = corpo.get('percorso')
        f = self.risolvi(percorso)
        if not f.scrivibile:
            raise ErroreApi(403, 'percorso_non_scrivibile',
                            "L'app scrive solo librerie dentro shared/ (escluse le cartelle _versioni).")
        blocco = corpo.get('blocco')
        controlla_blocco(blocco)
        nuovo = corpo.get('nuovo')
        if not isinstance(nuovo, bool):
            raise ErroreApi(400, 'richiesta_non_valida', 'Il campo "nuovo" deve essere vero o falso.')
        rinomine = corpo.get('rinomine') or {}
        if not isinstance(rinomine, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in rinomine.items()):
            raise ErroreApi(400, 'rinomine_non_valide', 'Le rinomine dei requisiti non sono valide.')
        livello = corpo.get('livello')
        if livello != 'auto' and livello not in ORDINE_LIVELLI:
            raise ErroreApi(400, 'livello_non_valido', 'Il livello deve essere auto, patch, minor o major.')
        nota = corpo.get('nota') or ''
        if not isinstance(nota, str) or len(nota) > LUNGHEZZA_MAX_NOTA:
            raise ErroreApi(400, 'richiesta_non_valida', f'Il motivo della modifica supera i {LUNGHEZZA_MAX_NOTA} caratteri.')
        nota = nota.strip()
        forza = corpo.get('forza') is True

        dati, oggetto, formato = self.leggi_libreria(f, percorso)
        if formato > FORMATO_LIBRERIA:
            raise ErroreApi(403, 'percorso_non_scrivibile', MSG_FORMATO_FUTURO)
        contenuto = contenuto_di(oggetto)
        changelog = self.leggi_changelog(f)
        id_blocco = blocco['id']
        if nuovo and id_blocco in contenuto:
            raise ErroreApi(409, 'esiste', f'Un blocco con ID "{id_blocco}" esiste già nella libreria su disco.')
        impronta_attuale = impronta_di(dati)
        coincide = corpo.get('improntaAttesa') == impronta_attuale
        if not coincide and not forza:
            raise ErroreApi(409, 'conflitto', "Il file della libreria è cambiato sul disco dopo che l'app l'ha letto.",
                            impronta=impronta_attuale)

        # Formato vecchio: la libreria già normalizzata dal client, valida solo se rappresenta proprio questo file
        prima = contenuto
        if formato == 0 and coincide:
            base = corpo.get('base')
            if not isinstance(base, dict):
                raise ErroreApi(400, 'base_mancante', 'Per convertire una libreria in formato vecchio serve la libreria normalizzata.')
            prima = base
        blocco_prima = prima.get(id_blocco)

        ids_prima = {r['id'] for r in requisiti_di(blocco_prima)}
        ids_nuovi = {r['id'] for r in blocco['requisiti']}
        if ((nuovo and rinomine) or not set(rinomine).issubset(ids_prima)
                or not set(rinomine.values()).issubset(ids_nuovi) or len(set(rinomine.values())) != len(rinomine)):
            raise ErroreApi(400, 'rinomine_non_valide',
                            'Le rinomine dei requisiti non corrispondono al blocco su disco: ricarica la libreria.')
        for altro_id, altro in prima.items():
            if altro_id == id_blocco:
                continue
            for req in requisiti_di(altro):
                if req['id'] in ids_nuovi:
                    raise ErroreApi(400, 'id_duplicato',
                                    f'L\'ID "{req["id"]}" è già usato dal blocco "{titolo_di(altro, altro_id)}" nella libreria su disco.')

        # Da qui in poi si scrive: prima le voci iniziale o esterna, poi la modifica
        changelog, voci_aggiunte = self.allinea(f, oggetto, dati, contenuto, changelog)
        versione_corrente = changelog['voci'][-1]['versione']
        library_nuova = dict(prima)
        library_nuova[id_blocco] = blocco
        modifica = confronta_blocco(id_blocco, blocco_prima, blocco, rinomine)

        if modifica is None:
            # La conversione dal formato vecchio non è una modifica: si fa solo se non cambia il contenuto,
            # altrimenti la prossima apertura la registrerebbe come modifica esterna (resta per il prossimo Salva)
            if formato == 0 and coincide and valori_uguali(prima, contenuto):
                oggetto_nuovo = {'formatVersion': FORMATO_LIBRERIA, 'versione': versione_corrente, 'library': prima}
                nuovi = serializza(oggetto_nuovo)
                self.scrivi_libreria(f, dati, nuovi)
                try:
                    self.aggiorna_riferimento(f, nuovi)
                except ErroreApi:
                    pass
                return {'invariata': True, 'versione': versione_corrente, 'impronta': impronta_di(nuovi),
                        'libreria': oggetto_nuovo, 'formato': FORMATO_LIBRERIA, 'vociAggiunte': voci_aggiunte}
            return {'invariata': True, 'versione': versione_corrente, 'impronta': impronta_attuale,
                    'libreria': oggetto, 'formato': formato, 'vociAggiunte': voci_aggiunte}

        return self._applica(f, dati, changelog, voci_aggiunte, library_nuova, modifica, livello, nota)

    def _applica(self, f, dati, changelog, voci_aggiunte, library_nuova, modifica, livello, nota):
        # Scrittura comune a salva, elimina e rinomina: versione, file, voce di changelog e riferimento
        versione_corrente = changelog['voci'][-1]['versione']
        calcolato = livello_di([modifica])
        effettivo = calcolato if livello == 'auto' else max(livello, calcolato, key=ORDINE_LIVELLI.get)
        versione_nuova = avanza_versione(versione_corrente, effettivo)
        oggetto_nuovo = {'formatVersion': FORMATO_LIBRERIA, 'versione': versione_nuova, 'library': library_nuova}
        nuovi = serializza(oggetto_nuovo)
        self.scrivi_libreria(f, dati, nuovi)
        risposta = {'libreria': oggetto_nuovo, 'impronta': impronta_di(nuovi), 'formato': FORMATO_LIBRERIA,
                    'vociAggiunte': voci_aggiunte}
        voce = nuova_voce('app', versione_nuova, effettivo, calcolato, nota, nuovi, library_nuova, [modifica])
        try:
            self.aggiungi_voce(f, changelog, voce)
        except ErroreApi:
            # Alla prossima apertura il contenuto non coincide con l'ultima voce: diventa una voce esterna
            return {**risposta, 'versione': versione_corrente, 'voce': None,
                    'avviso': "La libreria è salvata ma il changelog non è stato aggiornato: la modifica verrà registrata come modifica esterna"}
        try:
            self.aggiorna_riferimento(f, nuovi)
        except ErroreApi:
            risposta['avviso'] = "La copia di riferimento in _versioni/ non è stata aggiornata: una futura modifica esterna potrebbe risultare incompleta nel changelog"
        return {**risposta, 'versione': versione_nuova, 'voce': voce}

    # --- Eliminazione e rinomina di un blocco (spec 0010) ---

    def _prepara_operazione(self, corpo):
        # Controlli comuni a elimina e rinomina; restituisce ciò che serve a _applica
        percorso = corpo.get('percorso')
        f = self.risolvi(percorso)
        if not f.scrivibile:
            raise ErroreApi(403, 'percorso_non_scrivibile',
                            "L'app scrive solo librerie dentro shared/ (escluse le cartelle _versioni).")
        livello = corpo.get('livello')
        if livello != 'auto' and livello not in ORDINE_LIVELLI:
            raise ErroreApi(400, 'livello_non_valido', 'Il livello deve essere auto, patch, minor o major.')
        nota = corpo.get('nota') or ''
        if not isinstance(nota, str) or len(nota) > LUNGHEZZA_MAX_NOTA:
            raise ErroreApi(400, 'richiesta_non_valida', f'Il motivo della modifica supera i {LUNGHEZZA_MAX_NOTA} caratteri.')
        id_blocco = corpo.get('idBlocco')
        if not isinstance(id_blocco, str) or not id_blocco:
            raise ErroreApi(400, 'richiesta_non_valida', "Manca l'ID del blocco.")
        dati, oggetto, formato = self.leggi_libreria(f, percorso)
        if formato > FORMATO_LIBRERIA:
            raise ErroreApi(403, 'percorso_non_scrivibile', MSG_FORMATO_FUTURO)
        if formato == 0:
            raise ErroreApi(409, 'formato_vecchio', 'Salva prima una modifica di un blocco: converte la libreria al formato nuovo.')
        contenuto = contenuto_di(oggetto)
        changelog = self.leggi_changelog(f)
        impronta_attuale = impronta_di(dati)
        if corpo.get('improntaAttesa') != impronta_attuale and corpo.get('forza') is not True:
            raise ErroreApi(409, 'conflitto', "Il file della libreria è cambiato sul disco dopo che l'app l'ha letto.",
                            impronta=impronta_attuale)
        if id_blocco not in contenuto:
            raise ErroreApi(404, 'non_trovato', f'Il blocco "{id_blocco}" non è nella libreria su disco.')
        return f, dati, oggetto, contenuto, changelog, id_blocco, livello, nota.strip()

    def elimina(self, corpo):
        f, dati, oggetto, contenuto, changelog, id_blocco, livello, nota = self._prepara_operazione(corpo)
        changelog, voci_aggiunte = self.allinea(f, oggetto, dati, contenuto, changelog)
        library_nuova = {k: v for k, v in contenuto.items() if k != id_blocco}
        modifica = confronta_blocco(id_blocco, contenuto[id_blocco], None)
        return self._applica(f, dati, changelog, voci_aggiunte, library_nuova, modifica, livello, nota)

    def rinomina_blocco(self, corpo):
        nuovo_id = corpo.get('nuovoId')
        if (not isinstance(nuovo_id, str) or not FORMATO_ID_BLOCCO.match(nuovo_id)
                or len(nuovo_id) > LUNGHEZZA_MAX_ID_BLOCCO):
            raise ErroreApi(400, 'id_non_valido', "L'ID può contenere solo lettere, cifre, underscore, trattino e punto "
                                                  f"(al massimo {LUNGHEZZA_MAX_ID_BLOCCO} caratteri).")
        f, dati, oggetto, contenuto, changelog, id_blocco, livello, nota = self._prepara_operazione(corpo)
        if nuovo_id == id_blocco:
            raise ErroreApi(400, 'id_uguale', "Il nuovo ID è uguale a quello di adesso.")
        if any(k.lower() == nuovo_id.lower() for k in contenuto if k != id_blocco):
            raise ErroreApi(409, 'esiste', f'Un blocco con ID "{nuovo_id}" esiste già nella libreria.')
        changelog, voci_aggiunte = self.allinea(f, oggetto, dati, contenuto, changelog)
        blocco = {**contenuto[id_blocco], 'id': nuovo_id}
        # Stesso posto nell'ordine del file
        library_nuova = {(nuovo_id if k == id_blocco else k): (blocco if k == id_blocco else v) for k, v in contenuto.items()}
        modifica = {'blocco': nuovo_id, 'idPrecedente': id_blocco, 'titolo': titolo_di(blocco, nuovo_id),
                    'tipo': 'rinominato', 'campiBlocco': ['id'], 'requisiti': []}
        return self._applica(f, dati, changelog, voci_aggiunte, library_nuova, modifica, livello, nota)

    def leggi_voci(self, percorso):
        f = self.risolvi(percorso)
        changelog = self.leggi_changelog(f)
        voci = changelog['voci'] if changelog else []
        return {'versione': voci[-1]['versione'] if voci else None, 'voci': voci}

# --- Lettura dei file del cliente: .xlsx/.xlsm con zipfile ed ElementTree, .csv con il modulo csv ---
# Non scrive e non legge nulla sul disco: lavora solo sui byte ricevuti

def locale(tag):
    # Nome senza namespace: accetta sia l'OOXML di Excel sia la variante strict
    return tag.rsplit('}', 1)[-1] if isinstance(tag, str) else ''

def attributo(el, nome):
    # Attributo cercato per nome locale (es. l'id della relazione, che ha un namespace)
    for chiave, valore in el.attrib.items():
        if locale(chiave) == nome:
            return valore
    return None

def togli_righe_vuote_finali(righe):
    while righe and not any(cella != '' for cella in righe[-1]):
        righe.pop()
    return righe

class LettoreXlsx:
    def __init__(self, dati):
        try:
            self.zip = zipfile.ZipFile(io.BytesIO(dati))
        except (zipfile.BadZipFile, ValueError):
            raise ErroreApi(422, 'file_illeggibile', MSG_FILE_ILLEGGIBILE)
        self.letti = 0

    def parte(self, nome, obbligatoria=True):
        # Legge una parte dello zip rispettando il limite complessivo dei byte decompressi (zip bomba)
        try:
            info = self.zip.getinfo(nome)
        except KeyError:
            if obbligatoria:
                raise ErroreApi(422, 'file_illeggibile', MSG_FILE_ILLEGGIBILE)
            return None
        rimasti = MAX_DECOMPRESSO - self.letti
        try:
            with self.zip.open(info) as f:
                dati = f.read(rimasti + 1)
        except (zipfile.BadZipFile, RuntimeError, OSError, EOFError, NotImplementedError):
            raise ErroreApi(422, 'file_illeggibile', MSG_FILE_ILLEGGIBILE)
        if len(dati) > rimasti:
            raise ErroreApi(413, 'troppo_grande', 'Il file decompresso supera il limite di 200 MB.')
        self.letti += len(dati)
        return dati

    def xml(self, nome, obbligatoria=True):
        dati = self.parte(nome, obbligatoria)
        if dati is None:
            return None
        # Niente DOCTYPE: nessuna entità definita dal file
        if re.search(rb'<!DOCTYPE', dati, re.IGNORECASE):
            raise ErroreApi(422, 'file_illeggibile', MSG_FILE_ILLEGGIBILE)
        try:
            return ET.fromstring(dati)
        except ET.ParseError:
            raise ErroreApi(422, 'file_illeggibile', MSG_FILE_ILLEGGIBILE)

    @staticmethod
    def testo_ricco(el):
        # Testo di <si> o <is>: <t> diretto più i <t> dei <r>, mai le letture fonetiche in <rPh>
        parti = []
        for figlio in el:
            nome = locale(figlio.tag)
            if nome == 't':
                parti.append(figlio.text or '')
            elif nome == 'r':
                parti.extend(t.text or '' for t in figlio if locale(t.tag) == 't')
        return ''.join(parti)

    def testi_condivisi(self):
        radice = self.xml('xl/sharedStrings.xml', obbligatoria=False)
        if radice is None:
            return []
        return [self.testo_ricco(si) for si in radice if locale(si.tag) == 'si']

    def fogli_dichiarati(self):
        # [(nome, percorso nello zip, nascosto)] nell'ordine di xl/workbook.xml, solo fogli di lavoro
        relazioni = {}
        for rel in self.xml('xl/_rels/workbook.xml.rels'):
            if locale(rel.tag) != 'Relationship' or not (rel.get('Type') or '').endswith('/worksheet'):
                continue
            destinazione = rel.get('Target') or ''
            if destinazione.startswith('/'):
                percorso = destinazione.lstrip('/')
            else:
                percorso = posixpath.normpath(posixpath.join('xl', destinazione))
            relazioni[rel.get('Id')] = percorso
        fogli = []
        for el in self.xml('xl/workbook.xml').iter():
            if locale(el.tag) != 'sheet':
                continue
            percorso = relazioni.get(attributo(el, 'id'))
            if percorso:
                fogli.append((el.get('name') or f'Foglio{len(fogli) + 1}', percorso,
                              el.get('state') in ('hidden', 'veryHidden')))
        return fogli

    @staticmethod
    def indice_colonna(riferimento):
        # "C5" → 2; None se il riferimento non ha lettere
        lettere = re.match(r'[A-Za-z]+', riferimento or '')
        if not lettere:
            return None
        n = 0
        for c in lettere.group(0).upper():
            n = n * 26 + (ord(c) - 64)
        return n - 1

    @staticmethod
    def valore_cella(c, condivisi):
        tipo = c.get('t') or 'n'
        if tipo == 'inlineStr':
            testo = next((f for f in c if locale(f.tag) == 'is'), None)
            return LettoreXlsx.testo_ricco(testo) if testo is not None else ''
        v = next((f for f in c if locale(f.tag) == 'v'), None)
        # Una cella senza <v> (anche una formula senza valore salvato) è vuota
        if v is None or v.text is None:
            return ''
        grezzo = v.text
        if tipo == 's':
            try:
                return condivisi[int(grezzo)]
            except (ValueError, IndexError):
                return ''
        if tipo == 'b':
            return '1' if grezzo.strip() == '1' else '0'
        if tipo == 'e':
            return ''
        if tipo == 'n':
            try:
                numero = float(grezzo)
            except ValueError:
                return grezzo
            if math.isfinite(numero) and numero.is_integer():
                return str(int(numero))
            return repr(numero)
        # str, d e tipi sconosciuti: il testo così com'è
        return grezzo

    def righe_foglio(self, percorso, condivisi):
        radice = self.xml(percorso)
        righe = []
        numero_riga = 0
        for riga in radice.iter():
            if locale(riga.tag) != 'row':
                continue
            try:
                numero_riga = int(riga.get('r')) if riga.get('r') else numero_riga + 1
            except ValueError:
                numero_riga += 1
            # Le righe assenti nel file restano righe vuote: il numero di riga resta quello di Excel
            while len(righe) < numero_riga:
                righe.append([])
            celle = righe[numero_riga - 1]
            colonna = -1
            for c in riga:
                if locale(c.tag) != 'c':
                    continue
                indice = self.indice_colonna(c.get('r'))
                colonna = indice if indice is not None else colonna + 1
                valore = self.valore_cella(c, condivisi)
                if valore == '':
                    continue
                while len(celle) <= colonna:
                    celle.append('')
                celle[colonna] = valore
        return togli_righe_vuote_finali(righe)

    def leggi(self):
        condivisi = self.testi_condivisi()
        return [{'nome': nome, 'nascosto': nascosto, 'righe': self.righe_foglio(percorso, condivisi)}
                for nome, percorso, nascosto in self.fogli_dichiarati()]

def leggi_csv(dati, nome_file):
    try:
        testo = dati.decode('utf-8-sig')
    except UnicodeDecodeError:
        try:
            testo = dati.decode('cp1252')
        except UnicodeDecodeError:
            raise ErroreApi(422, 'file_illeggibile', 'Il CSV non è in UTF-8 né in Windows-1252.')
    try:
        separatore = csv.Sniffer().sniff(testo[:CAMPIONE_SEPARATORE], delimiters=';,\t').delimiter
    except csv.Error:
        # Il separatore dell'Excel italiano
        separatore = ';'
    try:
        righe = [list(riga) for riga in csv.reader(io.StringIO(testo, newline=''), delimiter=separatore)]
    except csv.Error:
        raise ErroreApi(422, 'file_illeggibile', 'Il CSV non è leggibile: controlla virgolette e separatori.')
    return [{'nome': os.path.splitext(nome_file)[0] or 'CSV', 'nascosto': False,
             'righe': togli_righe_vuote_finali(righe)}]

def leggi_file_cliente(corpo, max_mb):
    nome_file = corpo.get('nomeFile')
    contenuto = corpo.get('contenuto')
    if not isinstance(nome_file, str) or not nome_file.strip() or not isinstance(contenuto, str):
        raise ErroreApi(400, 'richiesta_non_valida', 'Servono nomeFile e contenuto (base64).')
    nome_file = os.path.basename(nome_file.strip().replace('\\', '/'))
    estensione = os.path.splitext(nome_file)[1].lower()
    if estensione not in ESTENSIONI_XLSX + ('.csv',):
        raise ErroreApi(415, 'formato_non_supportato', MSG_FORMATO_CLIENTE)
    # Il limite si controlla sul base64, prima di decodificarlo
    if len(contenuto) > math.ceil(max_mb * 1048576 / 3) * 4:
        raise ErroreApi(413, 'troppo_grande', f'Il file supera il limite di {max_mb:g} MB (cliente.maxFileMB in settings.json).')
    try:
        dati = base64.b64decode(contenuto, validate=True)
    except (binascii.Error, ValueError):
        raise ErroreApi(400, 'richiesta_non_valida', 'Il contenuto del file non è base64 valido.')
    if not dati.strip():
        raise ErroreApi(422, 'file_vuoto', 'Il file è vuoto.')
    # Firma OLE: un .xls vecchio o un .xlsx protetto da password
    if dati.startswith(FIRMA_OLE):
        raise ErroreApi(415, 'formato_non_supportato', MSG_FORMATO_CLIENTE)
    if estensione == '.csv':
        formato, fogli = 'csv', leggi_csv(dati, nome_file)
    else:
        formato, fogli = 'xlsx', LettoreXlsx(dati).leggi()
    if not any(cella != '' for foglio in fogli for riga in foglio['righe'] for cella in riga):
        raise ErroreApi(422, 'file_vuoto', 'Il file è vuoto.')
    return {'formato': formato, 'fogli': fogli}

class CustomHandler(SimpleHTTPRequestHandler):
    # Mappatura corretta dei tipi MIME per moduli JS e file JSON
    extensions_map = {
        '': 'application/octet-stream',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
    }
    # Chrome apre socket in anticipo e può lasciarli muti: nessun thread resta appeso per sempre
    timeout = 10
    archivio = None  # impostato in main()
    librerie = None  # impostato in main()
    aggiornamento = None  # impostato in main()
    max_file_cliente_mb = MAX_FILE_CLIENTE_MB_PREDEFINITO  # impostato in main()

    # --- Log in console: solo le richieste fallite, una riga ciascuna (spec 0014) ---

    def log_request(self, code='-', size='-'):
        try:
            codice = int(getattr(code, 'value', code))
        except (TypeError, ValueError):
            return
        if codice < 400:
            return
        percorso = urlsplit(self.path).path if isinstance(getattr(self, 'path', None), str) else '-'
        metodo = getattr(self, 'command', None) or '-'
        if codice == 404 and metodo == 'GET' and percorso == '/favicon.ico':
            return
        stampa_info(f"{metodo} {percorso} → {codice}")

    def log_error(self, format, *args):
        # I messaggi di send_error ("code 404, message ...") sono già nella riga di log_request
        if format.startswith('code '):
            return
        stampa_errore(format % args)

    def log_message(self, format, *args):
        stampa_info(format % args)

    # --- Instradamento ---

    def e_api(self):
        percorso = urlsplit(self.path).path
        return percorso == '/api' or percorso.startswith('/api/')

    def e_cartella_progetti(self):
        # progetti/ si legge solo tramite /api/ (controllo sul percorso reale: niente trucchi con maiuscole o ../)
        reale = os.path.normcase(os.path.realpath(self.translate_path(self.path)))
        cartella = os.path.normcase(os.path.realpath(self.archivio.cartella))
        return reale == cartella or reale.startswith(cartella + os.sep)

    def do_GET(self):
        if self.e_api():
            return self.gestisci_api('GET')
        if self.e_cartella_progetti():
            return self.send_error(404)
        super().do_GET()

    def do_HEAD(self):
        if self.e_api() or self.e_cartella_progetti():
            return self.send_error(404)
        super().do_HEAD()

    def do_POST(self):
        self.gestisci_scrittura('POST')

    def do_PUT(self):
        self.gestisci_scrittura('PUT')

    def do_DELETE(self):
        self.gestisci_scrittura('DELETE')

    def do_OPTIONS(self):
        # Nessuna intestazione CORS: un altro sito non supera il controllo preventivo
        self.invia_json(405, {'errore': 'metodo_non_consentito', 'messaggio': 'Metodo non consentito.'})

    def gestisci_scrittura(self, metodo):
        if self.e_api():
            return self.gestisci_api(metodo)
        self.send_error(405)

    # --- Controlli comuni ---

    def controlla_origine(self):
        host_ammessi = {f'localhost:{PORT}', f'127.0.0.1:{PORT}'}
        host = (self.headers.get('Host') or '').strip().lower()
        if host not in host_ammessi:
            raise ErroreApi(403, 'accesso_negato', 'Richiesta rifiutata: host non ammesso.')
        origine = self.headers.get('Origin')
        if origine is not None and origine.strip().lower() not in {f'http://{h}' for h in host_ammessi}:
            raise ErroreApi(403, 'accesso_negato', 'Richiesta rifiutata: origine non ammessa.')

    def controlla_content_type(self):
        tipo = (self.headers.get('Content-Type') or '').split(';')[0].strip().lower()
        if tipo != 'application/json':
            raise ErroreApi(415, 'tipo_non_supportato', 'Le scritture richiedono Content-Type: application/json.')

    def leggi_corpo(self):
        lunghezza = self.headers.get('Content-Length')
        if lunghezza is None:
            raise ErroreApi(411, 'lunghezza_mancante', 'Manca Content-Length.')
        try:
            n = int(lunghezza)
        except ValueError:
            n = -1
        if n < 0:
            raise ErroreApi(400, 'richiesta_non_valida', 'Content-Length non valido.')
        if n > MAX_CORPO:
            if urlsplit(self.path).path == '/api/cliente/leggi':
                raise ErroreApi(413, 'troppo_grande', f'Il file supera il limite di {self.max_file_cliente_mb:g} MB (cliente.maxFileMB in settings.json).')
            raise ErroreApi(413, 'troppo_grande', 'Il progetto supera il limite di 50 MB.')
        try:
            corpo = json.loads(self.rfile.read(n).decode('utf-8'))
        except (UnicodeDecodeError, ValueError):
            raise ErroreApi(400, 'json_non_valido', 'Il corpo della richiesta non è JSON valido.')
        if not isinstance(corpo, dict):
            raise ErroreApi(400, 'richiesta_non_valida', 'Il corpo della richiesta deve essere un oggetto JSON.')
        return corpo

    # --- API ---

    def gestisci_api(self, metodo):
        try:
            self.controlla_origine()
            segmenti = [unquote(parte) for parte in urlsplit(self.path).path.split('/')[2:]]
            if not segmenti or '' in segmenti:
                raise ErroreApi(404, 'non_trovato', 'Indirizzo API sconosciuto.')
            if metodo in ('POST', 'PUT', 'DELETE'):
                self.controlla_content_type()
            if segmenti == ['cliente', 'leggi']:
                # Non tocca il disco: niente lucchetto, così un file grande non ferma gli autosalvataggi
                if metodo != 'POST':
                    raise ErroreApi(405, 'metodo_non_consentito', 'Metodo non consentito.')
                return self.invia_json(200, leggi_file_cliente(self.leggi_corpo(), self.max_file_cliente_mb))
            if segmenti[0] == 'aggiornamento':
                # Fuori dal lucchetto dei file: lo stato ha il suo, l'installazione lavora in un thread
                return self.gestisci_aggiornamento(metodo, segmenti)
            corpo = self.leggi_corpo() if metodo in ('POST', 'PUT') else {}
            with self.archivio.lucchetto:
                stato, risposta = self.instrada(metodo, segmenti, corpo)
            self.invia_json(stato, risposta)
        except ErroreApi as e:
            self.invia_json(e.stato, {'errore': e.codice, 'messaggio': e.messaggio, **e.extra})
        except Exception as e:
            self.log_error('Errore interno su %s %s: %r', metodo, self.path, e)
            self.invia_json(500, {'errore': 'errore_interno', 'messaggio': f'Errore interno del server: {e}'})

    def gestisci_aggiornamento(self, metodo, segmenti):
        stato = self.aggiornamento
        if segmenti == ['aggiornamento']:
            if metodo != 'GET':
                raise ErroreApi(405, 'metodo_non_consentito', 'Metodo non consentito.')
            return self.invia_json(200, stato.pubblico())
        if segmenti == ['aggiornamento', 'installa']:
            if metodo != 'POST':
                raise ErroreApi(405, 'metodo_non_consentito', 'Metodo non consentito.')
            corpo = self.leggi_corpo()
            stato.avvia_installazione(corpo.get('versione'))
            # Non daemon (i thread delle richieste lo sono): il processo deve restare vivo fino al riavvio
            threading.Thread(target=installa_aggiornamento, args=(stato, self.server, stato.base_dir), daemon=False).start()
            return self.invia_json(202, {'stato': 'download'})
        raise ErroreApi(404, 'non_trovato', 'Indirizzo API sconosciuto.')

    def instrada(self, metodo, segmenti, corpo):
        archivio = self.archivio
        non_consentito = ErroreApi(405, 'metodo_non_consentito', 'Metodo non consentito.')

        if segmenti == ['progetti']:
            if metodo == 'GET':
                return 200, archivio.elenco()
            if metodo == 'POST':
                return 201, archivio.crea(corpo.get('slug'), corpo.get('progetto'))
            raise non_consentito

        if segmenti[0] == 'progetti' and len(segmenti) in (2, 3):
            slug = segmenti[1]
            controlla_slug(slug)
            if len(segmenti) == 2:
                if metodo == 'GET':
                    return 200, archivio.leggi(slug)
                if metodo == 'PUT':
                    return 200, archivio.scrivi(slug, corpo.get('progetto'), corpo.get('improntaAttesa'),
                                                corpo.get('forza') is True)
                if metodo == 'DELETE':
                    archivio.elimina(slug)
                    return 204, None
                raise non_consentito
            if segmenti[2] == 'annulla':
                if metodo != 'POST':
                    raise non_consentito
                return 200, archivio.annulla(slug, corpo.get('improntaAttesa'))
            if segmenti[2] == 'rinomina':
                if metodo != 'POST':
                    raise non_consentito
                return 200, archivio.rinomina(slug, corpo.get('nuovoSlug'), corpo.get('nome'), corpo.get('improntaAttesa'))

        if segmenti[0] == 'libreria' and len(segmenti) == 2:
            # Stesso lucchetto dei progetti: tutte le operazioni sui file sono una alla volta
            if segmenti[1] == 'apri':
                if metodo != 'POST':
                    raise non_consentito
                return 200, self.librerie.apri(corpo.get('percorso'))
            if segmenti[1] == 'salva':
                if metodo != 'POST':
                    raise non_consentito
                return 200, self.librerie.salva(corpo)
            if segmenti[1] == 'elimina':
                if metodo != 'POST':
                    raise non_consentito
                return 200, self.librerie.elimina(corpo)
            if segmenti[1] == 'rinomina':
                if metodo != 'POST':
                    raise non_consentito
                return 200, self.librerie.rinomina_blocco(corpo)
            if segmenti[1] == 'changelog':
                if metodo != 'GET':
                    raise non_consentito
                percorso = parse_qs(urlsplit(self.path).query).get('percorso', [None])[0]
                return 200, self.librerie.leggi_voci(percorso)

        if segmenti == ['ultimo']:
            if metodo == 'GET':
                return 200, {'progetto': archivio.leggi_ultimo()}
            if metodo == 'PUT':
                controlla_slug(corpo.get('progetto'))
                archivio.scrivi_ultimo(corpo['progetto'])
                return 204, None
            raise non_consentito

        raise ErroreApi(404, 'non_trovato', 'Indirizzo API sconosciuto.')

    def invia_json(self, stato, dati):
        if stato == 204:
            self.send_response(204)
            self.end_headers()
            return
        corpo = json.dumps(dati, ensure_ascii=False).encode('utf-8')
        self.send_response(stato)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(corpo)

# --- AGGIORNAMENTO AUTOMATICO (vedi docs/specs/0015-aggiornamento-automatico) ---

CARTELLA_AGGIORNAMENTO = '_aggiornamento'
REPOSITORY_PREDEFINITO = 'Mattemn97/modellatore-progetti'
FORMATO_REPOSITORY = re.compile(r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')
FORMATO_DIGEST = re.compile(r'^sha256:([0-9a-fA-F]{64})$')
PREFISSO_PACCHETTO = 'ModellatoreMBSE/'
FILE_OBBLIGATORI_PACCHETTO = ('start.exe', 'index.html', 'VERSIONE.txt')
MAX_ZIP_AGGIORNAMENTO = 200 * 1024 * 1024
LUNGHEZZA_MAX_NOTE = 5000
TIMEOUT_CONTROLLO = 5
ATTESA_SALUTE = 60
ATTESA_PORTA = 15
ATTESA_PULIZIA = 60
DURATA_PULIZIA = 30
STATI_AGGIORNAMENTO_IN_CORSO = ('download', 'verifica', 'installazione', 'riavvio')
ERRORI_PORTA_OCCUPATA = (10048, 10013)
MSG_SOLO_EXE = "L'aggiornamento automatico funziona solo con start.exe."

class ErroreAggiornamento(Exception):
    pass

def leggi_impostazioni_aggiornamenti(base_dir):
    # aggiornamenti.controllo e aggiornamenti.repository da settings.json; predefiniti se mancano
    controllo, repository = True, REPOSITORY_PREDEFINITO
    try:
        with open(os.path.join(base_dir, "settings.json"), encoding="utf-8") as f:
            sezione = json.load(f).get("aggiornamenti", {})
        if isinstance(sezione.get("controllo"), bool):
            controllo = sezione["controllo"]
        if "repository" in sezione:
            repository = sezione["repository"]
    except (OSError, ValueError, AttributeError):
        pass
    return controllo, repository

def tupla_versione(testo):
    if not isinstance(testo, str) or not FORMATO_SEMVER.match(testo):
        return None
    return tuple(int(parte) for parte in testo.split('.'))

def con_riprova(funzione, *argomenti, tentativi=5, attesa=0.5):
    # Un file appena scritto può restare bloccato per un attimo (antivirus, indicizzazione)
    for tentativo in range(tentativi):
        try:
            return funzione(*argomenti)
        except OSError:
            if tentativo == tentativi - 1:
                raise
            time.sleep(attesa)

class StatoAggiornamento:
    # Stato del controllo e dell'installazione, letto dal browser con GET /api/aggiornamento
    def __init__(self, base_dir, versione):
        self.base_dir = base_dir
        self.lucchetto = threading.Lock()
        self.dati = {'stato': 'disattivato', 'attuale': versione, 'nuova': None, 'note': '',
                     'pagina': None, 'installabile': False, 'motivo': ''}
        self.url_zip = None
        self.sha256 = None
        self.prefisso_download = None
        self.errore_iniziale = ''

    def pubblico(self):
        with self.lucchetto:
            return dict(self.dati)

    def imposta(self, **valori):
        with self.lucchetto:
            self.dati.update(valori)

    def valore(self, chiave):
        with self.lucchetto:
            return self.dati[chiave]

    def avvia_installazione(self, versione):
        # Una sola installazione alla volta; parte solo dalla versione mostrata nel banner
        with self.lucchetto:
            stato = self.dati['stato']
            if stato in STATI_AGGIORNAMENTO_IN_CORSO:
                raise ErroreApi(409, 'installazione_in_corso', "Un aggiornamento è già in corso.")
            if stato not in ('disponibile', 'errore') or not self.dati['nuova']:
                raise ErroreApi(409, 'aggiornamento_non_disponibile', "Non c'è un aggiornamento da installare.")
            if versione != self.dati['nuova']:
                raise ErroreApi(409, 'versione_diversa', "La versione richiesta non è quella disponibile: ricarica la pagina.")
            if not self.dati['installabile'] or not self.url_zip:
                raise ErroreApi(409, 'non_installabile', self.dati['motivo'] or "Questa versione non si può installare da qui.")
            self.dati.update(stato='download', motivo='')

def motivo_errore_rete(e):
    if isinstance(e, urllib.error.HTTPError):
        if e.code == 403:
            return "GitHub ha rifiutato la richiesta (limite di richieste raggiunto, riprova più tardi)"
        if e.code == 404:
            return "nessuna Release pubblicata"
        return f"GitHub ha risposto con il codice {e.code}"
    if isinstance(e, urllib.error.URLError):
        return f"rete non raggiungibile ({e.reason})"
    if isinstance(e, (TimeoutError, socket.timeout)):
        return "tempo scaduto"
    if isinstance(e, ValueError):
        return "risposta non valida"
    return str(e) or e.__class__.__name__

def controlla_aggiornamenti(stato, repository):
    attuale = stato.valore('attuale')
    url = os.environ.get('MODELLATORE_URL_RELEASE')
    if url:
        # Solo per le prove (spec 0015): server finto delle Release
        parti = urlsplit(url)
        stato.prefisso_download = f"{parti.scheme}://{parti.netloc}/"
    else:
        url = f"https://api.github.com/repos/{repository}/releases/latest"
        stato.prefisso_download = f"https://github.com/{repository}/releases/download/"
    stato.imposta(stato='controllo')
    richiesta = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json',
                                                     'User-Agent': f'ModellatoreMBSE/{attuale}'})
    try:
        with urllib.request.urlopen(richiesta, timeout=TIMEOUT_CONTROLLO) as risposta:
            release = json.loads(risposta.read(5 * 1024 * 1024).decode('utf-8'))
        if not isinstance(release, dict):
            raise ValueError('risposta non valida')
    except Exception as e:
        motivo = motivo_errore_rete(e)
        stato.imposta(stato='errore' if stato.errore_iniziale else 'errore_controllo',
                      motivo=stato.errore_iniziale or motivo)
        stampa_info(f"Controllo aggiornamenti non riuscito: {motivo}")
        return
    tag = str(release.get('tag_name') or '')
    nuova = tag[1:] if tag.startswith('v') else tag
    if tupla_versione(nuova) is None or tupla_versione(nuova) <= tupla_versione(attuale):
        stato.imposta(stato='errore' if stato.errore_iniziale else 'aggiornato', motivo=stato.errore_iniziale)
        return
    nome_zip = f"ModellatoreMBSE-{nuova}.zip"
    asset = next((a for a in release.get('assets') or [] if isinstance(a, dict) and a.get('name') == nome_zip), None)
    digest = FORMATO_DIGEST.match(str(asset.get('digest') or '')) if asset else None
    url_zip = str(asset.get('browser_download_url') or '') if asset else ''
    if not asset:
        installabile, motivo = False, f"La Release non contiene {nome_zip}."
    elif not digest:
        installabile, motivo = False, "La Release non indica l'impronta SHA256 dello zip: aggiorna a mano dalla pagina."
    elif not url_zip.startswith(stato.prefisso_download):
        installabile, motivo = False, "L'indirizzo dello zip non è quello atteso."
    elif not getattr(sys, 'frozen', False):
        installabile, motivo = False, MSG_SOLO_EXE
    else:
        installabile, motivo = True, ''
    stato.url_zip = url_zip if installabile else None
    stato.sha256 = digest.group(1).lower() if digest else None
    pagina = str(release.get('html_url') or '') or None
    stato.imposta(stato='errore' if stato.errore_iniziale else 'disponibile', nuova=nuova,
                  note=str(release.get('body') or '')[:LUNGHEZZA_MAX_NOTE], pagina=pagina,
                  installabile=installabile, motivo=stato.errore_iniziale or motivo)
    stampa_avviso(f"È disponibile la versione {nuova} (hai la {attuale}). Apri l'app per aggiornare: {pagina or ''}".rstrip())

def scarica_zip(url, destinazione, sha256_atteso):
    richiesta = urllib.request.Request(url, headers={'User-Agent': 'ModellatoreMBSE'})
    impronta = hashlib.sha256()
    letti = 0
    with urllib.request.urlopen(richiesta, timeout=30) as risposta, open(destinazione, 'wb') as f:
        while True:
            blocco = risposta.read(1024 * 1024)
            if not blocco:
                break
            letti += len(blocco)
            if letti > MAX_ZIP_AGGIORNAMENTO:
                raise ErroreAggiornamento("Il file scaricato supera 200 MB: aggiornamento annullato.")
            impronta.update(blocco)
            f.write(blocco)
    if impronta.hexdigest() != sha256_atteso:
        raise ErroreAggiornamento("L'impronta del file scaricato non corrisponde: aggiornamento annullato.")

def percorso_vietato(relativo):
    return relativo.split('/')[0] in PERCORSI_UTENTE

def controlla_zip(archivio_zip, nuova):
    # Restituisce le voci (info, percorso relativo) dei file da installare; nessun file viene scritto qui
    voci, totale = [], 0
    for info in archivio_zip.infolist():
        nome = info.filename.replace('\\', '/')
        if not nome.startswith(PREFISSO_PACCHETTO):
            raise ErroreAggiornamento(f"Lo zip contiene una voce fuori da ModellatoreMBSE/: {nome}")
        relativo = nome[len(PREFISSO_PACCHETTO):]
        parti = [p for p in relativo.split('/') if p]
        if not parti:
            continue
        if relativo.startswith('/') or ':' in relativo or '..' in parti:
            raise ErroreAggiornamento(f"Lo zip contiene un percorso non valido: {nome}")
        relativo = '/'.join(parti)
        if percorso_vietato(relativo):
            if info.is_dir() and len(parti) == 1:
                continue
            raise ErroreAggiornamento(f"Lo zip contiene file dell'utente ({relativo}): aggiornamento annullato.")
        if info.is_dir():
            continue
        totale += info.file_size
        voci.append((info, relativo))
    if totale > MAX_DECOMPRESSO:
        raise ErroreAggiornamento("Lo zip decompresso è troppo grande: aggiornamento annullato.")
    presenti = {relativo for _, relativo in voci}
    mancanti = [f for f in FILE_OBBLIGATORI_PACCHETTO if f not in presenti]
    if mancanti:
        raise ErroreAggiornamento(f"Lo zip non contiene {', '.join(mancanti)}: aggiornamento annullato.")
    info_versione = next(info for info, relativo in voci if relativo == 'VERSIONE.txt')
    versione_zip = archivio_zip.read(info_versione).decode('utf-8-sig', 'replace').strip()
    if versione_zip != nuova:
        raise ErroreAggiornamento(f"Lo zip contiene la versione {versione_zip}, non la {nuova}: aggiornamento annullato.")
    return voci

def estrai_voci(archivio_zip, voci, cartella):
    for info, relativo in voci:
        destinazione = os.path.join(cartella, *relativo.split('/'))
        os.makedirs(os.path.dirname(destinazione), exist_ok=True)
        with archivio_zip.open(info) as sorgente, open(destinazione, 'wb') as f:
            shutil.copyfileobj(sorgente, f)

def ripristina_file(fatti, tentativi=5):
    # Rimette le copie di sicurezza e toglie i file nuovi che non avevano una copia, in ordine inverso
    for destinazione, copia in reversed(fatti):
        if copia:
            if os.path.lexists(copia):
                con_riprova(os.replace, copia, destinazione, tentativi=tentativi)
        elif os.path.lexists(destinazione):
            con_riprova(os.remove, destinazione, tentativi=tentativi)

def sostituisci_file(base_dir, cartella_nuova, cartella_copie, relativi):
    # Lista ammessa: solo i file dello zip, start.exe per ultimo; ogni file attuale va prima nelle copie
    ordine = [r for r in relativi if r != 'start.exe'] + [r for r in relativi if r == 'start.exe']
    fatti = []
    relativo = ''
    try:
        for relativo in ordine:
            if percorso_vietato(relativo):
                raise ErroreAggiornamento(f"Percorso dell'utente nell'elenco: {relativo}")
            destinazione = os.path.join(base_dir, *relativo.split('/'))
            nuovo = os.path.join(cartella_nuova, *relativo.split('/'))
            copia = None
            if os.path.lexists(destinazione):
                copia = os.path.join(cartella_copie, *relativo.split('/'))
                os.makedirs(os.path.dirname(copia), exist_ok=True)
                con_riprova(os.replace, destinazione, copia)
            fatti.append((destinazione, copia))
            os.makedirs(os.path.dirname(destinazione), exist_ok=True)
            con_riprova(os.replace, nuovo, destinazione)
    except (OSError, ErroreAggiornamento) as e:
        try:
            ripristina_file(fatti)
        except OSError as e2:
            raise ErroreAggiornamento(f"Impossibile sostituire {relativo} ({e}) e ripristino incompleto ({e2}): "
                                      f"le copie sono in {cartella_copie}.")
        raise ErroreAggiornamento(f"Impossibile sostituire {relativo}: {e}. Ripristinata la versione precedente.")
    return fatti

def opzioni_nuovo_processo(fuori_dal_job=True):
    opzioni = {'close_fds': True, 'env': dict(os.environ, PYINSTALLER_RESET_ENVIRONMENT='1')}
    if os.name == 'nt':
        opzioni['creationflags'] = subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NEW_PROCESS_GROUP
        if fuori_dal_job:
            # Il bootloader dell'exe onefile chiude con sé i processi del suo job: il nuovo exe deve uscirne
            opzioni['creationflags'] |= subprocess.CREATE_BREAKAWAY_FROM_JOB
    return opzioni

def avvia_processo(argomenti, base_dir):
    try:
        return subprocess.Popen(argomenti, cwd=base_dir, **opzioni_nuovo_processo())
    except OSError:
        # Job che non permette di uscire: si avvia comunque, dentro il job
        return subprocess.Popen(argomenti, cwd=base_dir, **opzioni_nuovo_processo(fuori_dal_job=False))

def risponde_con_versione(versione):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/aggiornamento", timeout=1) as risposta:
            return json.loads(risposta.read().decode('utf-8')).get('attuale') == versione
    except Exception:
        return False

def termina_albero(processo):
    # L'exe onefile ha un processo padre e un figlio Python: si termina tutto l'albero
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(processo.pid), '/T', '/F'], capture_output=True)
    else:
        processo.kill()
    try:
        processo.wait(timeout=10)
    except subprocess.TimeoutExpired:
        pass

def riavvia_dopo_installazione(server, base_dir, vecchia, nuova, fatti):
    # Libera la porta, avvia la versione nuova e aspetta che risponda; se non parte rimette la vecchia
    server.shutdown()
    server.server_close()
    exe = sys.executable
    stampa_info(f"Avvio della versione {nuova}...")
    try:
        processo = avvia_processo([exe, '--dopo-aggiornamento', vecchia], base_dir)
    except OSError as e:
        processo = None
        stampa_errore(f"Impossibile avviare la versione nuova: {e}")
    scadenza = time.monotonic() + ATTESA_SALUTE
    while processo is not None and time.monotonic() < scadenza:
        if processo.poll() is not None:
            break
        if risponde_con_versione(nuova):
            os._exit(0)
        time.sleep(0.5)
    if processo is not None:
        termina_albero(processo)
    stampa_errore(f"La versione {nuova} non è partita: ripristino della versione {vecchia}.")
    try:
        ripristina_file(fatti, tentativi=20)
        avvia_processo([exe, '--dopo-ripristino', nuova], base_dir)
    except OSError as e:
        stampa_errore(f"Ripristino non riuscito ({e}): le copie sono in {os.path.join(base_dir, CARTELLA_AGGIORNAMENTO, 'backup')}. "
                      "Estrai a mano lo zip della versione che vuoi usare.")
        time.sleep(30)
    os._exit(0)

def installa_aggiornamento(stato, server, base_dir):
    vecchia, nuova = stato.valore('attuale'), stato.valore('nuova')
    cartella = os.path.join(base_dir, CARTELLA_AGGIORNAMENTO)
    try:
        shutil.rmtree(cartella, ignore_errors=True)
        os.makedirs(cartella, exist_ok=True)
        stampa_info(f"Scaricamento della versione {nuova}...")
        file_zip = os.path.join(cartella, 'download.zip')
        scarica_zip(stato.url_zip, file_zip, stato.sha256)
        stato.imposta(stato='verifica')
        cartella_nuova = os.path.join(cartella, 'nuova')
        with zipfile.ZipFile(file_zip) as archivio_zip:
            voci = controlla_zip(archivio_zip, nuova)
            estrai_voci(archivio_zip, voci, cartella_nuova)
        stato.imposta(stato='installazione')
        fatti = sostituisci_file(base_dir, cartella_nuova, os.path.join(cartella, 'backup'),
                                 [relativo for _, relativo in voci])
    except ErroreAggiornamento as e:
        stato.imposta(stato='errore', motivo=str(e))
        stampa_errore(str(e))
        return
    except Exception as e:
        motivo = f"Aggiornamento non riuscito: {motivo_errore_rete(e) if isinstance(e, (urllib.error.URLError, socket.timeout, TimeoutError)) else e}"
        stato.imposta(stato='errore', motivo=motivo)
        stampa_errore(motivo)
        return
    stato.imposta(stato='riavvio')
    stampa_info(f"Versione {nuova} installata, riavvio...")
    riavvia_dopo_installazione(server, base_dir, vecchia, nuova, fatti)

def pulisci_cartella_aggiornamento(stato, base_dir):
    # Dopo un minuto dall'avvio, se nessun aggiornamento è in corso, toglie _aggiornamento/
    time.sleep(ATTESA_PULIZIA)
    cartella = os.path.join(base_dir, CARTELLA_AGGIORNAMENTO)
    scadenza = time.monotonic() + DURATA_PULIZIA
    while os.path.exists(cartella) and time.monotonic() < scadenza:
        if stato.valore('stato') in STATI_AGGIORNAMENTO_IN_CORSO:
            return
        shutil.rmtree(cartella, ignore_errors=True)
        if os.path.exists(cartella):
            time.sleep(2)

def argomento(nome):
    if nome in sys.argv:
        indice = sys.argv.index(nome)
        if indice + 1 < len(sys.argv):
            return sys.argv[indice + 1]
    return None

class ServerApp(ThreadingHTTPServer):
    # Porta esclusiva: su Windows SO_REUSEADDR lascerebbe aprire la stessa porta a due server insieme
    allow_reuse_address = os.name != 'nt'

    def server_bind(self):
        if os.name == 'nt' and hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

def porta_occupata(e):
    return e.errno == errno.EADDRINUSE or getattr(e, 'winerror', None) in ERRORI_PORTA_OCCUPATA

def crea_server(riprova):
    # Dopo un aggiornamento la porta può restare occupata qualche istante dal processo vecchio
    scadenza = time.monotonic() + (ATTESA_PORTA if riprova else 0)
    while True:
        try:
            return ServerApp(('127.0.0.1', PORT), CustomHandler)
        except OSError as e:
            if not porta_occupata(e):
                raise
            if time.monotonic() >= scadenza:
                stampa_errore(f"La porta {PORT} è occupata: chiudi le altre finestre nere e avvia di nuovo start.exe.")
                if not riprova:
                    time.sleep(5)
                sys.exit(1)
            time.sleep(0.5)

def open_browser(port):
    time.sleep(1.0)
    webbrowser.open(f"http://localhost:{port}")

def main():
    global PORT
    # App desktop v2 (spec 0016): start.py serve solo le API, su una porta scelta dal processo principale
    solo_api = '--solo-api' in sys.argv
    porta = argomento('--porta')
    if porta is not None:
        try:
            PORT = int(porta)
        except ValueError:
            stampa_errore(f"Porta non valida: {porta}")
            sys.exit(2)
    base_dir = get_base_dir()
    os.chdir(base_dir)

    # Prima di ogni lettura delle impostazioni
    prepara_impostazioni(base_dir)
    ensure_shared_library(base_dir)

    archivio = ArchivioProgetti(base_dir, leggi_max_versioni(base_dir, "progetti"))
    archivio.prepara()
    CustomHandler.archivio = archivio

    librerie = ArchivioLibrerie(base_dir, leggi_max_versioni(base_dir, "libreria"))
    librerie.prepara()
    CustomHandler.librerie = librerie
    CustomHandler.max_file_cliente_mb = leggi_max_file_cliente(base_dir)

    versione = leggi_versione(base_dir)
    dopo_aggiornamento = argomento('--dopo-aggiornamento')
    dopo_ripristino = argomento('--dopo-ripristino')
    aggiornamento = StatoAggiornamento(base_dir, versione)
    CustomHandler.aggiornamento = aggiornamento

    # Multithread: il server a thread singolo si blocca sui socket che Chrome lascia aperti;
    # le operazioni su progetti/ restano una alla volta grazie al lucchetto dell'archivio
    httpd = crea_server(riprova=bool(dopo_aggiornamento or dopo_ripristino))

    stampa_avvio(versione, f"http://localhost:{PORT}", base_dir,
                 archivio.cartella, os.path.join(base_dir, "shared"))

    if dopo_aggiornamento:
        stampa_info(f"Aggiornamento dalla versione {dopo_aggiornamento} completato.")
    elif dopo_ripristino:
        aggiornamento.errore_iniziale = f"La versione {dopo_ripristino} non è partita: ripristinata la versione precedente."
        aggiornamento.imposta(stato='errore', motivo=aggiornamento.errore_iniziale)
        stampa_avviso(aggiornamento.errore_iniziale)
    # Dopo un aggiornamento la pagina già aperta si ricarica da sola: niente scheda nuova
    if not (dopo_aggiornamento or dopo_ripristino or solo_api):
        threading.Thread(target=open_browser, args=(PORT,), daemon=True).start()

    controllo, repository = leggi_impostazioni_aggiornamenti(base_dir)
    if solo_api:
        aggiornamento.imposta(motivo="App desktop in sviluppo: nessun controllo degli aggiornamenti.")
    elif not controllo:
        aggiornamento.imposta(motivo="Controllo degli aggiornamenti spento in settings.json (aggiornamenti.controllo).")
    elif not isinstance(repository, str) or not FORMATO_REPOSITORY.match(repository):
        aggiornamento.imposta(motivo="aggiornamenti.repository in settings.json non è nella forma proprietario/nome.")
    elif tupla_versione(versione) is None:
        aggiornamento.imposta(motivo=f"Versione di sviluppo ({versione}): nessun controllo degli aggiornamenti.")
    else:
        threading.Thread(target=controlla_aggiornamenti, args=(aggiornamento, repository), daemon=True).start()
    if dopo_ripristino:
        # Lo stato resta errore anche se il controllo è spento o la versione è di sviluppo
        aggiornamento.imposta(stato='errore', motivo=aggiornamento.errore_iniziale)
    threading.Thread(target=pulisci_cartella_aggiornamento, args=(aggiornamento, base_dir), daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        stampa_info("Arresto del server in corso...")
        httpd.server_close()

if __name__ == '__main__':
    main()
