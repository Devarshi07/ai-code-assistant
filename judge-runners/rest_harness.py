"""Serves a paginated JSON API on 127.0.0.1 and runs a REST-client program against it.

stdin: the program's own input, then a line '--- api data ---', then the API's
data as JSON:  {"per_page": 10, "throttle": "first", "resources": {"orders": [...]}}
argv:  the command that runs the candidate's program.

GET /api/<resource>?page=N&field=value returns
  {"page": N, "per_page": P, "total": T, "total_pages": ceil(T / P), "data": [...]}
where every query parameter other than page and per_page keeps the records whose
field equals the value. With "throttle": "first", the first request for each URL
(ignoring parameter order) gets 429 with Retry-After: 0. The program receives
API_BASE_URL in its environment and only the lines before the marker on stdin.
"""
import json
import math
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qsl, urlsplit

MARKER = '--- api data ---'


def split_input(raw):
    lines = raw.split('\n')
    if MARKER not in lines:
        return raw, {}
    cut = lines.index(MARKER)
    own = '\n'.join(lines[:cut])
    if own and not own.endswith('\n'):
        own += '\n'
    data = '\n'.join(lines[cut + 1:]).strip()
    return own, (json.loads(data) if data else {})


def token(value):
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if value is None:
        return 'null'
    return str(value)


def make_handler(fixture):
    resources = fixture.get('resources', {})
    per_page = int(fixture.get('per_page', 10))
    seen, lock = set(), threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(self, status, body, headers=None):
            payload = json.dumps(body).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            url = urlsplit(self.path)
            parts = [part for part in url.path.split('/') if part]
            records = resources.get(parts[1]) if len(parts) == 2 and parts[0] == 'api' else None
            if not isinstance(records, list):
                return self.send(404, {'error': 'not found'})
            params = parse_qsl(url.query, keep_blank_values=True)
            if fixture.get('throttle') == 'first':
                key = parts[1] + '?' + '&'.join(sorted(f'{k}={v}' for k, v in params))
                with lock:
                    first = key not in seen
                    seen.add(key)
                if first:
                    return self.send(429, {'error': 'rate limit exceeded, retry after 0 seconds'}, {'Retry-After': '0'})
            page_text = next((v for k, v in params if k == 'page'), '1')
            if not page_text.isdigit() or int(page_text) < 1:
                return self.send(400, {'error': 'page must be a positive integer'})
            page = int(page_text)
            filters = [(k, v) for k, v in params if k not in ('page', 'per_page')]
            matching = [r for r in records if all(token(r.get(k)) == v for k, v in filters)]
            total = len(matching)
            self.send(200, {'page': page, 'per_page': per_page, 'total': total, 'total_pages': math.ceil(total / per_page),
                            'data': matching[(page - 1) * per_page:page * per_page]})

        def do_POST(self):
            self.send(405, {'error': 'method not allowed'})

        do_PUT = do_PATCH = do_DELETE = do_POST

    return Handler


def main():
    own, fixture = split_input(sys.stdin.read())
    server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(fixture))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    env = dict(os.environ, API_BASE_URL=f'http://127.0.0.1:{server.server_address[1]}')
    result = subprocess.run(sys.argv[1:], input=own.encode('utf-8'), env=env)
    server.shutdown()
    sys.exit(result.returncode if result.returncode >= 0 else 1)


if __name__ == '__main__':
    main()
