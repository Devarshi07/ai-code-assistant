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
    # Write your code here
    return []

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
