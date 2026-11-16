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

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validTitle = value => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 100;
const validPriority = value => Number.isInteger(value) && value >= 1 && value <= 5;
const find = id => /^[0-9]+$/.test(id) ? tasks.get(Number(id)) : undefined;

app.post('/tasks', (req, res) => {
    const body = req.body;
    if (!isObject(body) || !validTitle(body.title) || ('priority' in body && !validPriority(body.priority))) return res.status(400).json({error: 'invalid task'});
    const task = {id: nextId++, title: body.title.trim(), priority: 'priority' in body ? body.priority : 3, done: false};
    tasks.set(task.id, task);
    res.status(201).json(task);
});

app.get('/tasks', (req, res) => {
    res.json({tasks: [...tasks.values()].sort((a, b) => a.id - b.id)});
});

app.get('/tasks/:id', (req, res) => {
    const task = find(req.params.id);
    if (!task) return res.status(404).json({error: 'task not found'});
    res.json(task);
});

app.patch('/tasks/:id', (req, res) => {
    const task = find(req.params.id);
    if (!task) return res.status(404).json({error: 'task not found'});
    const body = req.body;
    if (!isObject(body) || ('title' in body && !validTitle(body.title)) || ('priority' in body && !validPriority(body.priority)) || ('done' in body && typeof body.done !== 'boolean')) {
        return res.status(400).json({error: 'invalid task'});
    }
    if ('title' in body) task.title = body.title.trim();
    if ('priority' in body) task.priority = body.priority;
    if ('done' in body) task.done = body.done;
    res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
    const task = find(req.params.id);
    if (!task) return res.status(404).json({error: 'task not found'});
    tasks.delete(task.id);
    res.status(204).end();
});

app.listen(Number(process.env.PORT || 8000), '127.0.0.1');
