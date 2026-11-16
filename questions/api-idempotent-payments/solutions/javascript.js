'use strict';

const express = require('express');

const app = express();
app.use(express.json());

// In-memory storage. A fresh app starts for every test case.
const payments = new Map();   // id -> payment
const responses = new Map();  // Idempotency-Key -> what the first request was answered

/*
 * Complete the endpoints below. Each one should answer with a status code
 * and a JSON body, for example: res.status(201).json(payment)
 */

const CURRENCIES = new Set(['USD', 'EUR', 'GBP']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

app.post('/payments', (req, res) => {
    const key = req.get('Idempotency-Key');
    if (!key) return res.status(400).json({error: 'missing idempotency key'});
    if (key.length > 64) return res.status(400).json({error: 'invalid idempotency key'});
    const body = req.body;
    if (responses.has(key)) {
        const first = responses.get(key);
        if (isObject(body) && body.amount === first.request.amount && body.currency === first.request.currency) return res.status(first.status).json(first.body);
        return res.status(409).json({error: 'idempotency key reused with a different payment'});
    }
    const amount = isObject(body) ? body.amount : undefined;
    const currency = isObject(body) ? body.currency : undefined;
    if (!Number.isInteger(amount) || amount < 1 || !CURRENCIES.has(currency)) return res.status(400).json({error: 'invalid payment'});
    const payment = {id: `pay_${payments.size + 1}`, amount, currency, status: 'captured'};
    payments.set(payment.id, payment);
    responses.set(key, {request: {amount, currency}, status: 201, body: {...payment}});
    res.status(201).json(payment);
});

app.get('/payments', (req, res) => {
    const captured = {};
    for (const payment of payments.values()) if (payment.status === 'captured') captured[payment.currency] = (captured[payment.currency] || 0) + payment.amount;
    res.json({count: payments.size, captured});
});

app.get('/payments/:id', (req, res) => {
    const payment = payments.get(req.params.id);
    if (!payment) return res.status(404).json({error: 'payment not found'});
    res.json(payment);
});

app.post('/payments/:id/refund', (req, res) => {
    const payment = payments.get(req.params.id);
    if (!payment) return res.status(404).json({error: 'payment not found'});
    if (payment.status === 'refunded') return res.status(409).json({error: 'payment already refunded'});
    payment.status = 'refunded';
    res.json(payment);
});

app.listen(Number(process.env.PORT || 8000), '127.0.0.1');
