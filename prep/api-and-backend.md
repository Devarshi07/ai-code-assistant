# API and back-end questions

Back-end assessments test whether you can work with HTTP APIs, not just algorithms. Four formats come up most:

- **REST client tasks**: write a function that calls a JSON API, walks through its pages, filters and aggregates.
- **Build-an-API projects**: implement endpoints in a small service (Express, Flask, Django, Spring Boot), scored by hidden tests.
- **API design questions**: multiple choice or a written answer on status codes, pagination, idempotency and versioning.
- **Back-end design conversations**: rate limiting, payments, queues and caching, in a system design round.

## REST client tasks

A typical task: given a team name and a year, call a paginated endpoint that returns a page number, the total number of pages and a list of records, then return the total of some field across every page.

**Checklist**

- [ ] Learn the response shape from the statement, or fetch one page and look at it.
- [ ] Loop over every page: from the first page to `total_pages` inclusive. Off-by-one errors are the most common bug.
- [ ] Handle an empty result (zero pages or an empty list) without crashing.
- [ ] URL-encode query parameters such as names with spaces.
- [ ] Match the expected output exactly: type, ordering, rounding.
- [ ] If the statement mentions it, handle `429 Too Many Requests` by waiting for `Retry-After`, and retry `5xx` errors a few times with backoff.
- [ ] Don't fetch pages in parallel unless the task allows it; rate limits are often part of the test.

Know your language's built-in HTTP client: `urllib.request` with `json` in Python, `fetch` in Node.js 18 and later, `HttpClient` in Java 11 and later, and `net/http` with `encoding/json` in Go.

## Build-an-API projects

You get a project with a README, a few visible tests and an IDE with a terminal. Hidden tests run when you submit, and the score is the share that pass.

**What hidden tests usually check**

- the happy path for each endpoint, with the exact field names and types from the README;
- validation: missing fields, wrong types and out-of-range values return `400` with an error body;
- unknown ids return `404`; duplicates return `409` when the spec says so;
- create returns `201` (often with a `Location` header) and delete returns `204`;
- filtering, sorting and pagination at their boundaries: the first page, the last page, an empty page;
- that repeating a request does what the spec says (for example, two identical PUTs leave one record).

**How to work**

1. Read the README end to end and list every endpoint with its status codes.
2. Run the visible tests first, so you know how they're run and what fails.
3. Implement one endpoint at a time, running the tests after each.
4. Put validation at the boundary, in one place, with one consistent error shape such as `{"error": "..."}`.
5. Don't rename fields or change response shapes the tests rely on.
6. Write a quick test of your own for each edge case the README mentions.

## Design principles worth knowing

- **Resources and methods.** Nouns in paths (`/orders/42`), verbs as HTTP methods. GET is safe; GET, PUT and DELETE are idempotent; POST is not.
- **Status codes.** `200`, `201`, `204`; `400` invalid input, `401` not authenticated, `403` not allowed, `404` not found, `409` conflict, `422` semantically invalid, `429` rate limited; `5xx` only for server faults.
- **Idempotency keys.** For POSTs that must not repeat, such as payments, the client sends a unique key and the server stores it with the result and replays that result for repeats.
- **Pagination.** Offset pagination is simple but shifts when rows are inserted. Cursor (keyset) pagination anchors on the last item's sort key and stays stable and fast.
- **Versioning and compatibility.** Adding optional fields and endpoints is safe. Removing or renaming fields, changing types, or making optional inputs required breaks clients.
- **Rate limiting.** Return `429` with `Retry-After`, and headers showing the limit and the remaining quota.
- **Caching.** `ETag` with `If-None-Match` for conditional requests; `Cache-Control` for what can be cached and for how long.
- **Security basics.** Credentials in headers, never in URLs; validate everything; never trust client-sent ids for authorization.

## Back-end fundamentals that come up

- Transactions and isolation levels, and races such as two people booking the same seat.
- Indexes, and the N+1 query problem behind slow list endpoints.
- Caching and invalidation, and protecting the database from a stampede when a popular key expires.
- Queues with retries, which need idempotent consumers because messages can arrive twice.
- Timeouts and retries with backoff and jitter, so one slow dependency doesn't take everything down.

## Practising in this app

- **Coding questions** with the REST APIs and API Design skills.
- **Practice tests:** the API and SQL back-end assessment.
- **Multiple choice:** the REST APIs, SQL, Web and Databases topics in the custom test builder.
- **Mock interviews:** system design topics such as a rate limiter, a payments ledger and a notification service.
