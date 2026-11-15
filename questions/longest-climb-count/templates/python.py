#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'longestClimb' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts INTEGER_ARRAY alt as parameter.
#

def longestClimb(alt):
    # Write your code here
    return []

if __name__ == '__main__':
    n = int(input().strip())

    alt = list(map(int, input().rstrip().split()))

    result = longestClimb(alt)

    print(' '.join(map(str, result)))
