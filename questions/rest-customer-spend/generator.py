"""Writes the test files for Customer Spend: python generator.py
Each input is the customer's name, the '--- api data ---' marker, then the
orders the judge's mock API serves (see judge-runners/rest_harness.py)."""
import json
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
MARKER = '--- api data ---'
NAMES = ['Ana Lima', 'Rui Gomes', 'Marta Sousa', "Zoë O'Neil", 'Li Wei', 'Omar Haddad', 'Sara Kim', 'Ivan Petrov', 'Ana Limas', 'ana lima']


def api_text(fixture):
    head = ''.join(f'  {json.dumps(k)}: {json.dumps(v)},\n' for k, v in fixture.items() if k != 'resources')
    blocks = []
    for name, records in fixture['resources'].items():
        rows = ',\n'.join('      ' + json.dumps(r, ensure_ascii=False) for r in records)
        blocks.append(f'    {json.dumps(name)}: [\n{rows}\n    ]' if records else f'    {json.dumps(name)}: []')
    return '{\n' + head + '  "resources": {\n' + ',\n'.join(blocks) + '\n  }\n}\n'


def write(index, customer, per_page, orders):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    records = [{'id': i, 'customer': c, 'amount': a, 'status': s} for i, (c, a, s) in enumerate(orders, 1)]
    text = f'{customer}\n{MARKER}\n' + api_text({'per_page': per_page, 'resources': {'orders': records}})
    answer = sum(r['amount'] for r in records if r['customer'] == customer and r['status'] == 'paid')
    (tests / f'input{index:02d}.txt').write_text(text, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(f'{answer}\n', encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def random_orders(rng, n, target, share):
    return [(target if rng.random() < share else rng.choice(NAMES), rng.randint(1, 10**4), rng.choice(['paid', 'paid', 'refunded', 'pending'])) for _ in range(n)]


rng = random.Random(2026)
write(0, 'Ana Lima', 3, [('Ana Lima', 120, 'paid'), ('Rui Gomes', 999, 'paid'), ('Ana Lima', 40, 'refunded'), ('Ana Lima', 80, 'paid'), ('Marta Sousa', 60, 'paid'), ('Ana Lima', 15, 'pending')])
write(1, "Zoë O'Neil", 2, [("Zoë O'Neil", 30, 'paid'), ("Zoë O'Neil", 10, 'refunded'), ('Li Wei', 70, 'paid'), ("Zoë O'Neil", 45, 'paid'), ("Zoë O'Neil", 20, 'pending'), ("Zoë O'Neil", 5, 'paid')])
write(2, 'Sara Kim', 5, [('Ana Lima', 50, 'paid'), ('Rui Gomes', 25, 'paid')])
write(3, 'Li Wei', 10, [('Li Wei', 7, 'paid'), ('Li Wei', 3, 'paid'), ('Ana Lima', 1000, 'paid'), ('li wei', 500, 'paid')])
write(4, 'Omar Haddad', 4, [('Omar Haddad', 100 + i, 'refunded' if i % 2 else 'pending') for i in range(9)] + [('Ana Lima', 5, 'paid')])
write(5, 'Ana Lima', 1, random_orders(rng, 40, 'Ana Lima', 0.6))
write(6, 'Marta Sousa', 10, random_orders(rng, 2000, 'Marta Sousa', 0.15))
write(7, "Zoë O'Neil", 7, random_orders(rng, 2000, "Zoë O'Neil", 0.25))
sync_samples(2)
print('wrote 8 tests')
