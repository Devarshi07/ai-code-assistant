"""Writes the test files for Train a Tiny Classifier: python generator.py
Runs the training with NumPy (float64) and also with plain Python loops; they
must agree to 1e-9. Inputs whose results land within 1e-9 of a 4-decimal
rounding boundary, or whose |w·x + b| reaches 30, are regenerated."""
import json
import math
import random
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent


def train_numpy(X, y, steps, lr):
    X, y = np.array(X, dtype=float), np.array(y, dtype=float)
    n, d = X.shape
    w, b, largest = np.zeros(d), 0.0, 0.0
    for _ in range(steps):
        z = X @ w + b
        largest = max(largest, float(np.abs(z).max()))
        g = 1.0 / (1.0 + np.exp(-z)) - y
        w, b = w - lr * (X.T @ g) / n, b - lr * g.sum() / n
    return [*w.tolist(), float(b)], max(largest, float(np.abs(X @ w + b).max()))


def train_loops(X, y, steps, lr):
    n, d = len(X), len(X[0])
    w, b = [0.0] * d, 0.0
    for _ in range(steps):
        g = [1.0 / (1.0 + math.exp(-(sum(wj * xj for wj, xj in zip(w, x)) + b))) - yi for x, yi in zip(X, y)]
        w = [w[j] - lr * sum(gi * x[j] for gi, x in zip(g, X)) / n for j in range(d)]
        b = b - lr * sum(g) / n
    return [*w, b]


def near_boundary(value):
    scaled = value * 1e4
    return abs(scaled - math.floor(scaled) - 0.5) < 1e-5


def fmt(value):
    text = f'{value:.4f}'
    return '0.0000' if text == '-0.0000' else text


def write(index, X, y, steps, lr, check_loops=True):
    result, largest = train_numpy(X, y, steps, lr)
    assert largest < 30, f'test {index}: |z| reached {largest:.1f}'
    assert not any(near_boundary(v) for v in result), f'test {index}: a weight is on a rounding boundary'
    if check_loops:
        assert all(abs(a - b) < 1e-9 for a, b in zip(result, train_loops(X, y, steps, lr))), f'test {index}: NumPy and loops disagree'
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    text = f'{len(X)} {len(X[0])} {steps} {lr}\n' + ''.join(' '.join(f'{v:g}' for v in x) + f' {yi}\n' for x, yi in zip(X, y))
    (tests / f'input{index:02d}.txt').write_text(text, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(' '.join(fmt(v) for v in result) + '\n', encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def dataset(seed, n, d, noise):
    """Labels from a noisy linear rule, so the data isn't separable and the weights stay bounded."""
    for attempt in range(200):
        rng = random.Random(seed * 1000 + attempt)
        true_w = [rng.uniform(-1.5, 1.5) for _ in range(d)]
        X = [[round(rng.uniform(-5, 5), 2) for _ in range(d)] for _ in range(n)]
        y = [1 if sum(a * b for a, b in zip(true_w, x)) + rng.gauss(0, noise) > 0 else 0 for x in X]
        yield X, y


def write_random(index, seed, n, d, steps, lr, noise=2.0, check_loops=True):
    for X, y in dataset(seed, n, d, noise):
        try:
            return write(index, X, y, steps, lr, check_loops)
        except AssertionError:
            continue
    raise RuntimeError(f'could not build test {index}')


write(0, [[1.0], [3.0]], [1, 0], 1, 1.0)
write(1, [[2.0, 0.5], [1.5, -0.5], [-1.0, 0.2], [-2.5, -0.1], [0.5, 1.0], [-0.5, -1.0]], [1, 1, 0, 0, 1, 0], 200, 0.1)
write(2, [[0.0]], [1], 5, 0.5)
write(3, [[1.0, -1.0], [-1.0, 1.0], [1.0, 1.0], [-1.0, -1.0]], [1, 0, 1, 0], 50, 0.3)
write_random(4, 4, 30, 3, 100, 0.2)
write_random(5, 5, 200, 5, 300, 0.05)
write_random(6, 6, 600, 8, 400, 0.1)
write_random(7, 7, 2000, 10, 500, 0.05, check_loops=False)
write_random(8, 8, 1500, 6, 500, 0.5, noise=4.0, check_loops=False)
sync_samples(2)
print('wrote 9 tests')
