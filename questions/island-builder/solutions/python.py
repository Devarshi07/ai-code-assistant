#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'countIslands' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts following parameters:
#  1. INTEGER m
#  2. INTEGER n
#  3. 2D_INTEGER_ARRAY cells
#

def countIslands(m, n, cells):
    # Union-find over the m * n cells (cell id r * n + c); parent[x] == -1 marks water.
    parent = [-1] * (m * n)
    size = [1] * (m * n)
    islands = 0
    result = []

    def find(x):
        root = x
        while parent[root] != root:
            root = parent[root]
        while parent[x] != root:
            parent[x], x = root, parent[x]
        return root

    for r, c in cells:
        cell = r * n + c
        if parent[cell] == -1:
            parent[cell] = cell
            islands += 1
            for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                if 0 <= nr < m and 0 <= nc < n and parent[nr * n + nc] != -1:
                    a, b = find(cell), find(nr * n + nc)
                    if a != b:
                        if size[a] < size[b]:
                            a, b = b, a
                        parent[b] = a
                        size[a] += size[b]
                        islands -= 1
        result.append(islands)
    return result

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    m = int(first_multiple_input[0])

    n = int(first_multiple_input[1])

    q = int(first_multiple_input[2])

    cells = []

    for _ in range(q):
        cells.append(list(map(int, input().rstrip().split())))

    result = countIslands(m, n, cells)

    print(' '.join(map(str, result)))
