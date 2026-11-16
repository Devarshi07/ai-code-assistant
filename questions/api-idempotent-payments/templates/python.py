#!/bin/python3

import os

from flask import Flask, jsonify, request

app = Flask(__name__)

# In-memory storage. A fresh app starts for every test case.
payments = {}      # id -> payment
responses = {}     # Idempotency-Key -> what the first request was answered

#
# Complete the endpoints below. Each one should return a JSON body and a
# status code, for example: return jsonify(payment), 201
#

@app.post('/payments')
def create_payment():
    # Write your code here
    return jsonify(error='not implemented'), 501

@app.get('/payments')
def summary():
    # Write your code here
    return jsonify(error='not implemented'), 501

@app.get('/payments/<payment_id>')
def get_payment(payment_id):
    # Write your code here
    return jsonify(error='not implemented'), 501

@app.post('/payments/<payment_id>/refund')
def refund(payment_id):
    # Write your code here
    return jsonify(error='not implemented'), 501

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '8000')))
