#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'findDuplicateAndMissing' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts INTEGER_ARRAY scans as parameter.
#

def findDuplicateAndMissing(scans):
    # Write your code here
    return []

if __name__ == '__main__':
    n = int(input().strip())

    scans = list(map(int, input().rstrip().split()))

    result = findDuplicateAndMissing(scans)

    print(' '.join(map(str, result)))
