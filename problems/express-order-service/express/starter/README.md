# Corner Pantry: orders API

The orders service behind the Corner Pantry grocery delivery app. The mobile
app uses it to show products, place orders, look orders up and cancel them.
The support dashboard uses it to browse orders.

It is a plain Express 4 app with no database: `src/store/memory-store.js`
stands in for one. Every store call is asynchronous and takes a little time,
like a real database round trip.

## Layout

```
src/
  app.js                 createApp({store, now}): builds the app, does not listen
  server.js              listens on PORT (default 3000)
  errors.js              AppError and its subclasses -> JSON error bodies
  validation.js          checks POST /orders bodies
  routes/                URL -> controller method
  controllers/           request in, status code and JSON out
  services/              business rules (orders, products, pricing)
  store/                 the in-memory "database" and sample data
  middleware/            request ids, async errors, the error handler
demo.js                  starts the app on a free port and makes a few requests
tests/                   node:test suites, one per phase
```

Run the tests with `node --test` and the demo with `node demo.js`.

## Conventions

- Money is integer cents. Delivery costs 399 cents unless the subtotal is
  3500 cents or more, then it is free.
- Every error response is JSON:
  `{"error": {"code": "...", "message": "...", "fields": {...}}}`, where
  `fields` only appears on validation errors.

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `invalid_json` | the body is not valid JSON |
| 404 | `not_found` | an unknown route, order id or product sku |
| 409 | `out_of_stock` | a line asks for more than is in stock |
| 409 | `already_shipped` | cancelling a shipped order |
| 422 | `validation_error` | a field breaks a rule; `fields` says which |
| 500 | `internal_error` | a bug; the message never leaks details |

## Endpoints

### `GET /products`, `GET /products/:sku`

`{"data": [product, ...]}` and a single product
`{"sku", "name", "priceCents", "stock"}`.

### `POST /orders`

```json
{"customerId": "cus_ana", "items": [{"sku": "sourdough", "quantity": 2}]}
```

`customerId` looks like `cus_` plus lowercase letters, digits or `_`. `items`
has 1 to 50 lines, each sku at most once, each quantity a whole number from 1
to 99. An unknown sku is a 422 with `fields["items[i].sku"]`.

The order is all or nothing: if any line is short on stock, the response is
409 `out_of_stock` and no stock is taken.

Success is **201 Created** with a `Location: /orders/<id>` header and the order:

```json
{
  "id": "ord_00006", "customerId": "cus_ana", "status": "pending",
  "items": [{"sku": "sourdough", "name": "Sourdough loaf", "quantity": 2,
             "unitPriceCents": 525, "lineTotalCents": 1050}],
  "subtotalCents": 1050, "deliveryCents": 399, "totalCents": 1449,
  "createdAt": "2026-03-05T10:00:00.000Z"
}
```

Statuses are `pending`, `paid`, `shipped` and `cancelled`.

### `GET /orders/:id`

The order, or 404 `not_found`.

### `POST /orders/:id/cancel`

Cancels the order and puts its stock back. Cancelling a cancelled order
returns it unchanged. A shipped order cannot be cancelled: 409
`already_shipped`.

### `GET /orders`

The support dashboard's order list. Not built yet; it currently fails with a
500.
