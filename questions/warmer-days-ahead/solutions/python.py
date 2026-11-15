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
    answer = [0] * len(temperatures)
    # Days still waiting for a warmer reading. Their readings never rise from
    # the bottom of the stack to the top, so a new reading settles them from the top.
    waiting = []
    for i, t in enumerate(temperatures):
        while waiting and temperatures[waiting[-1]] < t:
            j = waiting.pop()
            answer[j] = i - j
        waiting.append(i)
    return answer

if __name__ == '__main__':
    n = int(input().strip())

    temperatures = list(map(int, input().rstrip().split()))

    result = daysUntilWarmer(temperatures)

    print(' '.join(map(str, result)))
