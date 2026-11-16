"""Writes the test files for Delivered Orders in Porto: python generator.py
Expected outputs come from running solutions/query.sql through the judge's SQL runner."""
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'judge-runners'))
from sql_runner import run_query  # noqa: E402

QUERY = (HERE / 'solutions' / 'query.sql').read_text(encoding='utf-8')
SCHEMA = """CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total REAL NOT NULL,
  status TEXT NOT NULL
);
"""
FIRST = ['Ana', 'Rui', 'Marta', 'Joao', 'Ines', 'Tiago', 'Sofia', 'Pedro', 'Beatriz', 'Nuno', 'Carla', 'Diogo']
LAST = ['Costa', 'Silva', 'Ferreira', 'Santos', 'Pereira', "O'Neill", 'Almeida', 'Ribeiro', 'Carvalho', 'Lopes']
CITIES = ['Porto', 'Lisbon', 'Braga', 'Coimbra', 'Faro', 'porto']


def sql(value):
    if value is None:
        return 'NULL'
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return repr(value)


def inserts(table, rows):
    out = ''
    for start in range(0, len(rows), 200):
        chunk = rows[start:start + 200]
        out += f'INSERT INTO {table} VALUES\n' + ',\n'.join('  (' + ', '.join(sql(v) for v in row) + ')' for row in chunk) + ';\n'
    return out


def write(index, customers, orders):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    setup = SCHEMA + inserts('customers', customers) + inserts('orders', orders)
    (tests / f'input{index:02d}.txt').write_text(setup, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(run_query(setup, QUERY), encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def random_case(rng, n_customers, n_orders):
    customers = [(i, f'{rng.choice(FIRST)} {rng.choice(LAST)}', rng.choice(CITIES)) for i in range(1, n_customers + 1)]
    orders = []
    for i in range(1, n_orders + 1):
        total = rng.choice([25.0, 24.99, round(rng.uniform(5, 90), 2), float(rng.randint(10, 60))])
        orders.append((i, rng.randint(1, n_customers), total, rng.choice(['delivered', 'delivered', 'pending', 'cancelled'])))
    return customers, orders


rng = random.Random(2026)
write(0, [(1, 'Ana Costa', 'Porto'), (2, 'Rui Silva', 'Porto'), (3, 'Marta Lopes', 'Lisbon')],
      [(1, 1, 42.5, 'delivered'), (2, 2, 12.0, 'pending'), (3, 2, 60.0, 'cancelled'), (4, 2, 31.0, 'delivered'), (5, 1, 19.99, 'delivered'), (6, 3, 80.0, 'delivered')])
write(1, [(1, 'Ines Santos', 'Porto'), (2, 'Tiago Almeida', 'porto'), (3, 'Sofia Pereira', 'Porto')],
      [(7, 1, 30.0, 'delivered'), (8, 3, 25.0, 'delivered'), (9, 3, 30.0, 'delivered'), (10, 2, 99.0, 'delivered'), (11, 1, 24.99, 'delivered')])
write(2, [], [])
write(3, [(1, 'Nuno Ribeiro', 'Lisbon'), (2, 'Carla Lopes', 'Braga')], [(1, 1, 50.0, 'delivered'), (2, 2, 70.0, 'delivered')])
write(4, [(1, "Pedro O'Neill", 'Porto')], [(i, 1, 25.0, 'delivered') for i in range(1, 6)] + [(6, 1, 25.0, 'pending')])
write(5, *random_case(rng, 40, 300))
write(6, *random_case(rng, 1500, 15000))
write(7, *random_case(rng, 2000, 20000))
sync_samples(2)
print('wrote 8 tests')
