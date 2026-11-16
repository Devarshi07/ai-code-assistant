"""Writes the test files for Task Board API: python generator.py
Each input is a list of requests (one JSON object per line). The expected output
comes from a plain-Python model of the API, in the judge's format
(see judge-runners/api_harness.py)."""
import json
import random
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent


class TaskBoard:
    def __init__(self):
        self.tasks, self.next_id = {}, 1

    @staticmethod
    def valid_title(value):
        return isinstance(value, str) and 1 <= len(value.strip()) <= 100

    @staticmethod
    def valid_priority(value):
        return type(value) is int and 1 <= value <= 5

    def find(self, raw):
        return self.tasks.get(int(raw)) if re.fullmatch(r'[0-9]+', raw) else None

    def handle(self, method, path, body):
        parts = path.split('?')[0].strip('/').split('/')
        if parts == ['tasks'] and method == 'POST':
            if not isinstance(body, dict) or not self.valid_title(body.get('title')) or ('priority' in body and not self.valid_priority(body['priority'])):
                return 400, {'error': 'invalid task'}
            task = {'id': self.next_id, 'title': body['title'].strip(), 'priority': body.get('priority', 3), 'done': False}
            self.tasks[self.next_id] = task
            self.next_id += 1
            return 201, dict(task)
        if parts == ['tasks'] and method == 'GET':
            return 200, {'tasks': [dict(self.tasks[k]) for k in sorted(self.tasks)]}
        task = self.find(parts[1])
        if task is None:
            return 404, {'error': 'task not found'}
        if method == 'GET':
            return 200, dict(task)
        if method == 'DELETE':
            del self.tasks[task['id']]
            return 204, None
        if (not isinstance(body, dict) or ('title' in body and not self.valid_title(body['title']))
                or ('priority' in body and not self.valid_priority(body['priority'])) or ('done' in body and not isinstance(body['done'], bool))):
            return 400, {'error': 'invalid task'}
        if 'title' in body:
            task['title'] = body['title'].strip()
        for key in ('priority', 'done'):
            if key in body:
                task[key] = body[key]
        return 200, dict(task)


def render(body):
    return '-' if body is None else json.dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def write(index, requests):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    model, lines = TaskBoard(), []
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


def post(body):
    return {'method': 'POST', 'path': '/tasks', 'body': body}


def get(task_id=None):
    return {'method': 'GET', 'path': '/tasks' if task_id is None else f'/tasks/{task_id}'}


def patch(task_id, body):
    return {'method': 'PATCH', 'path': f'/tasks/{task_id}', 'body': body}


def delete(task_id):
    return {'method': 'DELETE', 'path': f'/tasks/{task_id}'}


TITLES = ['Write tests', 'Fix login bug', 'Plan sprint', 'Review PR', 'Update docs', 'Deploy', 'Call vendor']
BAD_BODIES = [{'title': ''}, {'title': '   '}, {'title': 'x' * 101}, {'title': 42}, {'priority': 2}, {'title': 'Ok', 'priority': 0}, {'title': 'Ok', 'priority': 6},
              {'title': 'Ok', 'priority': True}, {'title': 'Ok', 'priority': 2.5}, {'title': 'Ok', 'priority': '3'}, {'title': 'Ok', 'priority': None}, ['Write tests']]


def random_requests(rng, n):
    requests = []
    for _ in range(n):
        roll = rng.random()
        target = rng.choice([rng.randint(1, 12), 'abc', 999])
        if roll < 0.35:
            requests.append(post(rng.choice(BAD_BODIES) if rng.random() < 0.3 else {'title': f'  {rng.choice(TITLES)} {rng.randint(1, 9)} ', **({'priority': rng.randint(1, 5)} if rng.random() < 0.6 else {})}))
        elif roll < 0.5:
            requests.append(get(target))
        elif roll < 0.6:
            requests.append(get())
        elif roll < 0.85:
            changes = rng.choice([{'done': True}, {'done': False}, {'priority': rng.randint(1, 5)}, {'title': rng.choice(TITLES)}, {'done': 'yes'}, {'priority': 7}, {'title': ''},
                                  {'title': 'Renamed', 'priority': 9}, {'owner': 'sam'}, {}, ['done']])
            requests.append(patch(target, changes))
        else:
            requests.append(delete(target))
    return requests


rng = random.Random(2026)
write(0, [post({'title': 'Write tests', 'priority': 2}), post({'title': '  Ship it  '}), get(2), get()])
write(1, [post({'title': ''}), post({'title': 'Fix bug', 'priority': 9}), post({'title': 'Fix bug', 'priority': 5}), patch(1, {'done': True}), delete(1), get(1)])
write(2, [get(), get(1), get('abc'), delete(1), patch(1, {'done': True})])
write(3, [post(body) for body in BAD_BODIES] + [post({'title': 'x' * 100}), get()])
write(4, [post({'title': 'A'}), post({'title': 'B'}), delete(1), delete(1), post({'title': 'C'}), get(), get(3)])
write(5, [post({'title': 'Edit me', 'priority': 1}), patch(1, {'title': 'Renamed', 'priority': 9}), get(1), patch(1, {'title': '  Renamed  ', 'priority': 4, 'done': True, 'owner': 'sam'}),
          patch(1, {}), patch(1, ['done']), patch(1, {'done': 'yes'}), get(1)])
write(6, random_requests(rng, 40))
write(7, random_requests(rng, 120))
write(8, random_requests(rng, 120))
sync_samples(2)
print('wrote 9 tests')
