#!/bin/python3

import heapq
import math
import os
import random
import re
import sys

#
# Complete the 'cheapestTrip' function below.
#
# The function is expected to return a LONG_INTEGER.
# The function accepts following parameters:
#  1. INTEGER n
#  2. 2D_INTEGER_ARRAY roads
#

def cheapestTrip(n, roads):
    adj = [[] for _ in range(n + 1)]
    for u, v, c in roads:
        adj[u].append((v, c))
        adj[v].append((u, c))
    # Dijkstra over states (town, pass used?), encoded as 2 * town + used.
    dist = [math.inf] * (2 * n + 2)
    dist[2] = 0
    heap = [(0, 2)]
    while heap:
        d, state = heapq.heappop(heap)
        if d > dist[state]:
            continue
        town, used = state >> 1, state & 1
        if town == n:
            # The first state of town n to leave the heap is the cheapest one.
            return d
        for nxt, c in adj[town]:
            target = 2 * nxt + used
            if d + c < dist[target]:
                dist[target] = d + c
                heapq.heappush(heap, (d + c, target))
            if not used:
                target = 2 * nxt + 1
                if d + c // 2 < dist[target]:
                    dist[target] = d + c // 2
                    heapq.heappush(heap, (d + c // 2, target))
    return -1

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    m = int(first_multiple_input[1])

    roads = []

    for _ in range(m):
        roads.append(list(map(int, input().rstrip().split())))

    result = cheapestTrip(n, roads)

    print(result)
