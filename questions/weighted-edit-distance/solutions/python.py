#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'minimumEditCost' function below.
#
# The function is expected to return a LONG_INTEGER.
# The function accepts following parameters:
#  1. STRING a
#  2. STRING b
#  3. INTEGER insertCost
#  4. INTEGER deleteCost
#  5. INTEGER replaceCost
#

def minimumEditCost(a, b, insertCost, deleteCost, replaceCost):
    # Keep one DP row over the shorter string. Turning a into b costs the same
    # as turning b into a with the insert and delete costs swapped.
    if len(b) > len(a):
        a, b = b, a
        insertCost, deleteCost = deleteCost, insertCost
    # prev[j] = cost of turning the first i - 1 characters of a into b[:j]
    prev = [j * insertCost for j in range(len(b) + 1)]
    for i, ca in enumerate(a, 1):
        diag = prev[0]
        left = i * deleteCost
        cur = [left]
        push = cur.append
        for cb, up in zip(b, prev[1:]):
            best = diag if cb == ca else diag + replaceCost
            if up + deleteCost < best:
                best = up + deleteCost
            if left + insertCost < best:
                best = left + insertCost
            push(best)
            left = best
            diag = up
        prev = cur
    return prev[-1]

if __name__ == '__main__':
    a = input().rstrip()

    b = input().rstrip()

    first_multiple_input = input().rstrip().split()

    insertCost = int(first_multiple_input[0])

    deleteCost = int(first_multiple_input[1])

    replaceCost = int(first_multiple_input[2])

    result = minimumEditCost(a, b, insertCost, deleteCost, replaceCost)

    print(result)
