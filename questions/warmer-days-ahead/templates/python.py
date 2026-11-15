#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'daysUntilWarmer' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts INTEGER_ARRAY temperatures as parameter.
#

def daysUntilWarmer(temperatures):
    # Write your code here
    return []

if __name__ == '__main__':
    n = int(input().strip())

    temperatures = list(map(int, input().rstrip().split()))

    result = daysUntilWarmer(temperatures)

    print(' '.join(map(str, result)))
