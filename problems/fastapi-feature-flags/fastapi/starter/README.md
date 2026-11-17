# Toggle feature-flag service

Toggle is the internal feature-flag service the product teams use to ship code
dark and turn it on gradually. A flag has a key, an on/off default, optional
targeting rules and an optional percentage rollout. Client services ask "what
are my flags for this user?" on almost every request.

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
| `app/routers/` | Thin HTTP layer: `flags.py` (management and single-flag check), `evaluate.py` (`POST /evaluate`). |
| `app/services/flags.py` | `FlagService`: flag CRUD and the entry points for evaluation. |
| `app/services/evaluation.py` | `Evaluator`: decides a flag's value for a user and says why. |
| `app/services/bucketing.py` | Percentage rollouts: the stable hash that puts a user in a bucket. |
| `app/rules.py` | The rule expression language: `parse_rule` and `Rule.matches`. |
| `app/repository.py` | `FlagRepository`: a dictionary standing in for the database table. |
| `app/schemas.py` | Pydantic v2 request and response models. |
| `app/errors.py` | `ApiError` and the exception handlers that produce the error format below. |
| `app/dependencies.py` | `Flags`: the dependency that hands a route the app's service. |
| `app/seed.py` | A few sample flags used by `demo.py`. |

`create_app()` stores the service on `app.state.flags`. Scripts and tests that
need many flags or many evaluations call the service directly
(`create_flag(FlagCreate)`, `evaluate(user_id, attributes)`) instead of making
thousands of requests. `evaluate` returns `{flag_key: Evaluation(value, reason)}`.

## Flags

| Field | Type | Meaning |
| --- | --- | --- |
| `key` | string | Unique, immutable. Lower case letters, digits, `-` and `_`; starts with a letter; at most 48 characters. |
| `description` | string | Free text, at most 200 characters. Default `""`. |
| `enabled` | boolean | The kill switch. `false` turns the flag off for everyone. Default `true`. |
| `default` | boolean | The value for users that no rule and no rollout decides. Default `false`. |
| `rollout_percent` | integer 0-100 | Share of users switched **on** by the rollout. Default `0`. |
| `rules` | list of `{"when": expression, "value": boolean}` | Targeting rules, at most 20, checked in order. `value` defaults to `true`. |

## Evaluation

A flag's value for a user is decided by the first of these steps that applies:

1. **`disabled`**: `enabled` is `false`. The value is `false`, whatever else is configured.
2. **`rule`**: the first rule (in list order) whose expression matches the user. The value is that rule's `value`.
3. **`rollout`**: the user is inside the rollout (see Bucketing). The value is `true`.
4. **`default`**: otherwise. The value is the flag's `default`.

The `reason` in a result is the name of the step that decided it.

### Bucketing

A rollout must be sticky (the same user gets the same answer every time, on
every server) and independent per flag (the users in one flag's 10% are not the
same people as in another flag's 10%).

- `bucket = int(sha256("<flag_key>:<user_id>").hexdigest()[:8], 16) % 100`, a number from 0 to 99 (the string is UTF-8 encoded).
- A user is inside a rollout of `P` percent when `bucket < P`. So `0` reaches nobody, `10` reaches buckets 0 to 9 (about 10% of users) and `100` reaches everybody.

### Rule expressions

`<attribute> <operator> <value>`, with the value written as JSON:

| Operator | Value | Example |
| --- | --- | --- |
| `==`, `!=` | string, number or boolean | `country == "DE"` |
| `in`, `not in` | non-empty array of strings, numbers or booleans | `plan in ["pro", "team"]` |
| `<`, `<=`, `>`, `>=` | number | `age >= 18` |

- The attributes are the ones sent with the evaluation, plus `user_id`, which is always available (and cannot be overridden by an attribute of that name).
- An attribute the user does not have never matches, for **every** operator including `!=` and `not in`.
- Values are only equal when they are the same kind: `"1"` is not `1`, and `true` is not `1`. A comparison between different kinds does not match (for ordering operators, both sides must be numbers).
- `in` and `not in` need a space on both sides of the word. Anything else that does not fit the grammar is a syntax error.

## Conventions

- Lists are sorted by flag key.
- Attribute values in an evaluation request are strings, numbers or booleans.

## Error format

Every error has the same shape and an HTTP status that matches it:

```json
{"error": {"code": "duplicate_flag", "message": "Flag 'dark-mode' already exists.", "details": {"key": "dark-mode"}}}
```

| Status | `code` | When |
| --- | --- | --- |
| 404 | `not_found` | unknown flag or route |
| 409 | `duplicate_flag` | creating a flag whose key already exists |
| 422 | `validation_error` | the body or query failed validation; `fields` maps `body.key`, `body.rules.0.when`, `query.user_id`, ... to a message |

## Endpoints

| Method and path | Result |
| --- | --- |
| `GET /health` | `{"status": "ok"}` |
| `POST /flags` | 201, the flag; 409 on a duplicate key |
| `GET /flags` | every flag, by key |
| `GET /flags/{key}` | the flag |
| `PATCH /flags/{key}` | partial update: only the fields sent change; `key` cannot be sent; `null` is not a valid value for any field |
| `DELETE /flags/{key}` | 204, no body |
| `GET /flags/{key}/check?user_id=` | `{"key", "user_id", "value", "reason"}`: one flag for one user, with no attributes |
| `POST /evaluate` | body `{"user_id", "attributes"?}`; returns `{"user_id", "flags": {"<key>": {"value", "reason"}}}` for every flag, ordered by key |

Status of this checkout: attribute rules are not wired into evaluation yet,
and `POST /evaluate` and the validation described above are still to be built.
