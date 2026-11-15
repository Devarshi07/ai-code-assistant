#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'countSubarrays' function below.
#
# The function is expected to return a LONG_INTEGER.
# The function accepts following parameters:
#  1. INTEGER_ARRAY arr
#  2. LONG_INTEGER k
#

def countSubarrays(arr, k):
    # seen[s] = how many prefixes so far sum to s. A stretch ending here sums to k
    # exactly when it starts right after a prefix that sums to (prefix - k).
    seen = {0: 1}
    prefix = total = 0
    for value in arr:
        prefix += value
        total += seen.get(prefix - k, 0)
        seen[prefix] = seen.get(prefix, 0) + 1
    return total

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    k = int(first_multiple_input[1])

    arr = list(map(int, input().rstrip().split()))

    result = countSubarrays(arr, k)

    print(result)
