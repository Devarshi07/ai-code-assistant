#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'processOperations' function below.
#
# The function is expected to return a LONG_INTEGER_ARRAY.
# The function accepts following parameters:
#  1. INTEGER_ARRAY stock
#  2. 2D_INTEGER_ARRAY operations
#

def processOperations(stock, operations):
    # A Fenwick tree over the shelves, plus each shelf's current value so a
    # recount becomes an update by the difference.
    n = len(stock)
    current = [0] + stock
    tree = current[:]
    for i in range(1, n + 1):
        parent = i + (i & -i)
        if parent <= n:
            tree[parent] += tree[i]
    answers = []
    for kind, x, y in operations:
        if kind == 1:
            delta = y - current[x]
            current[x] = y
            while x <= n:
                tree[x] += delta
                x += x & -x
        else:
            total = 0
            while y > 0:
                total += tree[y]
                y &= y - 1
            x -= 1
            while x > 0:
                total -= tree[x]
                x &= x - 1
            answers.append(total)
    return answers

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    q = int(first_multiple_input[1])

    stock = list(map(int, input().rstrip().split()))

    operations = []

    for _ in range(q):
        operations.append(list(map(int, input().rstrip().split())))

    result = processOperations(stock, operations)

    print('\n'.join(map(str, result)))
