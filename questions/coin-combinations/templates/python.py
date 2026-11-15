#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'countWays' function below.
#
# The function is expected to return an INTEGER.
# The function accepts following parameters:
#  1. INTEGER amount
#  2. INTEGER_ARRAY coins
#

def countWays(amount, coins):
    # Write your code here
    return 0

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    amount = int(first_multiple_input[1])

    coins = list(map(int, input().rstrip().split()))

    result = countWays(amount, coins)

    print(result)
