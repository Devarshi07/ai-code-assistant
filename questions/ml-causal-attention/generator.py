"""Writes the test files for Masked Attention: python generator.py
Computes the output with NumPy, and for small tests also with plain Python
(log-sum-exp softmax); they must agree to 1e-9. Inputs with an output within
1e-10 of a 4-decimal rounding boundary are regenerated."""
import json
import math
import random
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent


def attention(Q, K, V):
    Q, K, V = (np.array(M, dtype=float) for M in (Q, K, V))
    n, d = Q.shape
    scores = Q @ K.T / np.sqrt(d)
    scores[np.triu(np.ones((n, n), dtype=bool), 1)] = -np.inf
    scores -= scores.max(axis=1, keepdims=True)
    weights = np.exp(scores)
    weights /= weights.sum(axis=1, keepdims=True)
    return (weights @ V).tolist()


def attention_loops(Q, K, V):
    n, d = len(Q), len(Q[0])
    out = []
    for i in range(n):
        s = [sum(a * b for a, b in zip(Q[i], K[j])) / math.sqrt(d) for j in range(i + 1)]
        top = max(s)
        log_total = top + math.log(sum(math.exp(x - top) for x in s))
        w = [math.exp(x - log_total) for x in s]
        out.append([sum(w[j] * V[j][c] for j in range(i + 1)) for c in range(d)])
    return out


def near_boundary(value):
    scaled = value * 1e4
    return abs(scaled - math.floor(scaled) - 0.5) < 1e-6


def fmt(value):
    text = f'{value:.4f}'
    return '0.0000' if text == '-0.0000' else text


def write(index, Q, K, V, check_loops=True):
    out = attention(Q, K, V)
    assert not any(near_boundary(v) for row in out for v in row), 'rounding boundary'
    if check_loops:
        loops = attention_loops(Q, K, V)
        assert all(abs(a - b) < 1e-9 for ra, rb in zip(out, loops) for a, b in zip(ra, rb)), f'test {index}: NumPy and loops disagree'
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    text = f'{len(Q)} {len(Q[0])}\n' + ''.join(' '.join(f'{v:g}' for v in row) + '\n' for row in Q + K + V)
    (tests / f'input{index:02d}.txt').write_text(text, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(''.join(' '.join(fmt(v) for v in row) + '\n' for row in out), encoding='utf-8', newline='\n')


def write_random(index, seed, n, d, scale, check_loops=True):
    for attempt in range(50):
        rng = random.Random(seed * 100 + attempt)
        make = lambda: [[round(rng.uniform(-scale, scale), 2) + 0.0 for _ in range(d)] for _ in range(n)]
        try:
            return write(index, make(), make(), make(), check_loops)
        except AssertionError as error:
            if 'disagree' in str(error):
                raise
    raise RuntimeError(f'could not build test {index}')


def write_aligned(index, seed, n, d):
    """Queries and keys share a sign pattern per token, so scores pass 700 and a naive e^x overflows."""
    for attempt in range(50):
        rng = random.Random(seed * 100 + attempt)
        signs = [[rng.choice([-1, 1]) for _ in range(d)] for _ in range(n)]
        Q = [[s * round(rng.uniform(9.5, 10), 2) for s in row] for row in signs]
        K = [[s * round(rng.uniform(9.5, 10), 2) for s in row] for row in signs]
        V = [[round(rng.uniform(-10, 10), 2) + 0.0 for _ in range(d)] for _ in range(n)]
        if max(sum(a * b for a, b in zip(Q[i], K[i])) for i in range(n)) / math.sqrt(d) < 720:
            continue
        try:
            return write(index, Q, K, V)
        except AssertionError as error:
            if 'disagree' in str(error):
                raise
    raise RuntimeError(f'could not build test {index}')


write(0, [[1.0, 0.0], [1.0, 1.0]], [[0.0, 0.0], [1.0, 1.0]], [[1.0, 0.0], [0.0, 1.0]])
write(1, [[10.0] * 8, [10.0] * 8, [-10.0] * 8], [[10.0] * 8, [9.5] * 8, [10.0] * 8], [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0], [-1.0] * 8, [0.5] * 8])
write(2, [[3.5]], [[-2.0]], [[7.25]])
write_random(3, 3, 5, 3, 1)
write_random(4, 4, 30, 16, 3)
write_aligned(5, 5, 60, 64)
write_random(6, 6, 200, 32, 2, check_loops=False)
write_random(7, 7, 400, 48, 1, check_loops=False)
write_random(8, 8, 300, 64, 10, check_loops=False)
sync = HERE / 'question.json'
question = json.loads(sync.read_text(encoding='utf-8'))
for i in range(2):
    question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
    question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
sync.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
print('wrote 9 tests')
