# Turnstile ticketing API

Turnstile sells reserved seats for small venues. Organisers create an event with
a seating plan; attendees pick seats on a seat map, **hold** them for a few
minutes while they pay, and **check out** the holds into an order.

It is a Django 5.2 project with Django REST Framework and two apps:

| Path | What it holds |
| --- | --- |
| `config/settings.py` | Settings, including the sales policy (`HOLD_MINUTES`, `MAX_SEATS_PER_REQUEST`, `BOOKING_FEE_CENTS`) |
| `accounts/models.py` | `Account`, with a `role` of `organiser` or `attendee` and an `api_key` |
| `accounts/authentication.py` | Reads the `X-Api-Key` header and sets `request.user` to the account |
| `ticketing/models.py` | `Event`, `Seat`, `Hold` and `Order`. How a seat's status follows from its holds is in the `Hold` docstring |
| `ticketing/services.py` | The sales rules. Views call these functions and stay thin |
| `ticketing/serializers.py` | Request bodies and JSON shapes |
| `ticketing/permissions.py` | Who may do what, beyond being signed in |
| `ticketing/views.py`, `ticketing/urls.py` | The HTTP endpoints |
| `ticketing/errors.py` | Error classes and the exception handler that gives every error one shape |
| `ticketing/clock.py` | `now()`. Tests pin the time by patching `ticketing.clock.now` |
| `demo.py` | Runs a small on-sale through the API and prints it |
| `tests/` | `base.py` sets up Django and an in-memory database; each test is rolled back |

## Seat status

- **sold**: one of the seat's holds belongs to an order.
- **held**: it has a hold with no order whose `expires_at` is still in the future.
- **available**: anything else, including seats whose holds ran out.

## Endpoints

Every request needs an `X-Api-Key` header. All URLs end with a slash.

| Method and path | Who | Result |
| --- | --- | --- |
| `GET /events/` | anyone | `200`, upcoming events |
| `POST /events/` | organisers | `201`, creates an event and its seats: `{"name", "venue", "starts_at", "sections": [{"name", "rows", "seats_per_row", "price_cents"}]}` |
| `GET /events/<id>/seats/` | anyone | `200`, every seat: `{"id", "label", "section", "row", "number", "price_cents", "status"}` |
| `GET /events/<id>/availability/` | anyone | `200`, seat counts per section and in total |
| `POST /events/<id>/holds/` | anyone | `201`, holds up to 8 seats for `HOLD_MINUTES` (10): `{"seat_ids": [...]}`, all or nothing |
| `DELETE /holds/<id>/` | the hold's owner | `204`, gives the seat back |
| `GET /orders/` | anyone | `200`, the caller's own orders |
| `POST /orders/` | anyone | checks out holds into an order (not built yet) |
| `GET /events/<id>/orders/` | the event's organiser | every order for the event (not built yet) |

A hold looks like `{"id": 3, "seat_id": 41, "seat": "Floor A1", "created_at": "...", "expires_at": "..."}`.

## Errors

Every error has the shape `{"error": {"code": "...", "message": "..."}}`, sometimes with extra fields.

| Status | `code` | When |
| --- | --- | --- |
| `400` | `validation_error` | The body is invalid; `fields` maps each field to its messages |
| `401` | `not_authenticated` | No `X-Api-Key`, or an unknown one |
| `403` | `forbidden` | Signed in, but not allowed (an attendee creating an event, someone else's hold) |
| `404` | `not_found` | The event, seat or hold does not exist (`seats` lists seat ids that are not in the event) |
| `409` | `seats_unavailable` | Some seats are held or sold; `seats` lists them |
| `409` | `already_ordered` | The hold has already been paid for |

## Running it

Run the tests from the panel, or `python demo.py` to watch a small on-sale.
