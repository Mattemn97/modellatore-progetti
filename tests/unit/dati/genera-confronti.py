# Genera tests/unit/dati/confronti.json: casi di confronto dei blocchi con il risultato di start.py (oracolo).
# Da rilanciare solo se cambiano le regole del confronto in start.py: python tests/unit/dati/genera-confronti.py
import copy, json, os, random, sys
QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, '..', '..', '..'))
import start

random.seed(498)
TIPOLOGIE = ['Elettrica', 'Segnale', None]

def requisito(i):
    r = {'id': f'r{i}', 'titolo': f'T{i}', 'tipologia': random.choice(TIPOLOGIE), 'metodoVerifica': 'Test',
         'testiExport': [{'testo': f'x{i}', 'documento': 'IRS'}]}
    if random.random() < 0.2:
        r['nota'] = None
    return r

def blocco(n):
    return {'id': 'b', 'titolo': 'Blocco', 'descrizione': 'd', 'categoria': 'c', 'sottocategoria': 's',
            'requisiti': [requisito(i) for i in range(n)]}

def muta(b):
    d = copy.deepcopy(b)
    rinomine = {}
    for _ in range(random.randint(0, 4)):
        azione = random.choice(['titolo', 'campo', 'togli_campo', 'nullo', 'agg', 'rim', 'rin', 'scambio', 'ordine', 'tip', 'testo'])
        reqs = d['requisiti']
        if azione == 'titolo':
            d['titolo'] = random.choice(['Nuovo', '  ', 'Blocco'])
        elif azione == 'campo':
            d['extra'] = random.choice([1, 'a', None, [1]])
        elif azione == 'togli_campo':
            d.pop('descrizione', None)
        elif azione == 'nullo' and reqs:
            random.choice(reqs).pop('nota', None) if random.random() < 0.5 else random.choice(reqs).__setitem__('nota', None)
        elif azione == 'agg':
            reqs.append(requisito(random.randint(10, 20)))
        elif azione == 'rim' and reqs:
            reqs.pop(random.randrange(len(reqs)))
        elif azione == 'rin' and reqs:
            r = random.choice(reqs)
            if r['id'] in [v for v in rinomine.values()] or r['id'] in rinomine:
                continue
            nuovo = r['id'] + 'n'
            if any(x['id'] == nuovo for x in reqs):
                continue
            origine = next((k for k, v in rinomine.items() if v == r['id']), r['id'])
            rinomine[origine] = nuovo
            r['id'] = nuovo
        elif azione == 'scambio' and len(reqs) >= 2 and not rinomine:
            x, y = reqs[0], reqs[1]
            if x['id'] in ('r0', 'r1') and y['id'] in ('r0', 'r1'):
                rinomine[x['id']] = y['id']; rinomine[y['id']] = x['id']
                x['id'], y['id'] = y['id'], x['id']
        elif azione == 'ordine' and len(reqs) >= 2:
            random.shuffle(reqs)
        elif azione == 'tip' and reqs:
            random.choice(reqs)['tipologia'] = random.choice(TIPOLOGIE)
        elif azione == 'testo' and reqs:
            random.choice(reqs)['testiExport'].append({'testo': 'y', 'documento': 'SSS'})
    # Rinomine valide: solo id che c'erano prima e che ci sono dopo
    ids_prima = {r['id'] for r in b['requisiti']}
    ids_dopo = {r['id'] for r in d['requisiti']}
    rinomine = {k: v for k, v in rinomine.items() if k in ids_prima and v in ids_dopo and k != v}
    return d, rinomine

casi = []
for _ in range(400):
    prima = blocco(random.randint(0, 4))
    dopo, rinomine = muta(prima)
    modifica = start.confronta_blocco('b', prima, dopo, rinomine)
    casi.append({'prima': prima, 'dopo': dopo, 'rinomine': rinomine, 'modifica': modifica,
                 'livello': start.livello_di([modifica]) if modifica else None})
# Casi limite
for prima, dopo in [(None, blocco(2)), (blocco(2), None), (None, None), ('x', blocco(1)), (blocco(1), blocco(1))]:
    m = start.confronta_blocco('b', prima, dopo)
    casi.append({'prima': prima, 'dopo': dopo, 'rinomine': {}, 'modifica': m, 'livello': start.livello_di([m]) if m else None})
with open(os.path.join(QUI, 'confronti.json'), 'w', encoding='utf-8') as f:
    json.dump(casi, f, ensure_ascii=False)
print(len(casi), 'casi;', sum(1 for c in casi if c['modifica']), 'con modifiche;',
      sum(1 for c in casi if c['rinomine']), 'con rinomine')
