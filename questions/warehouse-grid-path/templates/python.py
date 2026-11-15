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
    # Write your code here
    return 0

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
