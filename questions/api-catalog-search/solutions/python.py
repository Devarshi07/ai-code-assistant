#!/bin/python3

import math
import os
import re

from flask import Flask, jsonify, request

app = Flask(__name__)

# In-memory storage. A fresh app starts for every test case.
books = {}
next_id = 1

#
# Complete the endpoints below. Each one should return a JSON body and a
# status code, for example: return jsonify(book), 201
#

def text(value, longest):
    return isinstance(value, str) and 1 <= len(value.strip()) <= longest

def valid_book(body):
    if not isinstance(body, dict) or not text(body.get('title'), 200) or not text(body.get('author'), 200):
        return False
    year = body.get('year')
    if type(year) is not int or not 1450 <= year <= 2100:
        return False
    tags = body.get('tags', [])
    return isinstance(tags, list) and len(tags) <= 10 and all(isinstance(t, str) and 1 <= len(t) <= 30 for t in tags)

def number(name, default, minimum=0):
    raw = request.args.get(name)
    if raw is None:
        return default
    if not re.fullmatch(r'[0-9]+', raw) or int(raw) < minimum:
        raise ValueError(name)
    return int(raw)

@app.post('/books')
def create_book():
    global next_id
    body = request.get_json(silent=True)
    if not valid_book(body):
        return jsonify(error='invalid book'), 400
    book = {'id': next_id, 'title': body['title'].strip(), 'author': body['author'].strip(), 'year': body['year'], 'tags': body.get('tags', [])}
    books[next_id] = book
    next_id += 1
    return jsonify(book), 201

@app.get('/books')
def search_books():
    try:
        page = number('page', 1, 1)
        per_page = min(number('per_page', 10, 1), 50)
        year_from = number('year_from', None)
        year_to = number('year_to', None)
    except ValueError:
        return jsonify(error='invalid query'), 400
    author, tag = request.args.get('author'), request.args.get('tag')
    matching = [b for _, b in sorted(books.items())
                if (author is None or b['author'] == author) and (tag is None or tag in b['tags'])
                and (year_from is None or b['year'] >= year_from) and (year_to is None or b['year'] <= year_to)]
    return jsonify(page=page, per_page=per_page, total=len(matching), total_pages=math.ceil(len(matching) / per_page),
                   data=matching[(page - 1) * per_page:page * per_page])

@app.get('/books/<book_id>')
def get_book(book_id):
    book = books.get(int(book_id)) if re.fullmatch(r'[0-9]+', book_id) else None
    if book is None:
        return jsonify(error='book not found'), 404
    return jsonify(book)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '8000')))
