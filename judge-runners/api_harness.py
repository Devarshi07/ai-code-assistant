"""Starts a candidate's web app and replays a test's requests against it.

stdin: one JSON request per line: {"method": "POST", "path": "/tasks", "body": {...}, "headers": {...}}
argv:  the command that starts the app. The app gets PORT in its environment
       and must listen on 127.0.0.1 at that port.
Prints one line per request:  "<n>. <METHOD> <path> -> <status> <body>"
where the body is canonical JSON (sorted keys, no spaces), a JSON string if the
response isn't JSON, or "-" if it is empty. The app's own output goes to stderr.
"""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

START_SECONDS = 8


class NoRedirects(urllib.request.HTTPRedirectHandler):
    """Reports a redirect as its own response, as fetch(redirect: 'manual') does."""
    def redirect_request(self, *args, **kwargs):
        return None


OPENER = urllib.request.build_opener(NoRedirects)


def free_port():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        return probe.getsockname()[1]


def render(raw):
    text = raw.decode('utf-8', 'replace').strip()
    if not text:
        return '-'
    try:
        return json.dumps(json.loads(text), sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    except ValueError:
        return json.dumps(text, ensure_ascii=False)


def wait_until_listening(app, port):
    # A monotonic clock: Docker's VM resyncs its wall clock, which can jump seconds.
    deadline = time.monotonic() + START_SECONDS
    while True:
        if app.poll() is not None:
            print(f'Your app exited before it accepted connections (exit code {app.returncode}).', file=sys.stderr)
            sys.exit(1)
        try:
            socket.create_connection(('127.0.0.1', port), timeout=0.2).close()
            return
        except OSError:
            if time.monotonic() > deadline:
                print(f'Your app did not start listening on 127.0.0.1:{port} (the PORT variable) within {START_SECONDS} seconds.', file=sys.stderr)
                app.kill()
                sys.exit(1)
            time.sleep(0.05)


def main():
    requests = [json.loads(line) for line in sys.stdin.read().splitlines() if line.strip()]
    port = free_port()
    app = subprocess.Popen(sys.argv[1:], env=dict(os.environ, PORT=str(port)), stdin=subprocess.DEVNULL, stdout=sys.stderr, stderr=sys.stderr)
    try:
        wait_until_listening(app, port)
        for number, request in enumerate(requests, 1):
            method, path = request.get('method', 'GET').upper(), request['path']
            body = request.get('body')
            headers = {**({'Content-Type': 'application/json'} if 'body' in request else {}), **request.get('headers', {})}
            data = json.dumps(body).encode('utf-8') if 'body' in request else None
            try:
                with OPENER.open(urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=data, method=method, headers=headers), timeout=5) as response:
                    status, raw = response.status, response.read()
            except urllib.error.HTTPError as error:
                status, raw = error.code, error.read()
            except OSError as error:
                print(f'{number}. {method} {path} -> no response ({type(error).__name__})')
                sys.stdout.flush()
                continue
            print(f'{number}. {method} {path} -> {status} {render(raw)}')
            sys.stdout.flush()
    finally:
        app.kill()
        app.wait()


if __name__ == '__main__':
    main()
