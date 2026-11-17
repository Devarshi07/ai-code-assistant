# Marketlane reviews service

Marketlane is an online shop. This is the service behind the star ratings and
review pages: shoppers write one review per product, other shoppers vote
reviews helpful, and moderators hide the ones that break the house rules.

It is a Django 5.2 project built on Django REST Framework, with two apps.

## Layout

| Path | What it holds |
| --- | --- |
| `config/settings.py` | Settings, including `REVIEW_MAX_LENGTH`, `DEFAULT_PAGE_SIZE` and `MAX_PAGE_SIZE` |
| `accounts/` | `Account` (role `shopper` or `moderator`) and the `X-Api-Key` authentication class |
| `reviews/models.py` | `Product`, `Review` (rating, text, state) and `HelpfulVote` |
| `reviews/ratings.py` | The rating rules: allowed range, how the average is rounded |
| `reviews/services.py` | The business rules. Views call these functions and stay thin |
| `reviews/serializers.py` | JSON shapes of the resources and request bodies |
| `reviews/views.py`, `reviews/urls.py` | The HTTP endpoints |
| `reviews/pagination.py` | `?page=` and `?page_size=` handling shared by list endpoints |
| `reviews/permissions.py`, `reviews/errors.py` | The moderator check, and error classes plus the handler that gives every error one shape |
| `reviews/clock.py` | `now()`. Tests pin the time by patching `reviews.clock.now` |
| `demo.py` | Plays a week of reviews through the API and prints it |
| `tests/` | `base.py` sets up Django and an in-memory database; each test is rolled back |

## Endpoints

All URLs end with a slash. Callers identify themselves with an `X-Api-Key` header.
Reading is public; writing needs an account.

| Method and path | Who | Result |
| --- | --- | --- |
| `GET /products/` | anyone | `200`, a page of products with `average_rating` and `review_count` |
| `POST /products/` | moderator | `201`, adds a product: `{"name", "sku"}` |
| `GET /products/<id>/` | anyone | `200`, one product with its rating summary |
| `GET /products/<id>/reviews/` | anyone | A page of the product's published reviews (not built yet) |
| `POST /products/<id>/reviews/` | signed in | Writes a review: `{"rating", "text"}` (not built yet) |
| `PATCH /reviews/<id>/` | author | Edits `rating` and/or `text` (not built yet) |
| `DELETE /reviews/<id>/` | author or moderator | `204` |
| `POST /reviews/<id>/helpful/` | signed in | Votes a review helpful (not built yet) |
| `POST /reviews/<id>/moderate/` | moderator | `200`, sets a review's state: `{"state": "hidden"}` or `{"state": "published"}` |

A product looks like this:

```json
{"id": 4, "name": "Trail Mug", "sku": "MUG-001", "average_rating": 4.3, "review_count": 3}
```

A review looks like this:

```json
{"id": 12, "product": 4, "author": {"id": 7, "name": "Ann Lee"}, "rating": 5,
 "text": "Keeps coffee hot for hours.", "state": "published", "helpful_count": 2,
 "created_at": "2026-03-02T09:00:00Z", "updated_at": "2026-03-02T09:00:00Z"}
```

Lists come back as `{"count": <all matches>, "page": 1, "page_size": 10, "results": [...]}`.
`page_size` defaults to 10 and may be 1 to 100. A page past the end is `200` with no results.

## Rating rules

- A rating is a whole number from 1 to 5. Review text is required and at most 2000 characters.
- A review is `published` (shown to shoppers) or `hidden` (moderated away).
- A product's `review_count` and `average_rating` use **published reviews only**.
- `average_rating` is the mean to **one decimal, halves rounded up**: 2.45 is shown as 2.5, 1.15 as 1.2.
  A product with no published reviews has `average_rating: null` and `review_count: 0`.

## Review rules (phase 2)

- A shopper writes at most one review per product, even if the first one is now hidden.
- Only the author edits a review, not even a moderator. Authors and moderators can delete it.
- A shopper can vote a published review helpful once, and never their own.
- `GET /products/<id>/reviews/?sort=` accepts `recent` (the default, newest first), `helpful` (most votes first)
  and `rating` (highest first). Ties fall back to helpful votes, then newest, then highest id.

## Errors

Every error has the shape `{"error": {"code": "...", "message": "..."}}`, sometimes with extra fields.

| Status | `code` | When |
| --- | --- | --- |
| `400` | `validation_error` | The body or query string is invalid; `fields` maps each field to its messages |
| `401` | `not_authenticated`, `authentication_failed` | No `X-Api-Key`, or an unknown one |
| `403` | `permission_denied` | The role may not do this (a shopper moderating) |
| `403` | `not_author` | Editing or deleting a review that is not yours |
| `403` | `own_review` | Voting for your own review |
| `404` | `not_found` | Unknown product or review (a hidden review is `404` for votes) |
| `409` | `already_reviewed` | A second review of the same product by the same account |
| `409` | `already_voted` | A second helpful vote by the same account |

## Running it

```
python demo.py
python -m unittest discover -s tests -t .
```
