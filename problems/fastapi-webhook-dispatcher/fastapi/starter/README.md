# Relay: webhook dispatcher

Relay delivers the platform's webhooks. Internal services (billing, orders,
shipping) **publish** events to Relay; customers **subscribe** HTTPS endpoints
to the event types they care about; Relay creates one **delivery** per matching
subscription and a worker sends it, signed with that subscription's secret.

```
producer --signed POST /events--> Relay --creates--> deliveries --dispatch--> subscriber URLs
```

## Running it

```
python demo.py                               # publishes a few events against scripted subscribers
python -m unittest discover -s tests -v      # the tests
```

## Layout

| Path | What it holds |
| --- | --- |
| `app/main.py` | `create_app(settings, clock, transport)`: wires everything; tests inject a `FakeClock` and a `ScriptedTransport`. |
| `app/routers/` | `subscriptions.py`, `events.py` (signed ingest), `deliveries.py` (delivery detail, `POST /dispatch`). |
| `app/services/events.py` | `EventService.publish`: stores an event and fans it out into deliveries. |
| `app/services/dispatcher.py` | `Dispatcher.dispatch_due`: sends due deliveries and records each attempt. |
| `app/services/retry.py` | `RetryPolicy`: which failures are retried and how long to wait. |
| `app/services/subscriptions.py` | Subscription rules. |
| `app/signatures.py` | Signing and verifying `X-Relay-Signature`. |
| `app/repository.py` | In-memory tables. |
| `app/schemas.py`, `app/errors.py`, `app/dependencies.py` | Models, the error format, FastAPI dependencies. |
| `app/clock.py`, `app/transport.py`, `app/config.py` | Injected time, outbound HTTP, settings. |

`create_app` keeps its services on `app.state` (`subscriptions`, `events`,
`dispatcher`, `clock`, `repo`). Load tests seed data through those services
instead of through thousands of HTTP requests.

## Signatures

Both directions use the same header:

```
X-Relay-Signature: t=1772442000,v1=<hex HMAC-SHA256 of "{t}." + raw body>
```

- Producers sign the **exact bytes** they send to `POST /events` with the ingest secret
  (`Settings.ingest_secret`). Relay must not care how the JSON is formatted.
- `t` must be within `signature_tolerance_seconds` (300) of Relay's clock.
- While a secret is being rotated, a producer sends one `v1=` per secret; the request
  is valid if **any** of them matches. A header with no `v1` signature is invalid.
- Failures are `401` with code `invalid_signature`.

Deliveries to subscribers are signed the same way with the subscription's secret,
and carry `X-Relay-Event` and `X-Relay-Delivery` headers.

## Error format

```json
{"error": {"code": "invalid_signature", "message": "The signature does not match."}}
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `invalid_event_type`, ... | a well-formed request that breaks a rule |
| 401 | `invalid_signature` | ingest request not signed correctly |
| 404 | `not_found` | unknown id or route |
| 409 | conflict codes | conflicts with current state |
| 422 | `validation_error` | body or query failed validation; `fields` maps `body.type`, `query.limit`, ... to messages |

## Endpoints

| Method and path | Result |
| --- | --- |
| `POST /subscriptions` | 201; body `{"url", "events": ["invoice.paid", ...] or ["*"], "secret", "description"?}`; the secret is never returned |
| `GET /subscriptions`, `GET /subscriptions/{id}` | subscriptions |
| `PATCH /subscriptions/{id}` | `{"active": false}` pauses a subscription |
| `POST /events` | signed; 202 `{"event": {...}, "deliveries": n, "duplicate": false}` |
| `GET /events/{id}` | the event |
| `GET /deliveries/{id}` | a delivery with its attempt `history` |
| `POST /dispatch?limit=100` | sends up to `limit` due deliveries; returns counts per outcome |

## Delivery lifecycle

A delivery starts `pending` with `next_attempt_at` = now. The dispatcher sends due
deliveries earliest first (ties by id). A 2xx response makes it `delivered`.
Deliveries for a paused subscription become `cancelled` without being sent.
What happens after a failed attempt (`retried` / `failed` / `dead`) is not built
yet: see `RetryPolicy` and `Dispatcher._after_failure`.
