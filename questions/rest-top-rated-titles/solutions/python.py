#!/bin/python3

import json
import os
import sys
import urllib.parse
import urllib.request

BASE_URL = os.environ.get('API_BASE_URL', 'http://127.0.0.1:8000')

#
# Complete the 'topRated' function below.
#
# The function is expected to return a STRING_ARRAY.
# The function accepts following parameters:
#  1. STRING genre
#  2. INTEGER minYear
#  3. INTEGER k
#
# Movies: GET BASE_URL + '/api/movies?genre=<genre>&page=<n>'
#

def topRated(genre, minYear, k):
    movies, page, pages = [], 1, 1
    while page <= pages:
        query = urllib.parse.urlencode({'genre': genre, 'page': page})
        with urllib.request.urlopen(f'{BASE_URL}/api/movies?{query}') as response:
            body = json.load(response)
        pages = body['total_pages']
        movies += [m for m in body['data'] if m['year'] >= minYear]
        page += 1
    movies.sort(key=lambda m: (-m['rating'], m['title']))
    return [m['title'] for m in movies[:k]]

if __name__ == '__main__':
    genre = input().strip()

    minYear = int(input().strip())

    k = int(input().strip())

    result = topRated(genre, minYear, k)

    print('\n'.join(result) if result else 'NONE')
