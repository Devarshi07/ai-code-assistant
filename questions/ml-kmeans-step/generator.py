"""Writes the test files for One K-Means Step: python generator.py
Answers are computed exactly with integers and fractions; inputs whose means sit
exactly on a 4-decimal rounding boundary are nudged."""
import json
import random
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent


def step(points, centroids):
    sums = [[0] * len(centroids[0]) for _ in centroids]
    counts = [0] * len(centroids)
    for p in points:
        distances = [sum((a - b) ** 2 for a, b in zip(p, c)) for c in centroids]
        best = distances.index(min(distances))
        counts[best] += 1
        for j, v in enumerate(p):
            sums[best][j] += v
    means = [[Fraction(s, counts[i]) for s in sums[i]] if counts[i] else [Fraction(v) for v in centroids[i]] for i in range(len(centroids))]
    return counts, means


def on_boundary(value):
    scaled = value * 10 ** 4
    return abs(scaled - int(scaled)) == Fraction(1, 2)


def fmt(value):
    text = f'{float(value):.4f}'
    return '0.0000' if text == '-0.0000' else text


def write(index, points, centroids, rng=None):
    while True:
        counts, means = step(points, centroids)
        bad = [i for i, m in enumerate(means) if counts[i] and any(on_boundary(v) for v in m)]
        if not bad:
            break
        points[rng.randrange(len(points))][rng.randrange(len(points[0]))] += 1
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    text = f'{len(points)} {len(centroids)} {len(points[0])}\n' + ''.join(' '.join(map(str, p)) + '\n' for p in points + centroids)
    answer = ' '.join(map(str, counts)) + '\n' + ''.join(' '.join(fmt(v) for v in m) + '\n' for m in means)
    (tests / f'input{index:02d}.txt').write_text(text, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(answer, encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def blobs(rng, n, k, d, spread=60, grid=False):
    centers = [[rng.randint(-800, 800) for _ in range(d)] for _ in range(k)]
    points = []
    for _ in range(n):
        c = rng.choice(centers)
        points.append([max(-1000, min(1000, v + (rng.randint(-2, 2) * 5 if grid else int(rng.gauss(0, spread))))) for v in c])
    starts = [list(p) for p in rng.sample(points, k)] if not grid else [[rng.choice([-10, 0, 10]) * 5 for _ in range(d)] for _ in range(k)]
    return points, starts


rng = random.Random(2026)
write(0, [[0, 0], [1, 0], [0, 1], [9, 9], [10, 8]], [[0, 0], [10, 10]])
write(1, [[5], [-3], [7]], [[0], [10], [100]])
write(2, [[3, -4]], [[3, -4]])
write(3, [[1, 1], [2, 2], [3, 3]], [[0, 0], [0, 0], [5, 5]])
write(4, [[-1, -2, -3], [-1, -2, -2], [4, 4, 4]], [[-1, -2, -3], [100, 100, 100], [4, 4, 4]])
write(5, *blobs(rng, 300, 4, 3, grid=True), rng)
write(6, *blobs(rng, 5000, 6, 5), rng)
write(7, *blobs(rng, 32000, 10, 8), rng)
write(8, *blobs(rng, 50000, 8, 4, grid=True), rng)
sync_samples(2)
print('wrote 9 tests')
