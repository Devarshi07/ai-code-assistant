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

app.post('/payments', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.get('/payments', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.get('/payments/:id', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.post('/payments/:id/refund', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.listen(Number(process.env.PORT || 8000), '127.0.0.1');
