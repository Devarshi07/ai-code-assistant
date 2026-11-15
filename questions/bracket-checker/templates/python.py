#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'isBalanced' function below.
#
# The function is expected to return a STRING.
# The function accepts STRING s as parameter.
#

def isBalanced(s):
    # Write your code here
    return ""

if __name__ == '__main__':
    q = int(input().strip())

    results = []

    for q_itr in range(q):
        s = input().rstrip()

        result = isBalanced(s)

        results.append(result)

    print('\n'.join(results))
