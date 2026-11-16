#!/bin/python3

import math
import os
import random
import re
import sys

import numpy as np

#
# Complete the 'causalAttention' function below.
#
# The function is expected to return a 2D_FLOAT_ARRAY (n rows of d values).
# The function accepts following parameters:
#  1. 2D_FLOAT_ARRAY Q
#  2. 2D_FLOAT_ARRAY K
#  3. 2D_FLOAT_ARRAY V
#

def causalAttention(Q, K, V):
    Q, K, V = (np.array(M, dtype=float) for M in (Q, K, V))
    n, d = Q.shape
    scores = Q @ K.T / np.sqrt(d)
    scores[np.triu(np.ones((n, n), dtype=bool), 1)] = -np.inf
    # Subtracting the row maximum keeps exp() in range; the diagonal is never masked.
    scores -= scores.max(axis=1, keepdims=True)
    weights = np.exp(scores)
    weights /= weights.sum(axis=1, keepdims=True)
    return (weights @ V).tolist()

def fmt(value):
    text = f'{value:.4f}'
    return '0.0000' if text == '-0.0000' else text

if __name__ == '__main__':
    n, d = map(int, input().split())

    rows = [list(map(float, input().split())) for _ in range(3 * n)]

    Q, K, V = rows[:n], rows[n:2 * n], rows[2 * n:]

    result = causalAttention(Q, K, V)

    for row in result:
        print(' '.join(fmt(value) for value in row))
