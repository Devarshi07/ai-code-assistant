"""Sends a few requests to an in-process app and prints the responses."""
import json

from fastapi.testclient import TestClient

from app.main import create_app
from app.seed import seed_demo


def show(response) -> None:
    request = response.request
    print(f"{request.method} {request.url.path}{'?' + request.url.query.decode() if request.url.query else ''}"
          f" -> {response.status_code}")
    print(json.dumps(response.json(), indent=2)[:900])
    print()


def main() -> None:
    app = create_app()
    seed_demo(app.state.flags)
    client = TestClient(app, raise_server_exceptions=False)

    show(client.get("/flags/new-checkout/check", params={"user_id": "user-1"}))
    show(client.patch("/flags/dark-mode", json={"rollout_percent": 10}))
    show(client.post("/evaluate", json={"user_id": "user-1", "attributes": {"country": "DE", "plan": "pro", "age": 31}}))
    show(client.post("/evaluate", json={"user_id": "user-2", "attributes": {"country": "US", "plan": "free", "age": 16}}))
    show(client.post("/flags", json={"key": "dark-mode"}))
    show(client.get("/flags/does-not-exist"))


if __name__ == "__main__":
    main()
