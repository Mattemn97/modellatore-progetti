import os
import sys
import time
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8080

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

def open_browser(port):
    time.sleep(1.0)
    webbrowser.open(f"http://localhost:{port}")

def main():
    base_dir = get_base_dir()
    os.chdir(base_dir)
    
    ensure_shared_library(base_dir)

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

    httpd = HTTPServer(('127.0.0.1', PORT), CustomHandler)

    print("=" * 55)
    print(f" Modellatore MBSE Server - Attivo")
    print(f" Percorso di lavoro: {base_dir}")
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