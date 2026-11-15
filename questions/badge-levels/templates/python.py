#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'badgeScores' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts following parameters:
#  1. INTEGER_ARRAY scores
#  2. INTEGER m
#  3. INTEGER g
#  4. INTEGER t
#

def badgeScores(scores, m, g, t):
    # Write your code here
    return []

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    m = int(first_multiple_input[1])

    g = int(first_multiple_input[2])

    t = int(first_multiple_input[3])

    scores = list(map(int, input().rstrip().split()))

    result = badgeScores(scores, m, g, t)

    print('\n'.join(map(str, result)))
