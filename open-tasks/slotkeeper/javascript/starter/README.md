# SlotKeeper

SlotKeeper is a young scheduling startup. Hosts publish when they're free each week and create meeting types such as a 30-minute intro call. Invitees open a booking page, see the open slots and pick one. The team already has the web app and the database. What it needs from you is the **booking engine** in the middle: a plain in-memory JavaScript class that decides which slots are open and accepts or rejects bookings.

Build it in `src/slotkeeper.js`. The error classes in `src/errors.js` and the helpers in `src/time.js` are finished, so use them as they are. Keep the method names and signatures from the stubs, because the acceptance tests call that interface. Use plain Node.js with no dependencies.

## Time model

- Time is measured in **integer minutes since the epoch, Monday 00:00 of week 0**. There are no time zones, no daylight saving and no seconds.
- A day has 1440 minutes. Day index `d` covers minutes `[d * 1440, (d + 1) * 1440)`. Its weekday is `d % 7`, where `0` is Monday and `6` is Sunday, so day 5 is a Saturday and day 7 is the next Monday.
- A *minute of the day* runs from `0` (00:00) to `1440` (24:00). For example, `540` is 09:00.
- Every interval is **half-open**: `[start, end)` includes `start` and excludes `end`. Two meetings that touch, one ending at 10:00 and the next starting at 10:00, don't overlap.
- Meetings start on a **15-minute grid**: a valid start time is a multiple of 15.
- Methods that depend on the current time take an explicit `now` argument (minutes since the epoch). Never read the real clock.
- A method that throws leaves the service exactly as it was.
- You may assume every number passed in is an integer and every day index is 0 or more.

Every error is a subclass of `BookingError`: `ValidationError`, `NotFoundError`, `TooSoonError`, `SlotUnavailableError`, `ConflictError` and `DailyLimitError`. Tests check the exact class, not the message.

## Part 1 · Core

**Hosts.** `addHost(hostId, windows)` registers a host and their weekly availability. `windows` is an array of `{ weekday, start, end }` objects, where `weekday` is 0–6 and `start` and `end` are minutes of the day. The host is free from `start` to `end` on every such weekday. Windows may overlap or touch, and a day's availability is the union of its windows. An empty array is allowed.

- Throws `ValidationError` if `hostId` is already registered, or if a window's weekday is outside 0–6 or it doesn't satisfy `0 <= start < end <= 1440`.

**Meeting types.** `addMeetingType(hostId, typeId, duration, { bufferBefore = 0, bufferAfter = 0, minNotice = 0 } = {})` defines a kind of meeting that a host offers. All four numbers are minutes. Type ids are unique across the whole service, and each type belongs to one host.

- Throws `NotFoundError` for an unknown host.
- Throws `ValidationError` if `typeId` already exists (for any host), if `duration` isn't between 1 and 1440, or if a buffer or `minNotice` is negative.
- In Part 1 you only store the buffers. Part 2 makes them block time.

**Booking.** `book(typeId, start, invitee, now)` books the meeting `[start, start + duration)` for `invitee` (a string) and returns the new booking id. Ids are the integers 1, 2, 3, … in order of successful bookings across the whole service. Failed attempts don't use up an id, and ids are never reused.

`book` runs these checks in this order and throws the error for the **first** one that fails:

1. `NotFoundError`: `typeId` is unknown.
2. `ValidationError`: `start` isn't a multiple of 15.
3. `TooSoonError`: `start < now + minNotice`. Starting exactly at `now + minNotice` is allowed. With a notice of 0, a meeting may start at `now` but not before it.
4. `SlotUnavailableError`: the meeting doesn't lie entirely inside the host's availability on the day that contains `start`. Meetings never cross midnight. A meeting may end at 24:00 but not later, even if the next day's availability starts at 00:00.
5. `ConflictError`: the meeting overlaps another booking of the same host, whatever its meeting type. Bookings of different hosts never conflict.
6. `DailyLimitError`: see Part 2.

**Open slots.** `listSlots(typeId, firstDay, lastDay, now)` returns, in ascending order, every start time on days `firstDay` to `lastDay` (both inclusive) that `book` would accept for this type at this `now`.

- Throws `NotFoundError` for an unknown type and `ValidationError` if `lastDay < firstDay`.

**Reading bookings.** `getBooking(bookingId)` returns a plain object `{ id, typeId, hostId, start, end, invitee }`. `listBookings(hostId)` returns the host's active bookings as such objects, sorted by `start`, or an empty array.

- `getBooking` throws `NotFoundError` for an unknown or cancelled id. `listBookings` throws `NotFoundError` for an unknown host.

## Part 2 · Buffers, changes and limits

**Buffers.** Each booking now also blocks `bufferBefore` minutes before its meeting and `bufferAfter` minutes after it, using its own meeting type's buffers. Its *blocked span* is `[start - bufferBefore, end + bufferAfter)`. A new booking conflicts with an existing booking of the same host (check 5) if either booking's meeting overlaps the other booking's blocked span. Put another way, the gap between an earlier meeting and a later one must be at least the larger of the earlier one's `bufferAfter` and the later one's `bufferBefore`. Buffers may overlap each other. They don't need to fit inside the host's availability; only the meeting itself does.

**Cancelling.** `cancel(bookingId)` removes a booking. Its time and its place in the daily count are free again straight away.

- Throws `NotFoundError` for an unknown or already cancelled id.

**Rescheduling.** `reschedule(bookingId, newStart, now)` moves a booking to `newStart`. It keeps its id, meeting type and invitee, and its `end` becomes `newStart + duration`.

- Throws `NotFoundError` first if the id is unknown or cancelled. Then it runs checks 2–6 exactly like `book`, using the booking's meeting type and **ignoring the booking being moved**, so a booking may move to a time that overlaps its old one.
- Rescheduling is atomic. If any check fails, the error is thrown and the booking keeps its original time.

**Daily limit.** `setDailyLimit(hostId, limit)` caps how many bookings the host accepts per day. A booking counts towards the day that contains its `start`, whatever its meeting type. `null` removes the cap, and hosts start with no cap. Lowering the cap never cancels existing bookings; it only blocks new ones.

- Check 6: `book` and `reschedule` throw `DailyLimitError` when the host already has `limit` active bookings on that day, not counting the booking being rescheduled.
- Throws `NotFoundError` for an unknown host and `ValidationError` if `limit` isn't `null` and is less than 1.

## Part 3 · Stretch

**Date overrides.** `setOverride(hostId, day, windows)` replaces the weekly pattern for one day index. `windows` is an array of `{ start, end }` minute-of-day objects, with the same rules and union behaviour as weekly windows. An empty array makes the day a day off. Calling it again for the same day replaces the earlier override. `clearOverride(hostId, day)` returns the day to the weekly pattern and does nothing if the day has no override. Overrides only affect later checks: existing bookings are kept even if they fall outside the new hours.

- Both throw `NotFoundError` for an unknown host. `setOverride` throws `ValidationError` for a malformed window.

**Busiest days.** `busiestDays(hostId, k)` returns up to `k` `{ day, count }` objects for the days on which the host has at least one active booking. They're sorted by `count` descending, then by `day` ascending.

- Throws `NotFoundError` for an unknown host and `ValidationError` if `k < 1`.

## Example

```javascript
const { SlotKeeper } = require('./src/slotkeeper');
const { at } = require('./src/time');

const keeper = new SlotKeeper();
keeper.addHost('ana', [{ weekday: 0, start: 540, end: 600 }]); // Mondays 09:00-10:00
keeper.addMeetingType('ana', 'intro', 30);
keeper.listSlots('intro', 7, 7, 0); // day 7 is the Monday of week 1
// [10620, 10635, 10650]               -> 09:00, 09:15 and 09:30
keeper.book('intro', at(7, 9, 30), 'sam@example.com', 0); // returns 1
keeper.listSlots('intro', 7, 7, 0); // [10620]
```

## Running the tests

```
npm test
```

This runs `node --test "tests/*.test.js"`. `tests/public.test.js` covers the basic happy path. Hidden acceptance tests check every rule above, including the edge cases and the error classes, so add your own tests as you go.
