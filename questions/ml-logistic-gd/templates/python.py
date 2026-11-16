#!/bin/python3

import math
import os
import random
import re
import sys

import numpy as np

#
# Complete the 'trainLogistic' function below.
#
# The function is expected to return a FLOAT_ARRAY: the weights w_1..w_d, then the bias b.
# The function accepts following parameters:
#  1. 2D_FLOAT_ARRAY X
#  2. INTEGER_ARRAY y
#  3. INTEGER steps
#  4. FLOAT lr
#

def trainLogistic(X, y, steps, lr):
    # Write your code here
    return [0.0] * (len(X[0]) + 1)

def fmt(value):
    text = f'{value:.4f}'
    return '0.0000' if text == '-0.0000' else text

if __name__ == '__main__':
    first = input().split()

    n, d, steps, lr = int(first[0]), int(first[1]), int(first[2]), float(first[3])

    X, y = [], []
    for _ in range(n):
        row = input().split()
        X.append(list(map(float, row[:d])))
        y.append(int(row[d]))

    result = trainLogistic(X, y, steps, lr)

    print(' '.join(fmt(value) for value in result))
