#!/bin/python3

import json
import os
import sys
import urllib.parse
import urllib.request

BASE_URL = os.environ.get('API_BASE_URL', 'http://127.0.0.1:8000')

#
# Complete the 'totalPaid' function below.
#
# The function is expected to return an INTEGER.
# The function accepts STRING customer as parameter.
#
# Orders: GET BASE_URL + '/api/orders?customer=<customer>&page=<n>'
#

def totalPaid(customer):
    # Write your code here
    return 0

if __name__ == '__main__':
    customer = input().strip()

    result = totalPaid(customer)

    print(result)
