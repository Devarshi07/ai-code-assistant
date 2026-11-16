"""Writes the test files for Idempotent Payments API: python generator.py
Each input is a list of requests (one JSON object per line). The expected output
comes from a plain-Python model of the API, in the judge's format
(see judge-runners/api_harness.py)."""
import json
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
CURRENCIES = ('USD', 'EUR', 'GBP')


def same(a, b):
    return type(a) is type(b) and a == b


class Payments:
    def __init__(self):
        self.payments, self.responses = {}, {}

    def handle(self, method, path, body, headers):
        parts = path.strip('/').split('/')
        if method == 'POST' and parts == ['payments']:
            key = headers.get('Idempotency-Key')
            if not key:
                return 400, {'error': 'missing idempotency key'}
            if len(key) > 64:
                return 400, {'error': 'invalid idempotency key'}
            if key in self.responses:
                first = self.responses[key]
                if isinstance(body, dict) and same(body.get('amount'), first['request']['amount']) and same(body.get('currency'), first['request']['currency']):
                    return first['status'], dict(first['body'])
                return 409, {'error': 'idempotency key reused with a different payment'}
            amount = body.get('amount') if isinstance(body, dict) else None
            currency = body.get('currency') if isinstance(body, dict) else None
            if type(amount) is not int or amount < 1 or not isinstance(currency, str) or currency not in CURRENCIES:
                return 400, {'error': 'invalid payment'}
            payment = {'id': f'pay_{len(self.payments) + 1}', 'amount': amount, 'currency': currency, 'status': 'captured'}
            self.payments[payment['id']] = payment
            self.responses[key] = {'request': {'amount': amount, 'currency': currency}, 'status': 201, 'body': dict(payment)}
            return 201, dict(payment)
        if method == 'GET' and parts == ['payments']:
            captured = {}
            for p in self.payments.values():
                if p['status'] == 'captured':
                    captured[p['currency']] = captured.get(p['currency'], 0) + p['amount']
            return 200, {'count': len(self.payments), 'captured': captured}
        payment = self.payments.get(parts[1])
        if payment is None:
            return 404, {'error': 'payment not found'}
        if method == 'GET':
            return 200, dict(payment)
        if payment['status'] == 'refunded':
            return 409, {'error': 'payment already refunded'}
        payment['status'] = 'refunded'
        return 200, dict(payment)


def render(body):
    return '-' if body is None else json.dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def write(index, requests):
    tests = HERE / 'tests'
    tests.mkdir(exist_ok=True)
    model, lines = Payments(), []
    for n, request in enumerate(requests, 1):
        status, body = model.handle(request['method'], request['path'], request.get('body'), request.get('headers', {}))
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


def pay(key, amount, currency='EUR', body=None):
    request = {'method': 'POST', 'path': '/payments', 'body': body if body is not None else {'amount': amount, 'currency': currency}}
    if key is not None:
        request['headers'] = {'Idempotency-Key': key}
    return request


def get(payment_id=None):
    return {'method': 'GET', 'path': '/payments' if payment_id is None else f'/payments/{payment_id}'}


def refund(payment_id):
    return {'method': 'POST', 'path': f'/payments/{payment_id}/refund'}


BAD_BODIES = [{'amount': 0, 'currency': 'EUR'}, {'amount': -5, 'currency': 'USD'}, {'amount': 12.5, 'currency': 'GBP'}, {'amount': '100', 'currency': 'EUR'}, {'amount': True, 'currency': 'EUR'},
              {'amount': 100, 'currency': 'JPY'}, {'amount': 100, 'currency': 'eur'}, {'amount': 100}, {'currency': 'USD'}, {'amount': 5, 'currency': ['USD']}, [100, 'EUR']]


def random_requests(rng, n):
    keys = [f'key-{i}' for i in range(12)]
    used = []
    requests = []
    for _ in range(n):
        roll = rng.random()
        if roll < 0.45:
            key = rng.choice(keys + [None, '', 'k' * 65, 'k' * 64])
            if used and rng.random() < 0.35:
                key, amount, currency = rng.choice(used)
                if rng.random() < 0.4:
                    amount += rng.choice([1, -1])
                requests.append(pay(key, amount, currency))
            elif rng.random() < 0.2:
                requests.append(pay(key, 0, body=rng.choice(BAD_BODIES)))
            else:
                amount, currency = rng.randint(1, 50000), rng.choice(CURRENCIES)
                requests.append(pay(key, amount, currency))
                if key:
                    used.append((key, amount, currency))
        elif roll < 0.65:
            requests.append(refund(rng.choice([f'pay_{rng.randint(1, 10)}', 'pay_x'])))
        elif roll < 0.85:
            requests.append(get(rng.choice([f'pay_{rng.randint(1, 10)}', 'nope'])))
        else:
            requests.append(get())
    return requests


rng = random.Random(2026)
write(0, [pay('k1', 1250, 'EUR'), pay('k1', 1250, 'EUR'), get(), pay('k1', 999, 'EUR'), pay('k2', 999, 'USD'), get()])
write(1, [pay(None, 500, 'GBP'), pay('k7', 500, 'GBP'), refund('pay_1'), pay('k7', 500, 'GBP'), get('pay_1'), refund('pay_1'), get()])
write(2, [get(), get('pay_1'), refund('pay_1'), pay('', 10, 'USD'), pay('k' * 65, 10, 'USD'), pay('k' * 64, 10, 'USD')])
write(3, [pay(f'bad-{i}', 0, body=body) for i, body in enumerate(BAD_BODIES)] + [pay('bad-0', 10, 'USD'), get()])
write(4, [pay('a', 100, 'USD'), pay('a', 100, 'EUR'), pay('a', 101, 'USD'), pay('a', 0, body={'amount': 100, 'currency': 'USD', 'note': 'retry'}), pay('a', 0, body=['retry']), get()])
write(5, [pay('x', 300, 'EUR'), pay('y', 300, 'EUR'), refund('pay_2'), pay('y', 300, 'EUR'), get('pay_2'), pay('z', 50, 'GBP'), refund('pay_3'), refund('pay_3'), get()])
write(6, random_requests(rng, 50))
write(7, random_requests(rng, 150))
write(8, random_requests(rng, 150))
sync_samples(2)
print('wrote 9 tests')
