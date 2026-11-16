"""Writes the test files for Busy Instructors: python generator.py
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
UNORDERED = True
SCHEMA = """CREATE TABLE instructors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE classes (
  id INTEGER PRIMARY KEY,
  instructor_id INTEGER NOT NULL REFERENCES instructors(id),
  held_on TEXT NOT NULL,
  attendees INTEGER NOT NULL
);
"""
NAMES = ['Lea', 'Omar', 'Kai', 'Sam', 'Noor', 'Ivo', 'Mei', 'Tom', 'Ada', 'Raj', 'Eva', 'Luca']


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


def write(index, instructors, classes):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    setup = SCHEMA + inserts('instructors', instructors) + inserts('classes', classes)
    (tests / f'input{index:02d}.txt').write_text(setup, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(run_query(setup, QUERY, UNORDERED), encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def day(rng):
    return (date(2024, 10, 1) + timedelta(days=rng.randint(0, 520))).isoformat()


def random_case(rng, n_instructors, n_classes, shared_names=True):
    pool = NAMES if shared_names else [f'{n} {i}' for i, n in enumerate(NAMES * 50)]
    instructors = [(i, rng.choice(pool)) for i in range(1, n_instructors + 1)]
    taste = {i: rng.randint(6, 18) for i, _ in instructors}
    classes = []
    for c in range(1, n_classes + 1):
        who = rng.randint(1, n_instructors)
        classes.append((c, who, rng.choice([day(rng), '2025-01-01', '2025-12-31', '2024-12-31', '2026-01-01']), max(0, min(40, taste[who] + rng.randint(-6, 6)))))
    return instructors, classes


rng = random.Random(2026)
write(0, [(1, 'Lea'), (2, 'Omar'), (3, 'Kai')],
      [(1, 1, '2025-02-03', 12), (2, 1, '2025-03-10', 15), (3, 1, '2025-11-30', 10), (4, 2, '2025-01-15', 11), (5, 2, '2025-04-01', 11),
       (6, 2, '2025-06-21', 11), (7, 3, '2024-12-30', 30), (8, 3, '2025-05-05', 20), (9, 3, '2025-05-12', 18)])
write(1, [(1, 'Sam'), (2, 'Sam')],
      [(1, 1, '2025-03-01', 14), (2, 1, '2025-03-08', 12), (3, 1, '2025-03-15', 13), (4, 2, '2025-03-02', 9), (5, 2, '2025-03-09', 10), (6, 2, '2025-03-16', 11)])
write(2, [(1, 'Ada')], [])
write(3, [(1, 'Ivo'), (2, 'Mei')],
      [(1, 1, '2025-01-01', 12), (2, 1, '2025-12-31', 12), (3, 1, '2026-01-01', 40), (4, 1, '2025-07-07', 12), (5, 2, '2024-12-31', 25), (6, 2, '2025-02-02', 25), (7, 2, '2025-02-09', 25)])
write(4, [(1, 'Noor'), (2, 'Raj')], [(i, 1 + i % 2, '2025-08-0' + str(1 + i % 9), 12 + (i % 3) - 1) for i in range(1, 13)])
write(5, *random_case(rng, 30, 400))
write(6, *random_case(rng, 400, 15000))
write(7, *random_case(rng, 500, 20000, shared_names=False))
sync_samples(2)
print('wrote 8 tests')
