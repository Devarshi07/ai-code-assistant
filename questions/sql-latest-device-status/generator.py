"""Writes the test files for Latest Device Status: python generator.py
Expected outputs come from running solutions/query.sql through the judge's SQL runner,
and are checked against a plain-Python version of the rules."""
import json
import random
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'judge-runners'))
from sql_runner import run_query  # noqa: E402

QUERY = (HERE / 'solutions' / 'query.sql').read_text(encoding='utf-8')
SCHEMA = """CREATE TABLE readings (
  id INTEGER PRIMARY KEY,
  device TEXT NOT NULL,
  status TEXT,
  recorded_at TEXT NOT NULL
);
"""
STATUSES = ['online', 'offline', 'degraded', 'retired']


def sql(value):
    if value is None:
        return 'NULL'
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return repr(value)


def expected(rows):
    valid = [r for r in rows if r[2] is not None]
    latest = {}
    for row in valid:
        if row[1] not in latest or (row[3], row[0]) > (latest[row[1]][3], latest[row[1]][0]):
            latest[row[1]] = row
    counts = Counter((r[1], r[2], r[3]) for r in valid)
    lines = ['device\tstatus\trecorded_at\tcopies']
    for device in sorted(latest):
        _, _, status, at = latest[device]
        if status != 'retired':
            lines.append(f'{device}\t{status}\t{at}\t{counts[(device, status, at)]}')
    return '\n'.join(lines) + '\n'


def write(index, readings):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    rows = [(i, *reading) for i, reading in enumerate(readings, 1)] if readings and not isinstance(readings[0][0], int) else readings
    setup = SCHEMA + ''.join('INSERT INTO readings VALUES\n' + ',\n'.join('  (' + ', '.join(sql(v) for v in row) + ')' for row in rows[s:s + 200]) + ';\n' for s in range(0, len(rows), 200))
    out = run_query(setup, QUERY)
    assert out == expected(rows), f'test {index}: the query and the Python model disagree'
    (tests / f'input{index:02d}.txt').write_text(setup, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(out, encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def stamp(minutes):
    return (datetime(2025, 6, 1) + timedelta(minutes=minutes)).strftime('%Y-%m-%d %H:%M:%S')


def random_case(rng, n, devices, ties=False):
    names = [f'dev-{i:04d}' for i in range(devices)]
    readings = []
    for _ in range(n):
        at = stamp(rng.randint(0, 60 if ties else 50000))
        status = rng.choice(STATUSES + [None]) if rng.random() < 0.9 else None
        reading = (rng.choice(names), status, at)
        readings.append(reading)
        while rng.random() < 0.15:
            readings.append(reading)
    rng.shuffle(readings)
    return readings


rng = random.Random(2026)
write(0, [(1, 'cam-1', 'offline', '2025-06-01 10:00:00'), (2, 'cam-1', 'online', '2025-06-01 10:05:00'), (3, 'cam-1', 'online', '2025-06-01 10:05:00'),
          (4, 'cam-2', 'offline', '2025-06-01 09:00:00'), (5, 'cam-2', None, '2025-06-01 09:30:00'), (6, 'cam-3', 'online', '2025-06-01 08:00:00'),
          (7, 'cam-3', 'retired', '2025-06-01 11:00:00')])
write(1, [(10, 'gate', 'online', '2025-06-02 11:00:00'), (11, 'gate', 'online', '2025-06-02 12:00:00'), (12, 'gate', 'degraded', '2025-06-02 12:00:00'),
          (13, 'vent', None, '2025-06-02 12:30:00'), (14, 'vent', None, '2025-06-02 12:40:00')])
write(2, [])
write(3, [(1, 'solo', 'retired', '2025-06-03 00:00:00'), (2, 'solo', 'online', '2025-06-02 23:59:59')])
write(4, [(i, 'pump', 'offline', '2025-06-04 07:00:00') for i in range(1, 6)] + [(6, 'pump', 'online', '2025-06-04 06:59:59'), (7, 'pump', None, '2025-06-04 07:00:01')])
write(5, random_case(rng, 400, 30, ties=True))
write(6, random_case(rng, 12000, 1500))
write(7, random_case(rng, 13000, 2000, ties=True))
sync_samples(2)
print('wrote 8 tests')
