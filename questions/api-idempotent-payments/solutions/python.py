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

CURRENCIES = {'USD', 'EUR', 'GBP'}

def same(a, b):
    return type(a) is type(b) and a == b

@app.post('/payments')
def create_payment():
    key = request.headers.get('Idempotency-Key')
    if not key:
        return jsonify(error='missing idempotency key'), 400
    if len(key) > 64:
        return jsonify(error='invalid idempotency key'), 400
    body = request.get_json(silent=True)
    if key in responses:
        first = responses[key]
        if isinstance(body, dict) and same(body.get('amount'), first['request']['amount']) and same(body.get('currency'), first['request']['currency']):
            return jsonify(first['body']), first['status']
        return jsonify(error='idempotency key reused with a different payment'), 409
    amount = body.get('amount') if isinstance(body, dict) else None
    currency = body.get('currency') if isinstance(body, dict) else None
    if type(amount) is not int or amount < 1 or not isinstance(currency, str) or currency not in CURRENCIES:
        return jsonify(error='invalid payment'), 400
    payment = {'id': f'pay_{len(payments) + 1}', 'amount': amount, 'currency': currency, 'status': 'captured'}
    payments[payment['id']] = payment
    responses[key] = {'request': {'amount': amount, 'currency': currency}, 'status': 201, 'body': dict(payment)}
    return jsonify(payment), 201

@app.get('/payments')
def summary():
    captured = {}
    for payment in payments.values():
        if payment['status'] == 'captured':
            captured[payment['currency']] = captured.get(payment['currency'], 0) + payment['amount']
    return jsonify(count=len(payments), captured=captured)

@app.get('/payments/<payment_id>')
def get_payment(payment_id):
    payment = payments.get(payment_id)
    if payment is None:
        return jsonify(error='payment not found'), 404
    return jsonify(payment)

@app.post('/payments/<payment_id>/refund')
def refund(payment_id):
    payment = payments.get(payment_id)
    if payment is None:
        return jsonify(error='payment not found'), 404
    if payment['status'] == 'refunded':
        return jsonify(error='payment already refunded'), 409
    payment['status'] = 'refunded'
    return jsonify(payment)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '8000')))
