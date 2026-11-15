#!/bin/python3

import math
import os
import random
import re
import sys
import heapq

#
# Complete the 'rollingMedian' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts following parameters:
#  1. INTEGER_ARRAY latency
#  2. INTEGER k
#

def rollingMedian(latency, k):
    # lo is a max-heap (stored negated) holding the smaller ceil(size / 2) values
    # of the window and hi a min-heap holding the rest, so the lower median is
    # the top of lo. Each entry packs (value, index) into one integer: keys are
    # unique, and entries that left the window are discarded lazily when they
    # reach the top of a heap. lo_size and hi_size count only live entries.
    shift = 17
    mask = (1 << shift) - 1
    lo, hi = [], []
    lo_size = hi_size = 0
    medians = []
    for i, value in enumerate(latency):
        start = i - k + 1
        if i >= k:
            if (latency[i - k] << shift | (i - k)) <= -lo[0]:
                lo_size -= 1
            else:
                hi_size -= 1
        while lo and (-lo[0] & mask) < start:
            heapq.heappop(lo)
        key = value << shift | i
        if lo and key < -lo[0]:
            heapq.heappush(lo, -key)
            lo_size += 1
        else:
            heapq.heappush(hi, key)
            hi_size += 1
        if lo_size > hi_size + 1:
            while (-lo[0] & mask) < start:
                heapq.heappop(lo)
            heapq.heappush(hi, -heapq.heappop(lo))
            lo_size -= 1
            hi_size += 1
        elif lo_size < hi_size:
            while (hi[0] & mask) < start:
                heapq.heappop(hi)
            heapq.heappush(lo, -heapq.heappop(hi))
            lo_size += 1
            hi_size -= 1
        if start >= 0:
            while (-lo[0] & mask) < start:
                heapq.heappop(lo)
            medians.append(-lo[0] >> shift)
    return medians

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    k = int(first_multiple_input[1])

    latency = list(map(int, input().rstrip().split()))

    result = rollingMedian(latency, k)

    print(' '.join(map(str, result)))
