# Parkwise reservations API

Parkwise runs multi-level garages near stadiums and airports. Drivers book a
space for a time window in the app, and the gate reads their plate on
arrival. This Spring Boot service owns the spaces and the reservations.
Storage is in memory; the repositories are the only classes that know that.

## Rules

- **Sizes.** Spaces and vehicles are `MOTORCYCLE`, `COMPACT`, `STANDARD` or
  `LARGE`, smallest first. A vehicle fits any space of its size or larger
  (`VehicleSize.fitsIn`).
- **Windows are half-open.** A reservation for `[start, end)` holds the space
  from `start` up to, but not including, `end`. One booking ending at 10:00 and
  another starting at 10:00 on the same space do not share any time.
- **No double booking.** Two active reservations on one space never overlap.
- A window must end after it starts and be at most 14 days long. A booking
  cannot start in the past.
- **Cancellation.** A reservation can be cancelled until 30 minutes before it
  starts. A cancelled reservation no longer holds its space.
- **Best fit.** Search results list the smallest spaces that fit first, so the
  large spaces stay free for large vehicles; then lower levels first; then by id.

Times are ISO-8601 instants in UTC, such as `2026-12-01T09:30:00Z`.

## Endpoints

| Method and path | Body or query | Success |
| --- | --- | --- |
| `POST /spaces` | `{"label", "level", "size"}` | `201` space |
| `GET /spaces` | | `200` list of spaces |
| `POST /reservations` | `{"spaceId", "plate", "vehicleSize", "start", "end"}` | `201` reservation |
| `GET /reservations/{id}` | | `200` reservation |
| `POST /reservations/{id}/cancel` | | `200` reservation |
| `GET /availability` | `?start=&end=&vehicleSize=` | `200` `{"count", "spaces"}` |

A space is `{"id", "label", "level", "size"}`. A reservation is
`{"id", "spaceId", "plate", "vehicleSize", "start", "end", "status",
"createdAt", "cancelledAt"}`, where `status` is `ACTIVE` or `CANCELLED`.

## Errors

Every error has the same shape:

```json
{"error": {"code": "validation_error", "message": "The request is not valid", "fields": {"end": "must be after start"}}}
```

| Status | `code` | When |
| --- | --- | --- |
| `400` | `malformed_request` | the body is not valid JSON, or an enum or time in it is unreadable |
| `404` | `space_not_found`, `reservation_not_found` | the id does not exist |
| `409` | `space_unavailable` | the space is already booked for part of the window |
| `409` | `already_cancelled` | the reservation was cancelled before |
| `409` | `cancellation_closed` | it starts in less than 30 minutes, or has started |
| `422` | `validation_error` | a field or query parameter is invalid (`fields` says which) |
| `422` | `space_too_small` | the vehicle does not fit the space |
| `501` | `not_implemented` | the endpoint is not built yet |

## Layout

```
src/main/java/com/debuggym/api/
  Application.java
  config/       ClockConfig (the Clock services use for "now")
  controller/   SpaceController, ReservationController (HTTP only, no rules)
  service/      SpaceService, ReservationService, AvailabilityService, Windows
  repository/   SpaceRepository, ReservationRepository (in memory)
  model/        Space, Reservation, ReservationStatus, VehicleSize
  dto/          request and response records, with Bean Validation annotations
  exception/    ApiException and its subclasses, ApiExceptionHandler (the error shape)
src/test/java/com/debuggym/api/
  Phase1Test.java  (later phases add Phase2Test and Phase3Test)
```

`Reservation` is mutable (it can be cancelled). After changing one, save it
again through `ReservationRepository.save`.

## Running the tests

The tests are JUnit 5 with MockMvc, so they exercise the real controllers,
validation and error handler without opening a port. Use **Run tests**, or in
the terminal:

```
mvn -q test -Dtest=Phase1Test
```

The first run compiles the project and starts a Spring context, which takes a
few seconds. Write your own tests in `src/test/java/com/debuggym/api/CustomTest.java`.
