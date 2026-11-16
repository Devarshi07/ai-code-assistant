#!/bin/python3

import math
import os
import random
import re
import sys

import numpy as np

#
# Complete the 'scorecard' function below.
#
# The function is expected to return a FLOAT_ARRAY: [accuracy, precision, recall, f1].
# The function accepts following parameters:
#  1. INTEGER_ARRAY y_true
#  2. INTEGER_ARRAY y_pred
#

def scorecard(y_true, y_pred):
    t, p = np.array(y_true), np.array(y_pred)
    tp = int(np.sum((t == 1) & (p == 1)))
    fp = int(np.sum((t == 0) & (p == 1)))
    fn = int(np.sum((t == 1) & (p == 0)))
    accuracy = int(np.sum(t == p)) / len(t)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return [accuracy, precision, recall, f1]

if __name__ == '__main__':
    n = int(input().strip())

    y_true = list(map(int, input().rstrip().split()))

    y_pred = list(map(int, input().rstrip().split()))

    result = scorecard(y_true, y_pred)

    print(' '.join(f'{value:.4f}' for value in result))
