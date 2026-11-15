#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'courseOrder' function below.
#
# The function is expected to return a STRING.
# The function accepts following parameters:
#  1. INTEGER n
#  2. 2D_INTEGER_ARRAY prerequisites
#

def courseOrder(n, prerequisites):
    # Write your code here
    return ""

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    m = int(first_multiple_input[1])

    prerequisites = []

    for _ in range(m):
        prerequisites.append(list(map(int, input().rstrip().split())))

    result = courseOrder(n, prerequisites)

    print(result)
