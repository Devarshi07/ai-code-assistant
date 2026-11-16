"""Writes the test files for Top Rated Titles: python generator.py
Each input is the genre, minYear and k, the '--- api data ---' marker, then the
movies the judge's mock API serves (see judge-runners/rest_harness.py)."""
import json
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
MARKER = '--- api data ---'
GENRES = ['Drama', 'Comedy', 'Horror', 'Science Fiction', 'Documentary', 'drama']
WORDS = ['Night', 'Train', 'Blue', 'Hour', 'Atlas', 'Harbor', 'Glass', 'river', 'Echo', 'Last', 'paper', 'Moon', 'Iron', 'Garden', 'Signal', 'quiet', 'Storm', 'Zero']


def api_text(fixture):
    head = ''.join(f'  {json.dumps(k)}: {json.dumps(v)},\n' for k, v in fixture.items() if k != 'resources')
    blocks = []
    for name, records in fixture['resources'].items():
        rows = ',\n'.join('      ' + json.dumps(r, ensure_ascii=False) for r in records)
        blocks.append(f'    {json.dumps(name)}: [\n{rows}\n    ]' if records else f'    {json.dumps(name)}: []')
    return '{\n' + head + '  "resources": {\n' + ',\n'.join(blocks) + '\n  }\n}\n'


def write(index, genre, min_year, k, per_page, movies):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    records = [{'id': i, 'title': t, 'genre': g, 'year': y, 'rating': r} for i, (t, g, y, r) in enumerate(movies, 1)]
    text = f'{genre}\n{min_year}\n{k}\n{MARKER}\n' + api_text({'per_page': per_page, 'resources': {'movies': records}})
    picked = sorted((m for m in records if m['genre'] == genre and m['year'] >= min_year), key=lambda m: (-m['rating'], m['title']))[:k]
    answer = '\n'.join(m['title'] for m in picked) if picked else 'NONE'
    (tests / f'input{index:02d}.txt').write_text(text, encoding='utf-8', newline='\n')
    (tests / f'output{index:02d}.txt').write_text(answer + '\n', encoding='utf-8', newline='\n')


def sync_samples(count):
    path = HERE / 'question.json'
    question = json.loads(path.read_text(encoding='utf-8'))
    for i in range(count):
        question['samples'][i]['input'] = (HERE / 'tests' / f'input{i:02d}.txt').read_text(encoding='utf-8')
        question['samples'][i]['output'] = (HERE / 'tests' / f'output{i:02d}.txt').read_text(encoding='utf-8')
    path.write_text(json.dumps(question, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def random_movies(rng, n, focus, coarse=False):
    movies, titles = [], set()
    while len(movies) < n:
        genre = focus if rng.random() < 0.4 else rng.choice(GENRES)
        title = f'{rng.choice(WORDS)} {rng.choice(WORDS)} {rng.randint(1, 99)}'
        if (genre, title) in titles:
            continue
        titles.add((genre, title))
        rating = rng.choice([7.0, 7.5, 8.0]) if coarse else round(rng.uniform(0, 10), 1)
        movies.append((title, genre, rng.randint(1950, 2030), rating))
    return movies


rng = random.Random(2026)
write(0, 'Drama', 2015, 3, 4, [('Night Train', 'Drama', 2019, 8.1), ('Big Laugh', 'Comedy', 2020, 9.5), ('Blue Hour', 'Drama', 2016, 7.4), ('Old Harbor', 'Drama', 2009, 9.0),
                               ('Atlas', 'Drama', 2021, 7.4), ('Small Rooms', 'Drama', 2015, 6.8)])
write(1, 'Horror', 2020, 5, 2, [('alpha', 'Horror', 2021, 6.0), ('Old Crypt', 'Horror', 2010, 7.0), ('Zed', 'Horror', 2022, 6.0), ('Fun Run', 'Comedy', 2023, 8.0)])
write(2, 'Documentary', 2000, 3, 5, [('Night Train', 'Drama', 2019, 8.1)])
write(3, 'Science Fiction', 2030, 2, 3, [('Iron Moon', 'Science Fiction', 2029, 9.9), ('Zero Signal', 'Science Fiction', 2030, 1.0), ('Echo', 'Science Fiction', 2030, 1.0)])
write(4, 'Drama', 1950, 50, 1, random_movies(rng, 30, 'Drama'))
write(5, 'Comedy', 1990, 10, 6, random_movies(rng, 400, 'Comedy', coarse=True))
write(6, 'Science Fiction', 2000, 25, 10, random_movies(rng, 3000, 'Science Fiction'))
write(7, 'drama', 1975, 40, 9, random_movies(rng, 3000, 'drama', coarse=True))
sync_samples(2)
print('wrote 8 tests')
