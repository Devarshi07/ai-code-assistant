#!/bin/python3

import math
import os
import random
import re
import sys

import numpy as np

#
# Complete the 'rocAuc' function below.
#
# The function is expected to return a FLOAT.
# The function accepts following parameters:
#  1. INTEGER_ARRAY labels
#  2. FLOAT_ARRAY scores
#

def rocAuc(labels, scores):
    # Rank-sum (Mann-Whitney U) form: tied scores share the average of their ranks.
    y, s = np.array(labels), np.array(scores)
    _, inverse, counts = np.unique(s, return_inverse=True, return_counts=True)
    ends = np.cumsum(counts)
    average_rank = (ends - counts + 1 + ends) / 2.0
    ranks = average_rank[inverse]
    positives = int(y.sum())
    negatives = len(y) - positives
    return float((ranks[y == 1].sum() - positives * (positives + 1) / 2) / (positives * negatives))

if __name__ == '__main__':
    n = int(input().strip())

    labels = list(map(int, input().rstrip().split()))

    scores = list(map(float, input().rstrip().split()))

    result = rocAuc(labels, scores)

    print(f'{result:.6f}')
