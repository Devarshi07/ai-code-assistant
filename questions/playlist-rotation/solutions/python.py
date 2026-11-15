#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'playlistQueries' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts following parameters:
#  1. INTEGER_ARRAY tracks
#  2. INTEGER d
#  3. INTEGER_ARRAY positions
#

def playlistQueries(tracks, d, positions):
    n = len(tracks)
    shift = d % n
    return [tracks[(p + shift) % n] for p in positions]

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    d = int(first_multiple_input[1])

    q = int(first_multiple_input[2])

    tracks = list(map(int, input().rstrip().split()))

    positions = list(map(int, input().rstrip().split()))

    result = playlistQueries(tracks, d, positions)

    print('\n'.join(map(str, result)))
