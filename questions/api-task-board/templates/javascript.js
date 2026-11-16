'use strict';

const express = require('express');

const app = express();
app.use(express.json());

// In-memory storage. A fresh app starts for every test case.
const tasks = new Map();
let nextId = 1;

/*
 * Complete the endpoints below. Each one should answer with a status code
 * and a JSON body, for example: res.status(201).json(task)
 */

app.post('/tasks', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.get('/tasks', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.get('/tasks/:id', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.patch('/tasks/:id', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.delete('/tasks/:id', (req, res) => {
    // Write your code here
    res.status(501).json({error: 'not implemented'});
});

app.listen(Number(process.env.PORT || 8000), '127.0.0.1');
