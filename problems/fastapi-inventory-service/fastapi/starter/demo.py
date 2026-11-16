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
    seed_demo(app.state.inventory)
    client = TestClient(app, raise_server_exceptions=False)

    show(client.get("/products/KETTLE-GOOSE/stock"))
    show(client.patch("/products/KETTLE-GOOSE", json={"price_cents": 5400}))
    show(client.post("/movements", json={"warehouse_id": "CHI-2", "sku": "KETTLE-GOOSE", "kind": "ship", "quantity": 5}))
    show(client.get("/reports/low-stock", params={"limit": 3}))
    show(client.post("/transfers", json={"sku": "MUG-STONE-12", "from_warehouse": "BOS-1",
                                          "to_warehouse": "DEN-1", "quantity": 10}))
    show(client.get("/products/search", params={"category": "tea", "sort": "-price"}))


if __name__ == "__main__":
    main()
