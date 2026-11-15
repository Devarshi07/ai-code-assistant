#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'shortestPath' function below.
#
# The function is expected to return an INTEGER.
# The function accepts STRING_ARRAY grid as parameter.
#

def shortestPath(grid):
    width = len(grid[0]) + 2
    # Surround the floor with shelves so a step can never leave the grid.
    cells = '#' * width + ''.join('#' + row + '#' for row in grid) + '#' * width
    start, end = cells.index('S'), cells.index('E')
    # 1 marks a cell the robot cannot step into: a shelf, or a cell it has already reached.
    blocked = bytearray(cells.encode().translate(bytes.maketrans(b'#.SE', b'\x01\x00\x00\x00')))
    blocked[start] = 1
    frontier, moves = [start], 0
    while frontier:  # breadth-first, one ring of cells per move
        moves += 1
        next_frontier = []
        for cell in frontier:
            for nxt in (cell - width, cell + width, cell - 1, cell + 1):
                if not blocked[nxt]:
                    if nxt == end:
                        return moves
                    blocked[nxt] = 1
                    next_frontier.append(nxt)
        frontier = next_frontier
    return -1

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    rows = int(first_multiple_input[0])

    cols = int(first_multiple_input[1])

    grid = []

    for _ in range(rows):
        grid_item = input().rstrip()
        grid.append(grid_item)

    result = shortestPath(grid)

    print(result)
