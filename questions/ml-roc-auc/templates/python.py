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
    # Write your code here
    return 0.0

if __name__ == '__main__':
    n = int(input().strip())

    labels = list(map(int, input().rstrip().split()))

    scores = list(map(float, input().rstrip().split()))

    result = rocAuc(labels, scores)

    print(f'{result:.6f}')
