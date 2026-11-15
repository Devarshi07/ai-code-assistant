#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'topTracks' function below.
#
# The function is expected to return a 2D_INTEGER_ARRAY.
# The function accepts 2D_INTEGER_ARRAY events as parameter.
#

def topTracks(events):
    # Write your code here
    return []

if __name__ == '__main__':
    q = int(input().strip())

    events = []

    for _ in range(q):
        events.append(list(map(int, input().rstrip().split())))

    result = topTracks(events)

    print('\n'.join([' '.join(map(str, x)) for x in result]))
