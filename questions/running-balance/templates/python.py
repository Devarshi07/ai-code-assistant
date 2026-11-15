#!/bin/python3

import math
import os
import random
import re
import sys

#
# Complete the 'auditLedger' function below.
#
# The function is expected to return a LONG_INTEGER_ARRAY.
# The function accepts following parameters:
#  1. INTEGER b
#  2. INTEGER_ARRAY transactions
#

def auditLedger(b, transactions):
    # Write your code here
    return []

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    b = int(first_multiple_input[1])

    transactions = list(map(int, input().rstrip().split()))

    result = auditLedger(b, transactions)

    print(' '.join(map(str, result)))
