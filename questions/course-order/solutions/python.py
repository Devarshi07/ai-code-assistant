#!/bin/python3

import heapq
import math
import os
import random
import re
import sys

#
# Complete the 'courseOrder' function below.
#
# The function is expected to return a STRING.
# The function accepts following parameters:
#  1. INTEGER n
#  2. 2D_INTEGER_ARRAY prerequisites
#

def courseOrder(n, prerequisites):
    # Kahn's algorithm with a min-heap: always take the smallest course whose
    # prerequisites are all finished.
    after = [[] for _ in range(n + 1)]
    waiting = [0] * (n + 1)
    for a, b in prerequisites:
        after[a].append(b)
        waiting[b] += 1
    ready = [course for course in range(1, n + 1) if waiting[course] == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        course = heapq.heappop(ready)
        order.append(course)
        for nxt in after[course]:
            waiting[nxt] -= 1
            if waiting[nxt] == 0:
                heapq.heappush(ready, nxt)
    if len(order) < n:
        return "IMPOSSIBLE"
    return " ".join(map(str, order))

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    m = int(first_multiple_input[1])

    prerequisites = []

    for _ in range(m):
        prerequisites.append(list(map(int, input().rstrip().split())))

    result = courseOrder(n, prerequisites)

    print(result)
