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
    # Write your code here
    return 0

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    d = int(first_multiple_input[1])

    weights = list(map(int, input().rstrip().split()))

    result = minimumCapacity(weights, d)

    print(result)
