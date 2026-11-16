"""Writes the test files for Region Leaderboard: python generator.py
Expected outputs come from running solutions/query.sql through the judge's SQL runner."""
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'judge-runners'))
from sql_runner import run_query  # noqa: E402

QUERY = (HERE / 'solutions' / 'query.sql').read_text(encoding='utf-8')
SCHEMA = """CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  region TEXT NOT NULL,
  rep TEXT NOT NULL,
  amount INTEGER NOT NULL,
  sold_on TEXT NOT NULL
);
"""
REGIONS = ['North', 'South', 'East', 'West', 'Central', 'north']
REPS = ['Ana', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gil', 'Hal', 'Ivy', 'Jon', 'Kim', 'Lou', 'Max', 'Nia', 'Oz', 'Pia']


def sql(value):
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return repr(value)


def inserts(rows):
    out = ''
    for start in range(0, len(rows), 200):
        chunk = rows[start:start + 200]
        out += 'INSERT INTO sales VALUES\n' + ',\n'.join('  (' + ', '.join(sql(v) for v in row) + ')' for row in chunk) + ';\n'
    return out


def write(index, sales):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    rows = [(i, region, rep, amount, (date(2025, 1, 1) + timedelta(days=i % 365)).isoformat()) for i, (region, rep, amount) in enumerate(sales, 1)]
    setup = SCHEMA + inserts(rows)
    (tests / f'input{index:02d}.txt').write_text(setup, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(run_query(setup, QUERY), encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def random_case(rng, n, regions, reps, tie_heavy=False):
    sales = []
    for _ in range(n):
        amount = rng.choice([100, 200, 500, 1000]) if tie_heavy else rng.randint(1, 50000)
        sales.append((rng.choice(regions), rng.choice(reps), amount))
    return sales


rng = random.Random(2026)
write(0, [('North', 'Ana', 500), ('North', 'Ben', 700), ('North', 'Ana', 400), ('North', 'Cleo', 300),
          ('South', 'Dev', 500), ('South', 'Eli', 200), ('South', 'Eli', 300), ('South', 'Fay', 400)])
write(1, [('East', 'Ana', 900), ('West', 'Ana', 100), ('West', 'Gil', 50), ('West', 'Hal', 30), ('West', 'Hal', 20), ('West', 'Ivy', 40), ('East', 'Jon', 800)])
write(2, [])
write(3, [('North', 'Solo', 42)])
write(4, [('South', name, 250) for name in REPS[:6]] + [('North', 'Ana', 10), ('north', 'Ana', 99)])
write(5, random_case(rng, 600, REGIONS[:4], REPS[:8], tie_heavy=True))
write(6, random_case(rng, 16000, REGIONS, REPS))
write(7, random_case(rng, 18000, REGIONS, REPS + [f'Rep{i}' for i in range(60)], tie_heavy=True))
sync_samples(2)
print('wrote 8 tests')
