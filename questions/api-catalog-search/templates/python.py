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

@app.post('/books')
def create_book():
    # Write your code here
    return jsonify(error='not implemented'), 501

@app.get('/books')
def search_books():
    # Write your code here
    return jsonify(error='not implemented'), 501

@app.get('/books/<book_id>')
def get_book(book_id):
    # Write your code here
    return jsonify(error='not implemented'), 501

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '8000')))
