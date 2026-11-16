"""Writes the test files for Catalog Search API: python generator.py
Each input is a list of requests (one JSON object per line). The expected output
comes from a plain-Python model of the API, in the judge's format
(see judge-runners/api_harness.py)."""
import json
import math
import random
import re
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode

HERE = Path(__file__).resolve().parent


class Catalog:
    def __init__(self):
        self.books, self.next_id = {}, 1

    @staticmethod
    def valid(body):
        text = lambda v: isinstance(v, str) and 1 <= len(v.strip()) <= 200
        if not isinstance(body, dict) or not text(body.get('title')) or not text(body.get('author')):
            return False
        if type(body.get('year')) is not int or not 1450 <= body['year'] <= 2100:
            return False
        tags = body.get('tags', [])
        return isinstance(tags, list) and len(tags) <= 10 and all(isinstance(t, str) and 1 <= len(t) <= 30 for t in tags)

    def handle(self, method, path, body):
        route, _, query = path.partition('?')
        parts = route.strip('/').split('/')
        if method == 'POST':
            if not self.valid(body):
                return 400, {'error': 'invalid book'}
            book = {'id': self.next_id, 'title': body['title'].strip(), 'author': body['author'].strip(), 'year': body['year'], 'tags': body.get('tags', [])}
            self.books[self.next_id] = book
            self.next_id += 1
            return 201, book
        if len(parts) == 2:
            book = self.books.get(int(parts[1])) if re.fullmatch(r'[0-9]+', parts[1]) else None
            return (200, book) if book else (404, {'error': 'book not found'})
        args = dict(parse_qsl(query, keep_blank_values=True))

        def number(name, default, minimum=0):
            raw = args.get(name)
            if raw is None:
                return default
            if not re.fullmatch(r'[0-9]+', raw) or int(raw) < minimum:
                raise ValueError(name)
            return int(raw)
        try:
            page, per_page = number('page', 1, 1), min(number('per_page', 10, 1), 50)
            year_from, year_to = number('year_from', None), number('year_to', None)
        except ValueError:
            return 400, {'error': 'invalid query'}
        matching = [b for _, b in sorted(self.books.items())
                    if ('author' not in args or b['author'] == args['author']) and ('tag' not in args or args['tag'] in b['tags'])
                    and (year_from is None or b['year'] >= year_from) and (year_to is None or b['year'] <= year_to)]
        return 200, {'page': page, 'per_page': per_page, 'total': len(matching), 'total_pages': math.ceil(len(matching) / per_page), 'data': matching[(page - 1) * per_page:page * per_page]}


def render(body):
    return '-' if body is None else json.dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def write(index, requests):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    model, lines = Catalog(), []
    for n, request in enumerate(requests, 1):
        status, body = model.handle(request['method'], request['path'], request.get('body'))
        lines.append(f"{n}. {request['method']} {request['path']} -> {status} {render(body)}")
    (tests / f'input{index:02d}.txt').write_text(''.join(json.dumps(r) + '\n' for r in requests), encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def add(title, author, year, tags=None):
    return {'method': 'POST', 'path': '/books', 'body': {'title': title, 'author': author, 'year': year, **({'tags': tags} if tags is not None else {})}}


def search(**params):
    return {'method': 'GET', 'path': '/books' + ('?' + urlencode(params, quote_via=quote) if params else '')}


def get(book_id):
    return {'method': 'GET', 'path': f'/books/{book_id}'}


AUTHORS = ['Ursula Le Guin', 'Frank Herbert', 'Jane Austen', 'Octavia Butler', 'Ted Chiang', 'jane austen']
TAGS = ['sci-fi', 'classic', 'romance', 'short-stories', 'award', 'space']
BAD = [{'title': 'X', 'author': 'Y', 'year': 1300}, {'title': '', 'author': 'Y', 'year': 2000}, {'title': 'X', 'author': '   ', 'year': 2000}, {'title': 'X', 'author': 'Y', 'year': '2000'},
       {'title': 'X', 'author': 'Y', 'year': 2000, 'tags': 'sci-fi'}, {'title': 'X', 'author': 'Y', 'year': 2000, 'tags': [''] }, {'title': 'X', 'author': 'Y', 'year': 2000, 'tags': ['t'] * 11},
       {'title': 'X', 'author': 'Y', 'year': True}, {'title': 'X', 'author': 'Y'}, {'title': 'X', 'author': 'Y', 'year': 2000, 'tags': [1]}, ['Dune']]


def random_requests(rng, n_books, n_queries):
    requests = []
    for _ in range(n_books):
        if rng.random() < 0.15:
            requests.append({'method': 'POST', 'path': '/books', 'body': rng.choice(BAD)})
        else:
            requests.append(add(f' Book {rng.randint(1, 999)} ', rng.choice(AUTHORS), rng.randint(1450, 2100), rng.sample(TAGS, rng.randint(0, 3))))
    for _ in range(n_queries):
        params = {}
        if rng.random() < 0.4:
            params['author'] = rng.choice(AUTHORS)
        if rng.random() < 0.4:
            params['tag'] = rng.choice(TAGS)
        if rng.random() < 0.3:
            params['year_from'] = str(rng.randint(1450, 2000))
        if rng.random() < 0.3:
            params['year_to'] = str(rng.randint(1800, 2100))
        if rng.random() < 0.6:
            params['page'] = rng.choice(['1', '2', '3', '7', '0', 'x'])
        if rng.random() < 0.6:
            params['per_page'] = rng.choice(['1', '5', '10', '50', '80', '0', '-3'])
        if rng.random() < 0.1:
            params['sort'] = 'year'
        requests.append(search(**params) if rng.random() < 0.85 else get(rng.choice([rng.randint(1, n_books), 'abc', n_books + 5])))
    return requests


rng = random.Random(2026)
write(0, [add('Dune', 'Frank Herbert', 1965, ['sci-fi']), add('Emma', 'Jane Austen', 1815, ['classic']), add('Children of Dune', 'Frank Herbert', 1976, ['sci-fi', 'classic']),
          search(author='Frank Herbert', per_page='1', page='2')])
write(1, [add('Old Tale', 'Anon', 1300), add('Emma', 'Jane Austen', 1815, ['classic', 'romance']), add('Dune', 'Frank Herbert', 1965, ['sci-fi', 'classic']),
          search(tag='classic', year_to='1900'), search(page='0'), get(9)])
write(2, [search(), get(1), search(author='Nobody', page='3'), get('abc')])
write(3, [{'method': 'POST', 'path': '/books', 'body': body} for body in BAD] + [add(' Trimmed ', ' Ted Chiang ', 2002, ['t' * 30] * 10), search(author='Ted Chiang')])
write(4, [add(f'Vol {i}', 'Octavia Butler', 1980 + i, ['space'] if i % 2 else []) for i in range(1, 56)] + [search(per_page='80'), search(per_page='50', page='2'), search(tag='space', page='3', per_page='10'), search(page='9')])
write(5, [add('A', 'Jane Austen', 1811), add('B', 'jane austen', 1813), search(author='jane austen'), search(year_from='1812', year_to='1811'), search(year_from='abc'), search(year_to='-1'), search(sort='title', page='1')])
write(6, random_requests(rng, 30, 20))
write(7, random_requests(rng, 90, 60))
write(8, random_requests(rng, 100, 50))
sync_samples(2)
print('wrote 9 tests')
