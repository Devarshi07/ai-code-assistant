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
    # Write your code here
    return [0.0, 0.0, 0.0, 0.0]

if __name__ == '__main__':
    n = int(input().strip())

    y_true = list(map(int, input().rstrip().split()))

    y_pred = list(map(int, input().rstrip().split()))

    result = scorecard(y_true, y_pred)

    print(' '.join(f'{value:.4f}' for value in result))
