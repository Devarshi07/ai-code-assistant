#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'anagramGroups' function below.
#
# The function is expected to return an INTEGER_ARRAY.
# The function accepts STRING_ARRAY words as parameter.
#

def anagramGroups(words):
    # Write your code here
    return []

if __name__ == '__main__':
    n = int(input().strip())

    words = []

    for _ in range(n):
        words_item = input().rstrip()
        words.append(words_item)

    result = anagramGroups(words)

    print(' '.join(map(str, result)))
