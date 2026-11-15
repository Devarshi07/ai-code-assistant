#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'findDuplicateAndMissing' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts INTEGER_ARRAY scans as parameter.
#

def findDuplicateAndMissing(scans):
    n = len(scans)
    diff = sum(scans) - n * (n + 1) // 2  # duplicate - missing
    square_diff = sum(v * v for v in scans) - n * (n + 1) * (2 * n + 1) // 6  # duplicate^2 - missing^2
    total = square_diff // diff  # duplicate + missing
    duplicate = (total + diff) // 2
    return [duplicate, duplicate - diff]

if __name__ == '__main__':
    n = int(input().strip())

    scans = list(map(int, input().rstrip().split()))

    result = findDuplicateAndMissing(scans)

    print(' '.join(map(str, result)))
