#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'rollingMedian' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts following parameters:
#  1. INTEGER_ARRAY latency
#  2. INTEGER k
#

def rollingMedian(latency, k):
    # Write your code here
    return []

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    k = int(first_multiple_input[1])

    latency = list(map(int, input().rstrip().split()))

    result = rollingMedian(latency, k)

    print(' '.join(map(str, result)))
