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

def get_json(url, attempts=5):
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(url) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code != 429:
                raise
            time.sleep(float(error.headers.get('Retry-After') or 1))
    raise RuntimeError(f'still rate limited after {attempts} attempts: {url}')

def stockByWarehouse(category):
    totals, page, pages = {}, 1, 1
    while page <= pages:
        query = urllib.parse.urlencode({'category': category, 'page': page})
        body = get_json(f'{BASE_URL}/api/stock?{query}')
        pages = body['total_pages']
        for record in body['data']:
            totals[record['warehouse']] = totals.get(record['warehouse'], 0) + record['quantity']
        page += 1
    return sorted(([w, t] for w, t in totals.items() if t > 0), key=lambda pair: (-pair[1], pair[0]))

if __name__ == '__main__':
    category = input().strip()

    result = stockByWarehouse(category)

    print('\n'.join(f'{warehouse} {total}' for warehouse, total in result) if result else 'NONE')
