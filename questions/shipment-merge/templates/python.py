#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'mergeShipments' function below.
#
# The function is expected to return a 2D_INTEGER_ARRAY.
# The function accepts 2D_INTEGER_ARRAY windows as parameter.
#

def mergeShipments(windows):
    # Write your code here
    return []

if __name__ == '__main__':
    n = int(input().strip())

    windows = []

    for _ in range(n):
        windows.append(list(map(int, input().rstrip().split())))

    result = mergeShipments(windows)

    print(len(result))

    print('\n'.join([' '.join(map(str, x)) for x in result]))
