import os
import re
import sys
import json
import time
import hashlib
import threading
import webbrowser
from datetime import datetime
from urllib.parse import urlsplit, unquote
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8080

# Limiti e formati dell'API dei progetti (vedi docs/specs/0001-salvataggio-automatico-progetto)
MAX_CORPO = 50 * 1024 * 1024
LUNGHEZZA_MAX_SLUG = 80
FORMATO_SLUG = re.compile(r'^[a-z0-9]+(_[a-z0-9]+)*$')
NOMI_RISERVATI = {'con', 'prn', 'aux', 'nul'} | {f'com{i}' for i in range(1, 10)} | {f'lpt{i}' for i in range(1, 10)}
VERSIONI_PREDEFINITE = 3
TENTATIVI_FILE_BLOCCATO = 5
ATTESA_FILE_BLOCCATO = 0.05

MSG_SLUG_NON_VALIDO = "Il nome deve contenere almeno una lettera o cifra e non può essere un nome riservato di Windows"
MSG_FILE_BLOCCATO = "Il file è bloccato da un altro programma, ad esempio OneDrive, un antivirus o un editor"

def get_base_dir():
    # Gestisce sia l'esecuzione da script che da file .exe compilato con PyInstaller
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

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

def leggi_max_versioni(base_dir):
    # progetti.versioni da settings.json: intero, minimo 1; predefinito se manca o non è valido
    try:
        with open(os.path.join(base_dir, "settings.json"), encoding="utf-8") as f:
            valore = json.load(f).get("progetti", {}).get("versioni")
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
              and type(progetto.get('formatVersion')) is int and progetto['formatVersion'] == 1)
    if not valido:
        raise ErroreApi(400, 'progetto_non_valido',
                        "Il progetto non ha la forma attesa: formatVersion 1, nome, libraryPath e workspace con nodes ed edges.")

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
        return os.path.join(self.cartella_versioni, f"{slug}.{n}.json")

    def numeri_versioni(self, slug):
        formato = re.compile(rf'^{re.escape(slug)}\.(\d+)\.json$')
        numeri = []
        for nome in os.listdir(self.cartella_versioni):
            trovato = formato.match(nome)
            if trovato:
                numeri.append(int(trovato.group(1)))
        return numeri

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
        # .1 uguale al file attuale: la rotazione l'ha già fatta un tentativo fallito (file bloccato).
        # Ripeterla riempirebbe le versioni di doppioni e cancellerebbe la storia di Annulla
        if os.path.exists(self.versione(slug, 1)) and leggi_bytes(self.versione(slug, 1)) == attuali:
            return
        # Le versioni oltre il limite (anche se il limite è sceso) spariscono, poi .1→.2→.3
        for n in self.numeri_versioni(slug):
            if n >= self.max_versioni:
                con_ritentativi(lambda n=n: rimuovi_se_esiste(self.versione(slug, n)))
        for n in range(self.max_versioni - 1, 0, -1):
            if os.path.exists(self.versione(slug, n)):
                con_ritentativi(lambda n=n: os.replace(self.versione(slug, n), self.versione(slug, n + 1)))
        scrivi_atomico(self.versione(slug, 1), attuali)

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
        # Si ripristina solo il modello: nome e percorso della libreria restano quelli attuali
        progetto = {
            'formatVersion': 1,
            'nome': attuale['nome'] if isinstance(attuale.get('nome'), str) else slug,
            'libraryPath': attuale['libraryPath'] if isinstance(attuale.get('libraryPath'), str) else '',
            'workspace': workspace,
        }
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
        progetto = {
            'formatVersion': 1,
            'nome': nome,
            'libraryPath': attuale['libraryPath'] if isinstance(attuale.get('libraryPath'), str) else '',
            'workspace': attuale.get('workspace'),
        }
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
            corpo = self.leggi_corpo() if metodo in ('POST', 'PUT') else {}
            with self.archivio.lucchetto:
                stato, risposta = self.instrada(metodo, segmenti, corpo)
            self.invia_json(stato, risposta)
        except ErroreApi as e:
            self.invia_json(e.stato, {'errore': e.codice, 'messaggio': e.messaggio, **e.extra})
        except Exception as e:
            self.log_error('Errore interno su %s %s: %r', metodo, self.path, e)
            self.invia_json(500, {'errore': 'errore_interno', 'messaggio': f'Errore interno del server: {e}'})

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

def open_browser(port):
    time.sleep(1.0)
    webbrowser.open(f"http://localhost:{port}")

def main():
    base_dir = get_base_dir()
    os.chdir(base_dir)

    ensure_shared_library(base_dir)

    archivio = ArchivioProgetti(base_dir, leggi_max_versioni(base_dir))
    archivio.prepara()
    CustomHandler.archivio = archivio

    # Multithread: il server a thread singolo si blocca sui socket che Chrome lascia aperti;
    # le operazioni su progetti/ restano una alla volta grazie al lucchetto dell'archivio
    httpd = ThreadingHTTPServer(('127.0.0.1', PORT), CustomHandler)

    print("=" * 55)
    print(f" Modellatore MBSE Server - Attivo")
    print(f" Percorso di lavoro: {base_dir}")
    print(f" Progetti salvati in: {archivio.cartella}")
    print(f" URL Locale: http://localhost:{PORT}")
    print(" Chiudi questa finestra per fermare il server.")
    print("=" * 55)

    threading.Thread(target=open_browser, args=(PORT,), daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArresto del server in corso...")
        httpd.server_close()

if __name__ == '__main__':
    main()
