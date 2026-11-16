"""Writes the test files for Model Scorecard: python generator.py
Exact fractions decide the answers; inputs whose values sit exactly on a
4-decimal rounding boundary are nudged, so every correct method rounds alike."""
import json
import random
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent


def exact(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    accuracy = Fraction(sum(1 for t, p in zip(y_true, y_pred) if t == p), len(y_true))
    precision = Fraction(tp, tp + fp) if tp + fp else Fraction(0)
    recall = Fraction(tp, tp + fn) if tp + fn else Fraction(0)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else Fraction(0)
    return [accuracy, precision, recall, f1]


def on_boundary(value, places=4):
    return (value * 10 ** places - int(value * 10 ** places)) == Fraction(1, 2)


def write(index, y_true, y_pred, rng=None):
    while any(on_boundary(v) for v in exact(y_true, y_pred)):
        i = rng.randrange(len(y_pred))
        y_pred[i] ^= 1
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    text = f'{len(y_true)}\n{" ".join(map(str, y_true))}\n{" ".join(map(str, y_pred))}\n'
    answer = ' '.join(f'{float(v):.4f}' for v in exact(y_true, y_pred))
    (tests / f'input{index:02d}.txt').write_text(text, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(answer + '\n', encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def noisy(rng, n, positive_rate, error_rate):
    y_true = [1 if rng.random() < positive_rate else 0 for _ in range(n)]
    return y_true, [t ^ (rng.random() < error_rate) for t in y_true]


rng = random.Random(2026)
write(0, [1, 0, 1, 1, 0, 0], [1, 0, 0, 1, 1, 0])
write(1, [1, 0, 0, 0], [0, 0, 0, 0])
write(2, [1], [1])
write(3, [0, 0, 0], [0, 0, 0])
write(4, [0, 1, 0, 1], [1, 0, 1, 0])
write(5, *noisy(rng, 50, 0.5, 0.2), rng)
write(6, *noisy(rng, 1000, 0.05, 0.03), rng)
write(7, *noisy(rng, 200000, 0.3, 0.15), rng)
write(8, *noisy(rng, 200000, 0.01, 0.005), rng)
sync_samples(2)
print('wrote 9 tests')
