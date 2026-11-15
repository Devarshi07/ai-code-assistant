#!/bin/python3

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
    # Write your code here
    return 0

if __name__ == '__main__':
    n = int(input().strip())

    meetings = []

    for _ in range(n):
        meetings.append(list(map(int, input().rstrip().split())))

    result = minMeetingRooms(meetings)

    print(result)
