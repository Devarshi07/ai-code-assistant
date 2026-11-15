#!/bin/python3

import heapq
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
    # A min-heap of (-plays, track) entries. Each play pushes a fresh entry, and
    # entries whose play count is out of date are discarded when they surface.
    plays = {}
    heap = []
    answers = []
    for kind, value in events:
        if kind == 1:
            plays[value] = plays.get(value, 0) + 1
            heapq.heappush(heap, (-plays[value], value))
        else:
            top = []
            while heap and len(top) < value:
                entry = heapq.heappop(heap)
                if plays[entry[1]] == -entry[0]:
                    top.append(entry)
            for entry in top:
                heapq.heappush(heap, entry)
            answers.append([track for _, track in top])
    return answers

if __name__ == '__main__':
    q = int(input().strip())

    events = []

    for _ in range(q):
        events.append(list(map(int, input().rstrip().split())))

    result = topTracks(events)

    print('\n'.join([' '.join(map(str, x)) for x in result]))
