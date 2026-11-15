#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'cheapestTrip' function below.
#
# The function is expected to return a LONG_INTEGER.
# The function accepts following parameters:
#  1. INTEGER n
#  2. 2D_INTEGER_ARRAY roads
#

def cheapestTrip(n, roads):
    # Write your code here
    return 0

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    m = int(first_multiple_input[1])

    roads = []

    for _ in range(m):
        roads.append(list(map(int, input().rstrip().split())))

    result = cheapestTrip(n, roads)

    print(result)
