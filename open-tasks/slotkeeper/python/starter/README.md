# SlotKeeper

SlotKeeper is a young scheduling startup. Hosts publish when they're free each week and create meeting types such as a 30-minute intro call. Invitees open a booking page, see the open slots and pick one. The team already has the web app and the database. What it needs from you is the **booking engine** in the middle: a plain in-memory Python class that decides which slots are open and accepts or rejects bookings.

Build it in `slotkeeper/service.py`. The error classes in `slotkeeper/errors.py` and the helpers in `slotkeeper/timeutil.py` are finished, so use them as they are. Keep the method names and signatures from the stubs, because the acceptance tests call that interface.

## Time model

- Time is measured in **integer minutes since the epoch, Monday 00:00 of week 0**. There are no time zones, no daylight saving and no seconds.
- A day has 1440 minutes. Day index `d` covers minutes `[d * 1440, (d + 1) * 1440)`. Its weekday is `d % 7`, where `0` is Monday and `6` is Sunday, so day 5 is a Saturday and day 7 is the next Monday.
- A *minute of the day* runs from `0` (00:00) to `1440` (24:00). For example, `540` is 09:00.
- Every interval is **half-open**: `[start, end)` includes `start` and excludes `end`. Two meetings that touch, one ending at 10:00 and the next starting at 10:00, don't overlap.
- Meetings start on a **15-minute grid**: a valid start time is a multiple of 15.
- Methods that depend on the current time take an explicit `now` argument (minutes since the epoch). Never read the real clock.
- A method that raises leaves the service exactly as it was.
- You may assume every number passed in is an integer and every day index is 0 or more.

Every error is a subclass of `BookingError`: `ValidationError`, `NotFoundError`, `TooSoonError`, `SlotUnavailableError`, `ConflictError` and `DailyLimitError`. Tests check the exact class, not the message.

## Part 1 · Core

**Hosts.** `add_host(host_id, windows)` registers a host and their weekly availability. `windows` is a list of `(weekday, start, end)` tuples, where `weekday` is 0–6 and `start` and `end` are minutes of the day. The host is free from `start` to `end` on every such weekday. Windows may overlap or touch, and a day's availability is the union of its windows. An empty list is allowed.

- Raises `ValidationError` if `host_id` is already registered, or if a window's weekday is outside 0–6 or it doesn't satisfy `0 <= start < end <= 1440`.

**Meeting types.** `add_meeting_type(host_id, type_id, duration, *, buffer_before=0, buffer_after=0, min_notice=0)` defines a kind of meeting that a host offers. All four numbers are minutes. Type ids are unique across the whole service, and each type belongs to one host.

- Raises `NotFoundError` for an unknown host.
- Raises `ValidationError` if `type_id` already exists (for any host), if `duration` isn't between 1 and 1440, or if a buffer or `min_notice` is negative.
- In Part 1 you only store the buffers. Part 2 makes them block time.

**Booking.** `book(type_id, start, invitee, now)` books the meeting `[start, start + duration)` for `invitee` (a string) and returns the new booking id. Ids are the integers 1, 2, 3, … in order of successful bookings across the whole service. Failed attempts don't use up an id, and ids are never reused.

`book` runs these checks in this order and raises the error for the **first** one that fails:

1. `NotFoundError`: `type_id` is unknown.
2. `ValidationError`: `start` isn't a multiple of 15.
3. `TooSoonError`: `start < now + min_notice`. Starting exactly at `now + min_notice` is allowed. With a notice of 0, a meeting may start at `now` but not before it.
4. `SlotUnavailableError`: the meeting doesn't lie entirely inside the host's availability on the day that contains `start`. Meetings never cross midnight. A meeting may end at 24:00 but not later, even if the next day's availability starts at 00:00.
5. `ConflictError`: the meeting overlaps another booking of the same host, whatever its meeting type. Bookings of different hosts never conflict.
6. `DailyLimitError`: see Part 2.

**Open slots.** `list_slots(type_id, first_day, last_day, now)` returns, in ascending order, every start time on days `first_day` to `last_day` (both inclusive) that `book` would accept for this type at this `now`.

- Raises `NotFoundError` for an unknown type and `ValidationError` if `last_day < first_day`.

**Reading bookings.** `get_booking(booking_id)` returns a dict with the keys `id`, `type_id`, `host_id`, `start`, `end` and `invitee`. `list_bookings(host_id)` returns the host's active bookings as such dicts, sorted by `start`, or an empty list.

- `get_booking` raises `NotFoundError` for an unknown or cancelled id. `list_bookings` raises `NotFoundError` for an unknown host.

## Part 2 · Buffers, changes and limits

**Buffers.** Each booking now also blocks `buffer_before` minutes before its meeting and `buffer_after` minutes after it, using its own meeting type's buffers. Its *blocked span* is `[start - buffer_before, end + buffer_after)`. A new booking conflicts with an existing booking of the same host (check 5) if either booking's meeting overlaps the other booking's blocked span. Put another way, the gap between an earlier meeting and a later one must be at least the larger of the earlier one's `buffer_after` and the later one's `buffer_before`. Buffers may overlap each other. They don't need to fit inside the host's availability; only the meeting itself does.

**Cancelling.** `cancel(booking_id)` removes a booking. Its time and its place in the daily count are free again straight away.

- Raises `NotFoundError` for an unknown or already cancelled id.

**Rescheduling.** `reschedule(booking_id, new_start, now)` moves a booking to `new_start`. It keeps its id, meeting type and invitee, and its `end` becomes `new_start + duration`.

- Raises `NotFoundError` first if the id is unknown or cancelled. Then it runs checks 2–6 exactly like `book`, using the booking's meeting type and **ignoring the booking being moved**, so a booking may move to a time that overlaps its old one.
- Rescheduling is atomic. If any check fails, the error is raised and the booking keeps its original time.

**Daily limit.** `set_daily_limit(host_id, limit)` caps how many bookings the host accepts per day. A booking counts towards the day that contains its `start`, whatever its meeting type. `None` removes the cap, and hosts start with no cap. Lowering the cap never cancels existing bookings; it only blocks new ones.

- Check 6: `book` and `reschedule` raise `DailyLimitError` when the host already has `limit` active bookings on that day, not counting the booking being rescheduled.
- Raises `NotFoundError` for an unknown host and `ValidationError` if `limit` isn't `None` and is less than 1.

## Part 3 · Stretch

**Date overrides.** `set_override(host_id, day, windows)` replaces the weekly pattern for one day index. `windows` is a list of `(start, end)` minute-of-day tuples, with the same rules and union behaviour as weekly windows. An empty list makes the day a day off. Calling it again for the same day replaces the earlier override. `clear_override(host_id, day)` returns the day to the weekly pattern and does nothing if the day has no override. Overrides only affect later checks: existing bookings are kept even if they fall outside the new hours.

- Both raise `NotFoundError` for an unknown host. `set_override` raises `ValidationError` for a malformed window.

**Busiest days.** `busiest_days(host_id, k)` returns up to `k` `(day, count)` tuples for the days on which the host has at least one active booking. They're sorted by `count` descending, then by `day` ascending.

- Raises `NotFoundError` for an unknown host and `ValidationError` if `k < 1`.

## Example

```python
from slotkeeper import SlotKeeper
from slotkeeper.timeutil import at

keeper = SlotKeeper()
keeper.add_host("ana", [(0, 540, 600)])        # Mondays 09:00-10:00
keeper.add_meeting_type("ana", "intro", 30)
keeper.list_slots("intro", 7, 7, now=0)        # day 7 is the Monday of week 1
# [10620, 10635, 10650]                        -> 09:00, 09:15 and 09:30
keeper.book("intro", at(7, 9, 30), "sam@example.com", now=0)   # returns 1
keeper.list_slots("intro", 7, 7, now=0)        # [10620]
```

## Running the tests

```
python -m unittest discover -s tests -v
```

`tests/test_public.py` covers the basic happy path. Hidden acceptance tests check every rule above, including the edge cases and the error classes, so add your own tests as you go.
