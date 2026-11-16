'use strict';

const express = require('express');

const app = express();
app.use(express.json());

// In-memory storage. A fresh app starts for every test case.
const books = new Map();
let nextId = 1;

/*
 * Complete the endpoints below. Each one should answer with a status code
 * and a JSON body, for example: res.status(201).json(book)
 */

app.post('/books', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.get('/books', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.get('/books/:id', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.listen(Number(process.env.PORT || 8000), '127.0.0.1');
