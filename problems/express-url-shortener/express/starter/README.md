# TinyLink API

TinyLink is the team's internal link shortener. Someone pastes a long wiki or meeting URL, gets a short link such as `/handbook`, and anyone who opens it is redirected to the long URL. The owner can later see how many people used it.

A **link** has:

| Field | Meaning |
| --- | --- |
| `slug` | The short name in the URL. A custom alias chosen by the owner, or 6 generated characters. Slugs are **case-insensitive**: `Docs` and `docs` are the same link. The link keeps the casing it was created with. |
| `url` | The target. Absolute `http` or `https`, at most 2048 characters. |
| `owner` | The user id that created it. |
| `createdAt` | ISO 8601 UTC time of creation. |
| `expiresAt` | ISO 8601 UTC time after which the link stops working, or `null`. |

## How the code fits together

```
src/app.js                      builds the Express app (does not listen)
src/server.js                   listens on $PORT (default 3000)
src/routes/                     URL -> controller method
src/controllers/                read the request, choose the status code
src/services/link-service.js    business rules
src/services/slug.js            generated slugs
src/validation.js               request validation
src/store/memory-store.js       in-memory stand-in for the database
src/middleware/                 auth (X-User-Id), error handler, async wrapper
src/errors.js                   error classes -> JSON
```

`node demo.js` starts the app on a free port and walks through a few requests. `npm test` runs the tests in `tests/`.

## Authentication

There is no real sign-in. The intranet gateway sends the caller's id in the `X-User-Id` header (1 to 40 letters, digits, `.`, `_` or `-`). Every `/api/*` endpoint needs it; the public redirect does not.

## Endpoints

| Method and path | Success | Notes |
| --- | --- | --- |
| `GET /health` | `200` `{"status": "ok"}` | |
| `POST /api/links` | `201` the link, header `Location: /api/links/<slug>` | Body `{url, alias?, expiresAt?}` |
| `GET /api/links` | `200` `{"links": [...]}` | The caller's own links, newest first |
| `GET /api/links/:slug` | `200` the link | Any signed-in user can look a link up |
| `GET /api/links/:slug/stats?from=&to=` | `200` statistics | **Owner only.** See below |
| `GET /:slug` | `302` with `Location: <url>` | Public. Counts one click |

### Creating a link

- `url` is required. `alias` is optional: 3 to 32 letters, digits, `-` or `_`, and not `api`, `health` or `admin`. Without an alias a slug is generated.
- `expiresAt` is optional: an ISO 8601 date-time in the future.
- An alias that is already taken, in **any letter case**, is `409`: the existing link is left untouched.

### Following a link

`GET /:slug` looks the slug up ignoring case. An unknown slug is `404`. An expired link is `410` and its click is **not** counted. Otherwise the click is recorded (with the current time) and the visitor gets a `302` to the target.

### Click statistics

`GET /api/links/:slug/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`

- `from` and `to` are calendar days in **UTC**, both inclusive. `from` defaults to the day the link was created, `to` defaults to today (UTC).
- The range may be at most 366 days.
- Response `200`:

```json
{
  "slug": "handbook",
  "from": "2026-02-01",
  "to": "2026-02-03",
  "totalClicks": 5,
  "daily": [
    {"date": "2026-02-01", "clicks": 2},
    {"date": "2026-02-02", "clicks": 0},
    {"date": "2026-02-03", "clicks": 3}
  ]
}
```

`daily` has one entry for every day in the range, oldest first, including days with no clicks. `totalClicks` is the sum of `daily`.

## Errors

Every error has the same shape:

```json
{"error": {"code": "alias_taken", "message": "The alias \"Docs\" is already taken."}}
```

Validation errors also carry `fields`, mapping each bad field to an explanation (all problems are reported at once):

```json
{"error": {"code": "validation_error", "message": "The request is invalid.", "fields": {"url": "must be an absolute http or https URL"}}}
```

| Status | `error.code` | When |
| --- | --- | --- |
| `400` | `invalid_json` | The body is not valid JSON |
| `401` | `unauthorized` | Missing or malformed `X-User-Id` |
| `403` | `forbidden` | Statistics requested by someone who does not own the link |
| `404` | `not_found` | Unknown slug or route |
| `409` | `alias_taken` | The alias already exists (any letter case) |
| `410` | `link_expired` | The link has expired |
| `413` | `body_too_large` | Body over 100 kB |
| `422` | `validation_error` | A field breaks a rule (see `fields`) |
| `500` | `internal_error` | Anything unexpected; no details are leaked |

When a request has several problems, the order is: `401`, then `404`, then `403`, then `422`.
