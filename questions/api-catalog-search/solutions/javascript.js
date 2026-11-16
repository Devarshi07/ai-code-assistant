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

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, longest) => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= longest;

function validBook(body) {
    if (!isObject(body) || !text(body.title, 200) || !text(body.author, 200)) return false;
    if (!Number.isInteger(body.year) || body.year < 1450 || body.year > 2100) return false;
    const tags = 'tags' in body ? body.tags : [];
    return Array.isArray(tags) && tags.length <= 10 && tags.every(tag => typeof tag === 'string' && tag.length >= 1 && tag.length <= 30);
}

function number(query, name, fallback, minimum = 0) {
    const raw = query[name];
    if (raw === undefined) return fallback;
    if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw) || Number(raw) < minimum) throw new Error(name);
    return Number(raw);
}

app.post('/books', (req, res) => {
    const body = req.body;
    if (!validBook(body)) return res.status(400).json({error: 'invalid book'});
    const book = {id: nextId++, title: body.title.trim(), author: body.author.trim(), year: body.year, tags: 'tags' in body ? body.tags : []};
    books.set(book.id, book);
    res.status(201).json(book);
});

app.get('/books', (req, res) => {
    let page, perPage, yearFrom, yearTo;
    try {
        page = number(req.query, 'page', 1, 1);
        perPage = Math.min(number(req.query, 'per_page', 10, 1), 50);
        yearFrom = number(req.query, 'year_from', null);
        yearTo = number(req.query, 'year_to', null);
    } catch {
        return res.status(400).json({error: 'invalid query'});
    }
    const {author, tag} = req.query;
    const matching = [...books.values()].sort((a, b) => a.id - b.id).filter(book =>
        (author === undefined || book.author === author) && (tag === undefined || book.tags.includes(tag)) &&
        (yearFrom === null || book.year >= yearFrom) && (yearTo === null || book.year <= yearTo));
    res.json({page, per_page: perPage, total: matching.length, total_pages: Math.ceil(matching.length / perPage), data: matching.slice((page - 1) * perPage, page * perPage)});
});

app.get('/books/:id', (req, res) => {
    const book = /^[0-9]+$/.test(req.params.id) ? books.get(Number(req.params.id)) : undefined;
    if (!book) return res.status(404).json({error: 'book not found'});
    res.json(book);
});

app.listen(Number(process.env.PORT || 8000), '127.0.0.1');
