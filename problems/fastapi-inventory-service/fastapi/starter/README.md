# Stockroom inventory API

Stockroom is the back end of the warehouse dashboard used by a small chain of
tea and coffee shops. It tracks the product catalogue, the warehouses that hold
stock, and every movement of stock in or out. Buyers use the low-stock report to
decide what to reorder.

## Running it

```
python demo.py                               # prints a few sample requests and responses
python -m unittest discover -s tests -v      # the tests
uvicorn app.main:app --reload                # local server (not available in the sandbox)
```

## Layout

| Path | What it holds |
| --- | --- |
| `app/main.py` | `create_app()`: builds a fresh app with its own in-memory store and wires routers and error handlers. |
| `app/routers/` | Thin HTTP layer: `products.py`, `warehouses.py`, `stock.py` (movements), `reports.py`. |
| `app/services/inventory.py` | `InventoryService`: every business rule lives here. |
| `app/repository.py` | `InMemoryRepository`: dictionaries standing in for the database tables. |
| `app/schemas.py` | Pydantic v2 request and response models. |
| `app/errors.py` | `ApiError` and the exception handlers that produce the error format below. |
| `app/dependencies.py` | `Inventory`: the dependency that hands a route the app's service. |
| `app/seed.py` | A small sample catalogue used by `demo.py`. |

`create_app()` stores the service on `app.state.inventory`. Scripts and tests
that need a large catalogue call the service directly (`create_product`,
`create_warehouse`, `record_movement`) instead of making thousands of requests.

## Conventions

- Prices are integer cents (`price_cents`), quantities are integers.
- SKUs are upper case, digits and dashes (`TEA-EARL-250`); warehouse ids look like `BOS-1`.
- Lists are sorted by SKU (or warehouse id) unless an endpoint says otherwise.

## Error format

Every error has the same shape and an HTTP status that matches it:

```json
{"error": {"code": "insufficient_stock", "message": "Only 3 of 'KETTLE-GOOSE' in CHI-2.", "details": {"available": 3, "requested": 5}}}
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | varies (`same_warehouse`, `invalid_range`, ...) | the request is well formed but breaks a rule |
| 404 | `not_found` | unknown product, warehouse or route |
| 409 | `duplicate_sku`, `duplicate_warehouse`, `insufficient_stock`, ... | conflicts with current state |
| 422 | `validation_error` | the body or query failed validation; `fields` maps `body.quantity`, `query.page`, ... to a message |

## Endpoints

| Method and path | Result |
| --- | --- |
| `GET /health` | `{"status": "ok"}` |
| `POST /products` | 201, the product |
| `GET /products?category=` | products, by SKU |
| `GET /products/{sku}` | the product |
| `PATCH /products/{sku}` | partial update: only the fields sent change; `description` may be set to `null` to clear it |
| `GET /products/{sku}/stock` | `{"sku", "on_hand", "by_warehouse": {"BOS-1": 30, ...}}` |
| `GET /products/{sku}/movements` | the product's movements, oldest first |
| `POST /warehouses`, `GET /warehouses`, `GET /warehouses/{id}` | warehouses |
| `GET /warehouses/{id}/stock` | `[{"sku", "quantity"}]` for products with stock there |
| `POST /movements` | 201, `{"movement": {...}, "on_hand": n}`; `kind` is `receive` or `ship` |
| `GET /reports/low-stock?category=&limit=50` | active products whose total stock is below `reorder_level`, largest shortfall first |

On the roadmap: stock transfers between warehouses and a product search for the
dashboard (`InventoryService.transfer` and `InventoryService.search_products`
are stubs).
