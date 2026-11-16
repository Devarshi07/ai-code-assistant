# Inkwell: documents API

The API behind Inkwell, a small team wiki. Every client (the web editor, the
CLI, CI bots) calls it with an API token. Tokens belong to users, and each
user has one role:

| Role | Can |
| --- | --- |
| `viewer` | read documents |
| `editor` | everything a viewer can, plus create and edit documents |
| `admin` | everything, including deleting documents and the `/admin` endpoints |

## Layout

```
src/
  app.js                   createApp({store, clock, rateLimit}); does not listen
  server.js                listens on PORT (default 3000)
  errors.js                AppError and subclasses -> JSON error bodies
  middleware/
    authenticate.js        Bearer token -> req.user, req.token
    require-role.js        requireRole('editor') route guard
    rate-limit.js          per-token limits and the 429 response
    error-handler.js
  lib/rate-limiter.js      the limiting algorithm, independent of HTTP
  routes/                  URL + required role -> controller
  controllers/             request in, status code and JSON out
  services/                documents and the audit log
  store/                   in-memory tables and sample data
demo.js                    starts the app on a free port and makes a few calls
tests/                     node:test suites, one per phase
```

Run the tests with `node --test` and the demo with `node demo.js`. Tests pass
their own `store`, a fake `clock` and small rate limits to `createApp`.

## Authentication

Send `Authorization: Bearer <secret>`. `GET /health` is public (the load
balancer calls it without a token); every other route needs a valid token.

## Errors

Every error is JSON: `{"error": {"code": "...", "message": "...", "fields": {...}}}`
(`fields` only on validation errors).

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `invalid_json` | the body is not valid JSON |
| 401 | `unauthenticated` | no `Authorization` header; also sends `WWW-Authenticate: Bearer realm="inkwell"` |
| 401 | `invalid_token` | a malformed, unknown or revoked token; `WWW-Authenticate` adds `error="invalid_token"` |
| 403 | `forbidden` | a valid token whose role (or ownership) does not allow the request |
| 404 | `not_found` | an unknown route or id |
| 422 | `validation_error` | a field breaks a rule; `fields` says which |
| 429 | `rate_limited` | too many requests for this token; see Rate limits |

## Endpoints

| Method and path | Minimum role | Success |
| --- | --- | --- |
| `GET /health` | none | 200 `{"status": "ok"}` |
| `GET /docs` | viewer | 200 `{"data": [doc, ...]}` by id |
| `GET /docs/:id` | viewer | 200 doc |
| `POST /docs` | editor | 201 doc, `Location: /docs/<id>` |
| `PATCH /docs/:id` | editor | 200 doc |
| `DELETE /docs/:id` | admin | 204, no body |
| `GET /admin/audit` | admin | see Audit log |

A doc is `{"id", "title", "body", "ownerId", "createdAt", "updatedAt"}`.
`title` is 1 to 120 characters (trimmed), `body` is text up to 20,000
characters. `PATCH` takes either or both.

## Audit log

Planned: security wants a record of every change and every refused request,
readable by admins at `GET /admin/audit`. Not built yet.

## Rate limits

Each API token may make `rateLimit.limit` requests per `rateLimit.windowMs`
(600 a minute by default). Responses to authenticated requests carry
`X-RateLimit-Limit` and `X-RateLimit-Remaining`; a rejected request is `429`
with `Retry-After` in whole seconds.
