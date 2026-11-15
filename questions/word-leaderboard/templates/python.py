#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'topWords' function below.
#
# The function is expected to return a STRING_ARRAY.
# The function accepts following parameters:
#  1. STRING_ARRAY lines
#  2. INTEGER k
#

def topWords(lines, k):
    # Write your code here
    return []

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    m = int(first_multiple_input[0])

    k = int(first_multiple_input[1])

    lines = []

    for _ in range(m):
        lines_item = input().rstrip()
        lines.append(lines_item)

    result = topWords(lines, k)

    print('\n'.join(result))
