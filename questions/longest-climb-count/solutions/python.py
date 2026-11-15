#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'longestClimb' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts INTEGER_ARRAY alt as parameter.
#

def longestClimb(alt):
    MOD = 10**9 + 7
    # A Fenwick tree over value ranks: node i stores the longest climb ending at a
    # value whose rank lies in its range, and how many such climbs there are.
    rank = {v: i + 1 for i, v in enumerate(sorted(set(alt)))}
    size = len(rank)
    tree_len = [0] * (size + 1)
    tree_cnt = [0] * (size + 1)
    for v in alt:
        r = rank[v]
        # Best climb ending at a strictly lower altitude (none: an empty climb, 1 way).
        best, ways = 0, 1
        i = r - 1
        while i > 0:
            if tree_len[i] > best:
                best, ways = tree_len[i], tree_cnt[i]
            elif tree_len[i] == best:
                ways += tree_cnt[i]
            i &= i - 1
        best += 1
        ways %= MOD
        i = r
        while i <= size:
            if tree_len[i] < best:
                tree_len[i], tree_cnt[i] = best, ways
            elif tree_len[i] == best:
                tree_cnt[i] = (tree_cnt[i] + ways) % MOD
            i += i & -i
    best, ways = 0, 0
    i = size
    while i > 0:
        if tree_len[i] > best:
            best, ways = tree_len[i], tree_cnt[i]
        elif tree_len[i] == best:
            ways += tree_cnt[i]
        i &= i - 1
    return [best, ways % MOD]

if __name__ == '__main__':
    n = int(input().strip())

    alt = list(map(int, input().rstrip().split()))

    result = longestClimb(alt)

    print(' '.join(map(str, result)))
