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
    balance = lowest = b
    first_negative = -1
    for i, amount in enumerate(transactions, start=1):
        balance += amount
        if balance < 0 and first_negative == -1:
            first_negative = i
        if balance < lowest:
            lowest = balance
    return [first_negative, lowest]

if __name__ == '__main__':
    first_multiple_input = input().rstrip().split()

    n = int(first_multiple_input[0])

    b = int(first_multiple_input[1])

    transactions = list(map(int, input().rstrip().split()))

    result = auditLedger(b, transactions)

    print(' '.join(map(str, result)))
