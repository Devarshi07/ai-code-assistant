#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'minimumCapacity' function below.
#
# The function is expected to return an INTEGER.
# The function accepts following parameters:
#  1. INTEGER_ARRAY weights
#  2. INTEGER d
#

def minimumCapacity(weights, d):
    # Fewest days the truck needs with the given capacity (greedy loading).
    def days_needed(capacity):
        days, load = 1, 0
        for w in weights:
            load += w
            if load > capacity:
                days += 1
                load = w
        return days

    # Binary search on the answer: the capacity is at least the heaviest
    # package and at most the total weight, and more capacity never needs more days.
    lo, hi = max(weights), sum(weights)
    while lo < hi:
        mid = (lo + hi) // 2
        if days_needed(mid) <= d:
            hi = mid
        else:
            lo = mid + 1
    return lo

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    d = int(first_multiple_input[1])

    weights = list(map(int, input().rstrip().split()))

    result = minimumCapacity(weights, d)

    print(result)
