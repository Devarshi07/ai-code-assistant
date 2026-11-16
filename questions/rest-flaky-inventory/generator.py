"""Writes the test files for Flaky Inventory API: python generator.py
Each input is the category, the '--- api data ---' marker, then the records the
judge's mock API serves with "throttle": "first" (see judge-runners/rest_harness.py)."""
import json
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
MARKER = '--- api data ---'
CATEGORIES = ['drills', 'saws', 'power tools', 'paint', 'Drills']
WAREHOUSES = ['LIS-1', 'OPO-2', 'FAO-3', 'BRG-1', 'AVR-4', 'lis-1', 'MAD-7', 'VAL-2']


def api_text(fixture):
    head = ''.join(f'  {json.dumps(k)}: {json.dumps(v)},\n' for k, v in fixture.items() if k != 'resources')
    blocks = []
    for name, records in fixture['resources'].items():
        rows = ',\n'.join('      ' + json.dumps(r, ensure_ascii=False) for r in records)
        blocks.append(f'    {json.dumps(name)}: [\n{rows}\n    ]' if records else f'    {json.dumps(name)}: []')
    return '{\n' + head + '  "resources": {\n' + ',\n'.join(blocks) + '\n  }\n}\n'


def write(index, category, per_page, stock):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    records = [{'sku': f'SKU-{i:04d}', 'category': c, 'warehouse': w, 'quantity': q} for i, (c, w, q) in enumerate(stock, 1)]
    text = f'{category}\n{MARKER}\n' + api_text({'per_page': per_page, 'throttle': 'first', 'resources': {'stock': records}})
    totals = {}
    for r in records:
        if r['category'] == category:
            totals[r['warehouse']] = totals.get(r['warehouse'], 0) + r['quantity']
    lines = [f'{w} {t}' for w, t in sorted(((w, t) for w, t in totals.items() if t > 0), key=lambda p: (-p[1], p[0]))]
    (tests / f'input{index:02d}.txt').write_text(text, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(('\n'.join(lines) if lines else 'NONE') + '\n', encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def random_stock(rng, n, focus, small=False):
    return [(focus if rng.random() < 0.5 else rng.choice(CATEGORIES), rng.choice(WAREHOUSES), rng.randint(-5, 10) if small else rng.randint(-500, 500)) for _ in range(n)]


rng = random.Random(2026)
write(0, 'drills', 3, [('drills', 'LIS-1', 12), ('drills', 'OPO-2', 20), ('saws', 'FAO-3', 7), ('drills', 'LIS-1', 30), ('drills', 'OPO-2', -5)])
write(1, 'paint', 2, [('paint', 'LIS-1', 10), ('paint', 'OPO-2', 6), ('paint', 'BRG-1', 4), ('paint', 'OPO-2', -10), ('paint', 'BRG-1', 6)])
write(2, 'saws', 4, [('drills', 'LIS-1', 9)])
write(3, 'power tools', 5, [('power tools', 'MAD-7', -3), ('power tools', 'MAD-7', 3), ('power tools', 'VAL-2', -1)])
write(4, 'Drills', 1, [('Drills', 'lis-1', 5), ('drills', 'LIS-1', 50), ('Drills', 'LIS-1', 5), ('Drills', 'AVR-4', 7)])
write(5, 'drills', 3, random_stock(rng, 120, 'drills', small=True))
write(6, 'power tools', 10, random_stock(rng, 1000, 'power tools'))
write(7, 'saws', 7, random_stock(rng, 900, 'saws', small=True))
sync_samples(2)
print('wrote 8 tests')
