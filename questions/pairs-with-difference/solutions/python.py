#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'countPairs' function below.
#
# The function is expected to return a LONG_INTEGER.
# The function accepts following parameters:
#  1. INTEGER_ARRAY arr
#  2. INTEGER k
#

def countPairs(arr, k):
    counts = {}
    for value in arr:
        counts[value] = counts.get(value, 0) + 1
    if k == 0:
        return sum(c * (c - 1) // 2 for c in counts.values())
    return sum(c * counts.get(value + k, 0) for value, c in counts.items())

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    k = int(first_multiple_input[1])

    arr = list(map(int, input().rstrip().split()))

    result = countPairs(arr, k)

    print(result)
