#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'longestUniqueStretch' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts STRING s as parameter.
#

def longestUniqueStretch(s):
    last = {}  # most recent index of each character
    left = best_len = best_start = 0
    for i, ch in enumerate(s):
        if last.get(ch, -1) >= left:
            left = last[ch] + 1  # the window's left edge only ever moves forward
        last[ch] = i
        if i - left + 1 > best_len:
            best_len, best_start = i - left + 1, left
    return [best_len, best_start]

if __name__ == '__main__':
    s = input().rstrip()

    result = longestUniqueStretch(s)

    print(' '.join(map(str, result)))
