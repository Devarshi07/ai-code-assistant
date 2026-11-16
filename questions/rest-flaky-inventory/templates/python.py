#!/bin/python3

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = os.environ.get('API_BASE_URL', 'http://127.0.0.1:8000')

#
# Complete the 'stockByWarehouse' function below.
#
# The function is expected to return a list of [warehouse, total] pairs.
# The function accepts STRING category as parameter.
#
# Stock: GET BASE_URL + '/api/stock?category=<category>&page=<n>'
#

def stockByWarehouse(category):
    # Write your code here
    return []

if __name__ == '__main__':
    category = input().strip()

    result = stockByWarehouse(category)

    print('\n'.join(f'{warehouse} {total}' for warehouse, total in result) if result else 'NONE')
