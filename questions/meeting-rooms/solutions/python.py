#!/bin/python3

import heapq
import math
import os
import random
import re
import sys

#
# Complete the 'minMeetingRooms' function below.
#
# The function is expected to return an INTEGER.
# The function accepts 2D_INTEGER_ARRAY meetings as parameter.
#

def minMeetingRooms(meetings):
    meetings.sort()
    ends = []  # end times of the rooms in use, earliest first
    for start, end in meetings:
        if ends and ends[0] <= start:
            heapq.heapreplace(ends, end)  # take over the room that frees up first
        else:
            heapq.heappush(ends, end)
    return len(ends)

if __name__ == '__main__':
    n = int(input().strip())

    meetings = []

    for _ in range(n):
        meetings.append(list(map(int, input().rstrip().split())))

    result = minMeetingRooms(meetings)

    print(result)
