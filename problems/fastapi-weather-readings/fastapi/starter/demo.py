"""Sends a few requests to an in-process app and prints the responses."""
import json

from fastapi.testclient import TestClient

from app.main import create_app
from app.seed import seed_demo


def show(response) -> None:
    request = response.request
    query = "?" + request.url.query.decode() if request.url.query else ""
    print(f"{request.method} {request.url.path}{query} -> {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2)[:900])
    except ValueError:
        print(response.text[:200])
    print()


def main() -> None:
    app = create_app()
    seed_demo(app.state.stations, app.state.readings)
    client = TestClient(app, raise_server_exceptions=False)
    late = {"timestamp": "2025-03-10T22:30:00-08:00", "temperature": 2.0, "humidity": 80}

    show(client.get("/stations/harbor-02/readings"))
    show(client.post("/stations/ridge-01/readings", json=late))
    show(client.get("/stations/ridge-01/daily", params={"from": "2025-03-10", "to": "2025-03-11"}))
    show(client.post("/stations/ridge-01/readings", json=late))
    show(client.get("/stations/ridge-01/daily", params={"from": "2025-03-12", "to": "2025-03-01"}))
    show(client.get("/stations/nowhere-99/daily", params={"from": "2025-03-01", "to": "2025-03-02"}))


if __name__ == "__main__":
    main()
