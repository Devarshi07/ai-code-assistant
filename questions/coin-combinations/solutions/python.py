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
    MOD = 10**9 + 7
    # ways[a] = number of payouts for amount a using the coins processed so far
    ways = [1] + [0] * amount
    for c in coins:
        for a in range(c, amount + 1):
            ways[a] = (ways[a] + ways[a - c]) % MOD
    return ways[amount]

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    amount = int(first_multiple_input[1])

    coins = list(map(int, input().rstrip().split()))

    result = countWays(amount, coins)

    print(result)
