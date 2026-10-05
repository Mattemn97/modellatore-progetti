# Genera tests/unit/dati/csv.json: file CSV realistici con il risultato di leggi_file_cliente di start.py (oracolo).
# Da rilanciare solo se cambiano le regole di lettura in start.py: python tests/unit/dati/genera-csv.py
import base64, json, os, random, sys
QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, '..', '..', '..'))
import start

random.seed(3)
PAROLE = ["dell'unità", "'citazione'", ' spazio', "l'efficienza ; 'x'", 'Il sistema', 'deve', 'pesare', 'meno di 10 kg', 'funzionare a 24V', 'Città', 'perché', 'ok', '', '42', '3,5', 'a;b', 'virgolette "doppie"', 'riga\nnuova']

def campo(sep):
    testo = ' '.join(random.choice(PAROLE) for _ in range(random.randint(0, 3)))
    if any(c in testo for c in (sep, '"', '\n')) or random.random() < 0.15:
        return '"' + testo.replace('"', '""') + '"'
    return testo

casi = []
for _ in range(500):
    sep = random.choice([';', ',', '\t'])
    colonne = random.randint(1, 5)
    righe = [sep.join(['ID', 'Testo', 'Note', 'Sez', 'Tip'][:colonne])]
    for i in range(random.randint(0, 12)):
        if random.random() < 0.1:
            righe.append('')
        else:
            righe.append(sep.join([f'R{i}'] + [campo(sep) for _ in range(colonne - 1)]))
    fine = random.choice(['\n', '\r\n'])
    testo = fine.join(righe) + random.choice(['', fine, fine + fine])
    codifica = random.choice(['utf-8', 'utf-8-sig', 'cp1252'])
    try:
        dati = testo.encode(codifica)
    except UnicodeEncodeError:
        dati = testo.encode('utf-8')
    contenuto = base64.b64encode(dati).decode()
    try:
        atteso = {'esito': start.leggi_file_cliente({'nomeFile': 'clienti.csv', 'contenuto': contenuto}, 20)}
    except start.ErroreApi as e:
        atteso = {'errore': e.codice}
    casi.append({'contenuto': contenuto, 'atteso': atteso})
with open(os.path.join(QUI, 'csv.json'), 'w', encoding='utf-8') as f:
    json.dump(casi, f, ensure_ascii=False)
print(len(casi), 'casi;', sum(1 for c in casi if 'errore' in c['atteso']), 'con errore')
