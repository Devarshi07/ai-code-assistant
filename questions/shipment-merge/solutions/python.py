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
    # Sort by start, then keep extending the last busy period while the next
    # window starts at or before its end.
    merged = []
    for start, end in sorted(windows):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged

if __name__ == '__main__':
    n = int(input().strip())

    windows = []

    for _ in range(n):
        windows.append(list(map(int, input().rstrip().split())))

    result = mergeShipments(windows)

    print(len(result))

    print('\n'.join([' '.join(map(str, x)) for x in result]))
