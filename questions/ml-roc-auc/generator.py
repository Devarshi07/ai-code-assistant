"""Writes the test files for Ranking Quality: python generator.py
The AUC is computed exactly with fractions; inputs whose AUC sits exactly on a
6-decimal rounding boundary are nudged."""
import json
import random
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent


def exact_auc(labels, scores):
    # Sort once; walk tie groups, counting the negatives seen below each group.
    pairs = sorted(zip(scores, labels))
    below = 0
    wins = Fraction(0)
    i = 0
    while i < len(pairs):
        j = i
        while j < len(pairs) and pairs[j][0] == pairs[i][0]:
            j += 1
        group_pos = sum(1 for _, y in pairs[i:j] if y == 1)
        group_neg = (j - i) - group_pos
        wins += group_pos * below + Fraction(group_pos * group_neg, 2)
        below += group_neg
        i = j
    positives = sum(labels)
    return wins / (positives * (len(labels) - positives))


def on_boundary(value, places=6):
    scaled = value * 10 ** places
    return scaled - int(scaled) == Fraction(1, 2)


def write(index, labels, scores, rng=None):
    while on_boundary(exact_auc(labels, scores)):
        scores[rng.randrange(len(scores))] = round(rng.random(), 3)
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    text = f'{len(labels)}\n{" ".join(map(str, labels))}\n{" ".join(f"{s:g}" for s in scores)}\n'
    (tests / f'input{index:02d}.txt').write_text(text, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(f'{float(exact_auc(labels, scores)):.6f}\n', encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def model(rng, n, positive_rate, signal, decimals=3):
    labels = [1 if rng.random() < positive_rate else 0 for _ in range(n)]
    labels[0], labels[1] = 1, 0
    scores = [round(min(1.0, max(0.0, rng.gauss(0.5 + signal * (y - 0.5), 0.2))), decimals) for y in labels]
    return labels, scores


rng = random.Random(2026)
write(0, [1, 0, 1, 0, 0], [0.9, 0.6, 0.4, 0.4, 0.1])
write(1, [1, 0, 1, 0], [0.5, 0.5, 0.5, 0.5])
write(2, [1, 0], [0.2, 0.8])
write(3, [0, 1, 0, 1, 1, 0], [0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
write(4, *model(rng, 40, 0.5, 0.4, decimals=1), rng)
write(5, *model(rng, 2000, 0.1, 0.5), rng)
write(6, *model(rng, 50000, 0.5, 0.0), rng)
write(7, *model(rng, 120000, 0.3, 0.3), rng)
write(8, *model(rng, 150000, 0.02, 0.6, decimals=2), rng)
sync_samples(2)
print('wrote 9 tests')
