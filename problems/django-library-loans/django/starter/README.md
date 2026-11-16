# Shelfwise lending API

Shelfwise is the back end behind the front-desk app at a small public library.
Staff scan a member's card and a book's barcode, and the desk app calls this
API to lend the book, take it back and show what the member owes.

It is a Django 5.2 project with one app, `library`, built on Django REST Framework.

## Layout

| Path | What it holds |
| --- | --- |
| `config/settings.py` | Settings, including the lending policy (`LOAN_DAYS`, `MAX_ACTIVE_LOANS`, `FINE_PER_DAY_CENTS`, `MAX_FINE_CENTS`) |
| `config/urls.py` | Mounts the `library` URLs at the root |
| `library/models.py` | `Member`, `Book` (a title with a number of `copies`) and `Loan` (one copy lent to one member) |
| `library/serializers.py` | JSON shapes of the resources and request bodies |
| `library/services.py` | The lending rules. Views call these functions and stay thin |
| `library/views.py`, `library/urls.py` | The HTTP endpoints |
| `library/errors.py` | Error classes and the exception handler that gives every error the same shape |
| `library/clock.py` | `today()`. Tests pin the date by patching `library.clock.today` |
| `demo.py` | Runs a morning at the desk through the API and prints it |
| `tests/` | `base.py` sets up Django and an in-memory database; each test is rolled back |

## Endpoints

All URLs end with a slash.

| Method and path | Result |
| --- | --- |
| `GET /books/` | `200`, every title with `copies` and `available` (copies on the shelf now) |
| `POST /books/` | `201`, adds a title: `{"title", "author", "isbn", "copies"}` |
| `GET /members/`, `POST /members/` | List or add members: `{"name", "email", "joined_on"}` |
| `POST /loans/` | `201`, lends a copy: `{"member_id", "book_id"}`. The loan is due `LOAN_DAYS` (14) days later |
| `GET /loans/` | `200`, loans, oldest first. `?member=<id>` keeps one member's loans |
| `POST /loans/<id>/return/` | Takes a loan back (not built yet) |
| `GET /members/<id>/fines/` | What a member owes (not built yet) |

A loan looks like this:

```json
{"id": 7, "member": {"id": 2, "name": "Ada Lovelace"},
 "book": {"id": 4, "title": "The Salt Road Atlas", "author": "Mira Okafor"},
 "lent_on": "2026-03-02", "due_on": "2026-03-16", "returned_on": null,
 "fine_cents": 0, "status": "active"}
```

`status` is `active` (out, not yet due), `overdue` (out, past its due date) or `returned`.

## Lending rules

- A member can have at most `MAX_ACTIVE_LOANS` (3) books out, and not two copies of the same title.
- A title can be lent only while one of its copies is on the shelf.

## Errors

Every error has the shape `{"error": {"code": "...", "message": "..."}}`, sometimes with extra fields.

| Status | `code` | When |
| --- | --- | --- |
| `400` | `validation_error` | The body or query string is invalid; `fields` maps each field to its messages |
| `404` | `not_found` | The member, book or loan does not exist |
| `409` | `not_available` | Every copy of the title is out |
| `409` | `loan_limit` | The member already has the maximum number of books out (`limit` says how many) |
| `409` | `already_borrowed` | The member already has a copy of this title |

## Running it

Run the tests from the panel, or `python demo.py` to see a sample morning at the desk.
