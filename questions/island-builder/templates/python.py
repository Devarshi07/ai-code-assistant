#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'countIslands' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts following parameters:
#  1. INTEGER m
#  2. INTEGER n
#  3. 2D_INTEGER_ARRAY cells
#

def countIslands(m, n, cells):
    # Write your code here
    return []

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    m = int(first_multiple_input[0])

    n = int(first_multiple_input[1])

    q = int(first_multiple_input[2])

    cells = []

    for _ in range(q):
        cells.append(list(map(int, input().rstrip().split())))

    result = countIslands(m, n, cells)

    print(' '.join(map(str, result)))
