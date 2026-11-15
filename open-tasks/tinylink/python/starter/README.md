# TinyLink

The marketing team runs dozens of campaigns at once. They want short links they can print on flyers and paste into ads, links that stop working when a promotion ends, and a quick view of how each link is doing. You are building **TinyLink**, the in-memory service behind it.

Everything lives in one `TinyLink` object in `tinylink/service.py`. There is no web server, database or real clock: every time-dependent method takes `now`, an integer number of **milliseconds since the Unix epoch (UTC)**. Tests never move `now` backwards.

Every error the service raises on purpose is defined in `tinylink/errors.py`. Tests check only the error class, never the message.

```
TinyLinkError
├── ValidationError            the arguments themselves are bad
│   ├── InvalidUrlError
│   ├── InvalidAliasError
│   └── InvalidExpiryError       (Part 2)
├── AliasTakenError
├── QuotaExceededError           (Part 2)
├── LinkNotFoundError
├── LinkExpiredError             (Part 2)
├── LinkDeletedError             (Part 3)
└── RestoreConflictError         (Part 3)
```

A call that raises must leave the service exactly as it was: no link created, no counter value used, no click recorded.

## Part 1 · Core

### `create(url, owner, now, alias=None, expires_at=None) -> str`

Creates a link owned by `owner` (any string) and returns its **code**.

**URL rules.** Raise `InvalidUrlError` unless all of these hold:

- the URL is at most 2,048 characters long (exactly 2,048 is allowed);
- it starts with `http://` or `https://`, with the scheme matched case-insensitively (`HTTPS://` is fine; `ftp://`, `//example.com` and `example.com` are not);
- the host, meaning the text after `://` up to the first `/`, `?` or `#` (or the end of the string), is not empty, so `http://`, `https:///path` and `https://?q=1` are rejected;
- it contains no space, tab (`\t`), carriage return (`\r`) or newline (`\n`).

Store and return the URL exactly as given, with no normalisation.

**Generated codes.** With `alias=None` the code comes from a counter that starts at 1. Encode the counter in base 62, most significant digit first, with the digits `0-9`, then `A-Z`, then `a-z` (`ALPHABET` in `service.py`). Left-pad it with `0` to 6 characters, then advance the counter. The first codes are `000001`, `000002`, …; the 10th is `00000A`, the 36th is `00000a` and the 62nd is `000010`. If a candidate *clashes* (see below) with a custom alias that has **ever** been created, even one that was later deleted, discard it and try the next counter value. Discarded values are never reused.

**Custom aliases.** When `alias` is a string (even an empty one), it becomes the code and is returned exactly as given. It must be 3–30 characters long (both inclusive), and every character must be an ASCII letter `A-Z` or `a-z`, a digit `0-9` or a hyphen `-`. Otherwise raise `InvalidAliasError`.

**Codes and case.** Generated codes are case-sensitive: `00000a` and `00000A` are different links. A custom alias reserves every capitalisation of itself, so `Spring-Sale` also answers to `spring-sale`. Two codes **clash** when they are equal ignoring case *and at least one of them is a custom alias*. A new alias that clashes with the code of any existing link, whoever owns it, raises `AliasTakenError`. Expired links keep their code. Deleted links (Part 3) don't.

**Check order.** When several things are wrong, raise the first that applies: `InvalidUrlError`, `InvalidAliasError`, `InvalidExpiryError`, `AliasTakenError`, `QuotaExceededError`.

### `resolve(code, now, visitor_id) -> str`

Returns the link's URL and records one click at time `now` by `visitor_id` (a string).

**Look-up.** A generated code matches only its exact spelling; an alias matches any capitalisation of itself. If no link matches, raise `LinkNotFoundError`. Every method that takes a `code` uses this look-up.

## Part 2 · Expiry, analytics and quotas

**Expiry.** `create(..., expires_at=t)` makes the link expire at time `t` (ms); `None` means it never expires. Raise `InvalidExpiryError` if `t <= now`. A link is **expired** at time `now` when `now >= expires_at`, so at `expires_at - 1` it still works. Resolving an expired link raises `LinkExpiredError` and records no click.

**`stats(code) -> LinkStats`** (the dataclass is in `service.py`):

- `total_clicks`: clicks recorded by successful `resolve` calls;
- `unique_visitors`: the number of distinct `visitor_id` values, compared exactly (`"v1"` and `"V1"` are different visitors);
- `clicks_by_day`: a `dict` mapping a UTC day number to that day's clicks, where the day number is `now // 86_400_000`. Days without clicks are left out.

A link with no clicks gives `LinkStats(0, 0, {})`. `stats` works on expired and deleted links. A code that matches nothing raises `LinkNotFoundError`.

**Quotas.** `TinyLink(max_links_per_owner=k)` caps each owner at `k` **active** links; `None` (the default) means no cap. A link is active at time `now` when it is neither expired nor deleted. `create` raises `QuotaExceededError` if the owner already has `k` active links at that `now`. Other owners are not affected.

## Part 3 · Stretch: delete, restore and top links

**`delete(code) -> None`** soft-deletes a link. Resolving it then raises `LinkDeletedError`, which takes precedence over `LinkExpiredError`. Its clicks are kept and `stats` still works. A deleted link no longer counts toward its owner's quota and releases its code: a new custom alias may claim it, in any capitalisation (the generator still won't reissue it). Raise `LinkNotFoundError` if nothing matches and `LinkDeletedError` if the link is already deleted.

**Look-up with deleted links.** If a non-deleted link matches the code, it wins. Otherwise use the matching link that was deleted most recently.

**`restore(code, now) -> None`** undoes a delete. The link keeps its clicks, its original expiry and its place in creation order. Checks, in order:

1. no link matches → `LinkNotFoundError`;
2. the matching link is not deleted → `RestoreConflictError`. This covers restoring a link that is already live, and a deleted link whose code was claimed by a newer link in the meantime;
3. the link would be active at `now` and its owner already has `k` active links → `QuotaExceededError`. A link that has already expired can always be restored.

**`top_links(owner, n, since) -> list[tuple[str, int]]`** returns up to `n` `(code, clicks)` pairs for the owner's links, where `clicks` counts only clicks with a timestamp `>= since`. Sort by clicks, most first. Break ties by creation order, oldest link first. Leave out deleted links and links with no clicks in the window. Expired links are included. `n` is never negative, and an owner with no links gets `[]`.

## Running tests

```
python -m unittest discover -s tests -v
```

`tests/test_public.py` covers the basic happy path. Hidden acceptance tests check every rule above, so add your own tests as you go.
