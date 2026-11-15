#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'minimumEditCost' function below.
#
# The function is expected to return a LONG_INTEGER.
# The function accepts following parameters:
#  1. STRING a
#  2. STRING b
#  3. INTEGER insertCost
#  4. INTEGER deleteCost
#  5. INTEGER replaceCost
#

def minimumEditCost(a, b, insertCost, deleteCost, replaceCost):
    # Write your code here
    return 0

if __name__ == '__main__':
    a = input().rstrip()

    b = input().rstrip()

    first_multiple_input = input().rstrip().split()

    insertCost = int(first_multiple_input[0])

    deleteCost = int(first_multiple_input[1])

    replaceCost = int(first_multiple_input[2])

    result = minimumEditCost(a, b, insertCost, deleteCost, replaceCost)

    print(result)
