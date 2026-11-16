#!/bin/python3

import math
import os
import random
import re
import sys

import numpy as np

#
# Complete the 'kmeansStep' function below.
#
# The function is expected to return a pair:
#  1. INTEGER_ARRAY counts (points assigned to each centroid)
#  2. 2D_FLOAT_ARRAY the updated centroids
# The function accepts following parameters:
#  1. 2D_INTEGER_ARRAY points
#  2. 2D_INTEGER_ARRAY centroids
#

def kmeansStep(points, centroids):
    P = np.array(points, dtype=np.int64)
    C = np.array(centroids, dtype=np.int64)
    # Integer squared distances are exact, so ties are real ties; argmin picks the first.
    distances = ((P[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)
    assigned = distances.argmin(axis=1)
    counts = np.bincount(assigned, minlength=len(C))
    sums = np.zeros(C.shape, dtype=np.int64)
    np.add.at(sums, assigned, P)
    updated = C.astype(float)
    filled = counts > 0
    updated[filled] = sums[filled] / counts[filled][:, None]
    return counts.tolist(), updated.tolist()

def fmt(value):
    text = f'{value:.4f}'
    return '0.0000' if text == '-0.0000' else text

if __name__ == '__main__':
    n, k, d = map(int, input().split())

    points = [list(map(int, input().split())) for _ in range(n)]

    centroids = [list(map(int, input().split())) for _ in range(k)]

    counts, updated = kmeansStep(points, centroids)

    print(' '.join(map(str, counts)))
    for centroid in updated:
        print(' '.join(fmt(value) for value in centroid))
