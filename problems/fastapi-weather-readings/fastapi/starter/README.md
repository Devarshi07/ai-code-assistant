# Weather Station API

A network of hobbyist weather stations posts a reading every few minutes:
station id, a timestamp with a UTC offset, temperature (in Celsius or
Fahrenheit), humidity and, for stations that have a barometer, pressure. The
API stores the readings and serves summaries to the public map.

## Running it

```
python demo.py                               # prints a few sample requests and responses
python -m unittest discover -s tests -v      # the tests
uvicorn app.main:app --reload                # local server (not available in the sandbox)
```

## Layout

| Path | What it holds |
| --- | --- |
| `app/main.py` | `create_app(repository=None)`: builds an app with its own in-memory store and wires routers and error handlers. |
| `app/routers/` | Thin HTTP layer: `stations.py`, `readings.py`. |
| `app/services/` | Business rules: `stations.py`, `readings.py` (ingest and summaries), `units.py` (conversion and rounding helpers). |
| `app/repository.py` | `InMemoryRepository`: dictionaries standing in for the database tables. |
| `app/schemas.py` | Pydantic v2 request and response models. |
| `app/errors.py` | `ApiError` and the handlers that produce the error format below. |
| `app/dependencies.py` | `Stations` and `Readings`: the dependencies that hand a route its service. |
| `app/seed.py` | A small sample network used by `demo.py`. |

Services are stored on `app.state.stations` and `app.state.readings`. Tests that
need a lot of data call `app.state.readings.ingest(...)` directly instead of
making thousands of HTTP requests.

## Conventions

- A stored reading is always **UTC** and always **Celsius** (rounded to 2 decimals).
  Stations may send `"unit": "F"`; the default is `"C"`.
- Timestamps must carry an offset (`2025-03-10T22:30:00-08:00`); a timestamp without one is a `422`.
- A "day" in every summary is a **UTC** calendar day.
- Station ids are lower case letters, digits and dashes (`ridge-01`), 3 to 32 characters.

## Error format

Every error has the same shape and an HTTP status that matches it:

```json
{"error": {"code": "duplicate_reading", "message": "...", "details": {"station_id": "ridge-01"}}}
```

| Status | `code` | When |
| --- | --- | --- |
| 404 | `not_found` | unknown station or route |
| 409 | `duplicate_station`, `duplicate_reading` | conflicts with what is already stored |
| 422 | `validation_error` | the body or query failed validation; `fields` maps `body.humidity`, `query.to`, ... to a message |

## Endpoints

| Method and path | Result |
| --- | --- |
| `GET /health` | `{"status": "ok"}` |
| `POST /stations` | 201, the station |
| `GET /stations`, `GET /stations/{id}` | stations by id; `404` if unknown |
| `POST /stations/{id}/readings` | 201, the stored reading (`timestamp` in UTC, `temperature_c`); `404` if the station is unknown |
| `GET /stations/{id}/readings?limit=100` | the latest `limit` readings (1 to 1000), oldest first |

On the roadmap: a daily summary endpoint for the map's history chart
(`ReadingService.daily_summary` is a stub) and rejecting readings that a station
sends twice.
