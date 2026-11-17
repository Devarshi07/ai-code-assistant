# TallyUp: shared expenses API

The service behind TallyUp, an app for flatmates and travel groups who share
costs. A group has members; anyone can record an expense they paid for and say
how it is split; the app shows who is owed what and who should pay whom to
settle up.

It is a plain Express 4 app with no database: `src/store/memory-store.js`
stands in for one. Every store call is asynchronous and takes a little time,
like a real database round trip.

## Layout

```
src/
  app.js                 createApp({store, now}): builds the app, does not listen
  server.js              listens on PORT (default 3000)
  errors.js              AppError and its subclasses -> JSON error bodies
  validation.js          checks request bodies
  routes/                URL -> controller method
  controllers/           request in, status code and JSON out
  services/              business rules (groups, expenses, money, balances)
  store/                 the in-memory "database" and sample data
  middleware/            request ids, async errors, the error handler
demo.js                  starts the app on a free port and makes a few requests
tests/                   node:test suites, one per phase
```

Run the tests with `node --test` and the demo with `node demo.js`.

## Money rules

- Money is **integer cents**, never a float. A group has one currency
  (`AUD`, `CAD`, `EUR`, `GBP` or `USD`); every amount in it is in that
  currency's cents.
- The **shares of an expense always add up to its amount exactly**. Nothing
  is created or lost, so the balances of a group always add up to zero.
- A split is one of:
  - `equal`: the amount is divided evenly between the listed members (all
    members when `memberIds` is left out).
  - `exact`: each member's amount is given and must add up to `amountCents`.
  - `shares`: each member has a whole-number weight (1 to 1000) and pays in
    proportion to it.
- When an amount does not divide evenly, the leftover cents are handed out
  **one cent at a time to the members with the largest fractional remainder**.
  Members with the same remainder (every member, for an equal split) are
  served in ascending member id order. So 10.00 split three ways between
  `mem_a`, `mem_b` and `mem_c` is 3.34, 3.33 and 3.33.
- `shares` in an expense are listed in ascending member id order.
- A member's **balance** is what they have paid out minus what they owe, plus
  settlements they sent and minus settlements they received. A positive
  balance means the group owes them; a negative one means they owe the group.

## Conventions

- Member ids look like `mem_ana`: `mem_` plus lowercase letters, digits or `_`.
- Every error response is JSON:
  `{"error": {"code": "...", "message": "...", "fields": {...}}}`, where
  `fields` only appears on validation errors and maps each bad field path to
  a short explanation.

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `invalid_json` | the body is not valid JSON |
| 404 | `not_found` | an unknown route, group, expense, settlement, or a member id that is not in the group |
| 413 | `body_too_large` | the body is over 100 kB |
| 422 | `validation_error` | a field breaks a rule; `fields` says which |
| 500 | `internal_error` | a bug; the message never leaks details |

For a request that names a group, the order of checks is: the group exists
(404), the body is valid (422), then every member id it mentions belongs to
the group (404).

## Endpoints

### `GET /api/groups`, `GET /api/groups/:groupId`

`{"data": [group, ...]}` and a single group:

```json
{"id": "grp_flat", "name": "Maple Street flat", "currency": "EUR",
 "members": [{"id": "mem_ana", "name": "Ana"}], "createdAt": "2026-01-10T09:00:00.000Z"}
```

### `POST /api/groups`

`{"name": "Lisbon trip", "currency": "USD", "members": [{"id": "mem_eli", "name": "Eli"}]}`.
1 to 50 members with distinct ids. `201` with `Location: /api/groups/<id>`.

### `POST /api/groups/:groupId/expenses`

```json
{"description": "Electricity", "payerId": "mem_ben", "amountCents": 10000,
 "split": {"type": "equal", "memberIds": ["mem_ana", "mem_ben", "mem_chen"]}}
```

`description` is 1 to 100 characters; `amountCents` a whole number from 1 to
100000000. `split` is `{"type": "equal", "memberIds": [...]}`,
`{"type": "exact", "amounts": {"mem_ana": 600, "mem_ben": 400}}` or
`{"type": "shares", "shares": {"mem_ana": 2, "mem_ben": 1}}`. An unknown
`payerId` or split member is a `404`.

Success is **201 Created** with `Location: /api/groups/<groupId>/expenses/<id>`
and the expense, including the computed `shares`:

```json
{"id": "exp_000004", "groupId": "grp_flat", "description": "Electricity",
 "payerId": "mem_ben", "amountCents": 10000, "currency": "EUR",
 "split": {"type": "equal", "memberIds": ["mem_ana", "mem_ben", "mem_chen"]},
 "shares": [{"memberId": "mem_ana", "cents": 3334}, {"memberId": "mem_ben", "cents": 3333},
            {"memberId": "mem_chen", "cents": 3333}],
 "createdAt": "2026-03-05T10:00:00.000Z"}
```

### `GET /api/groups/:groupId/expenses/:expenseId`

The expense, or `404`.

### `GET /api/groups/:groupId/balances`

**Not built yet; it currently fails with a 500.** The net balance of every
member, ascending by member id (members with nothing recorded show `0`):

```json
{"groupId": "grp_flat", "currency": "EUR", "balances": [
  {"memberId": "mem_ana", "name": "Ana", "balanceCents": 9000}]}
```

`GET /api/groups/:groupId/balances/:memberId` returns one entry
(`groupId`, `currency`, `memberId`, `name`, `balanceCents`); an unknown group
or a member who is not in it is `404`.

### `GET /api/groups/:groupId/settle-up`

**Not built yet; it currently fails with a 500.** Suggests payments that bring
every balance to zero: `{"groupId", "currency", "transfers": [{"fromId", "toId", "amountCents"}]}`.
Greedy rule: while anyone is owed or owes, the member who owes the most pays
the member who is owed the most, the smaller of the two amounts; ties go to
the lowest member id. An already-settled group has `"transfers": []`.

### Settlements

**Not built yet.** `POST /api/groups/:groupId/settlements` with
`{"fromId", "toId", "amountCents"}` records that one member paid another.
`201` with `Location: /api/groups/<groupId>/settlements/<id>` and
`{"id", "groupId", "fromId", "toId", "amountCents", "currency", "createdAt"}`;
`GET /api/groups/:groupId/settlements/:id` returns it again. `fromId` and
`toId` must be different members of the group (`404` if not) and
`amountCents` a whole number of cents of at least 1 (`422` otherwise).
