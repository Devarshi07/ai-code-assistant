// The SlotKeeper booking engine. README.md has the full brief.
//
// Conventions used by every method:
// - Times are integer minutes since Monday 00:00 of week 0 (see ./time.js).
// - Intervals are half-open: [start, end).
// - Methods that depend on the current time take `now` explicitly.
// - A method that throws leaves the service exactly as it was.

/* eslint-disable no-unused-vars */
const {
  ValidationError,
  NotFoundError,
  TooSoonError,
  SlotUnavailableError,
  ConflictError,
  DailyLimitError,
} = require('./errors');
const { MINUTES_PER_DAY, SLOT_MINUTES, dayOf, weekdayOf } = require('./time');

/** In-memory booking engine for hosts, meeting types and bookings. */
class SlotKeeper {
  constructor() {
    // set up your state here
  }

  // ------------------------------------------------------------------
  // Part 1 · Core
  // ------------------------------------------------------------------

  /**
   * Register a host with a weekly availability pattern.
   *
   * `windows` is an array of `{ weekday, start, end }`: weekday is 0-6
   * (0 = Monday) and start/end are minutes of the day with
   * 0 <= start < end <= 1440. The host is free from start (inclusive) to end
   * (exclusive) on every such weekday. Windows may overlap or touch; a day's
   * availability is the union of its windows. An empty array is allowed.
   *
   * Throws ValidationError for a duplicate hostId or a malformed window.
   */
  addHost(hostId, windows) {
    throw new Error('Not implemented: addHost (Part 1)');
  }

  /**
   * Define a meeting type offered by `hostId`. All numbers are minutes.
   * `typeId` is unique across the whole service. Buffers are stored in Part 1
   * and enforced in Part 2.
   *
   * Throws NotFoundError for an unknown host. Throws ValidationError for a
   * duplicate typeId, a duration outside 1..1440, or a negative buffer or
   * minNotice.
   */
  addMeetingType(hostId, typeId, duration, { bufferBefore = 0, bufferAfter = 0, minNotice = 0 } = {}) {
    throw new Error('Not implemented: addMeetingType (Part 1)');
  }

  /**
   * Return every start time `book` would accept right now, ascending.
   * Covers the day indices firstDay to lastDay, both inclusive. Candidate
   * starts are the multiples of 15 minutes within those days.
   *
   * Throws NotFoundError for an unknown type, ValidationError if
   * lastDay < firstDay.
   */
  listSlots(typeId, firstDay, lastDay, now) {
    throw new Error('Not implemented: listSlots (Part 1)');
  }

  /**
   * Book [start, start + duration) for `invitee` and return the new id.
   * Ids are 1, 2, 3, ... in order of successful bookings and are never
   * reused. Checks run in this order and the first failure is thrown:
   *
   *   1. NotFoundError         unknown typeId
   *   2. ValidationError       start is not a multiple of 15
   *   3. TooSoonError          start < now + minNotice
   *   4. SlotUnavailableError  the meeting is not inside the host's
   *                            availability on the day containing start
   *                            (meetings never cross midnight)
   *   5. ConflictError         overlaps another booking of the same host
   *                            (Part 2: including buffers)
   *   6. DailyLimitError       Part 2: the host's daily limit is reached
   */
  book(typeId, start, invitee, now) {
    throw new Error('Not implemented: book (Part 1)');
  }

  /**
   * Return `{ id, typeId, hostId, start, end, invitee }`.
   * Throws NotFoundError for an unknown or cancelled id.
   */
  getBooking(bookingId) {
    throw new Error('Not implemented: getBooking (Part 1)');
  }

  /**
   * Return the host's active bookings (objects as above), sorted by start.
   * Throws NotFoundError for an unknown host.
   */
  listBookings(hostId) {
    throw new Error('Not implemented: listBookings (Part 1)');
  }

  // ------------------------------------------------------------------
  // Part 2 · Buffers, changes and limits
  // ------------------------------------------------------------------

  /**
   * Remove a booking, freeing its time and its place in the daily count.
   * Throws NotFoundError for an unknown or already cancelled id.
   */
  cancel(bookingId) {
    throw new Error('Not implemented: cancel (Part 2)');
  }

  /**
   * Move a booking to `newStart`, keeping its id, type and invitee.
   * Throws NotFoundError first for an unknown or cancelled id, then runs
   * checks 2-6 of `book` using the booking's meeting type and ignoring the
   * booking being moved. Atomic: on any error the booking keeps its
   * original time.
   */
  reschedule(bookingId, newStart, now) {
    throw new Error('Not implemented: reschedule (Part 2)');
  }

  /**
   * Allow at most `limit` bookings per day for this host; `null` removes the
   * cap. A booking counts towards the day containing its start, whatever its
   * meeting type. Existing bookings are never cancelled by a lower cap.
   *
   * Throws NotFoundError for an unknown host, ValidationError if limit is
   * not null and less than 1.
   */
  setDailyLimit(hostId, limit) {
    throw new Error('Not implemented: setDailyLimit (Part 2)');
  }

  // ------------------------------------------------------------------
  // Part 3 · Stretch
  // ------------------------------------------------------------------

  /**
   * Replace the weekly pattern for one day index. `windows` is an array of
   * `{ start, end }` minute-of-day objects with the same rules as weekly
   * windows; an empty array makes the day a day off. Setting an override
   * again replaces the earlier one. Existing bookings are kept.
   *
   * Throws NotFoundError for an unknown host, ValidationError for a
   * malformed window.
   */
  setOverride(hostId, day, windows) {
    throw new Error('Not implemented: setOverride (Part 3)');
  }

  /**
   * Return `day` to the weekly pattern. Does nothing if there is no override.
   * Throws NotFoundError for an unknown host.
   */
  clearOverride(hostId, day) {
    throw new Error('Not implemented: clearOverride (Part 3)');
  }

  /**
   * Return up to `k` `{ day, count }` objects, busiest first. Only days with
   * at least one active booking appear. Sorted by count descending, then day
   * ascending.
   *
   * Throws NotFoundError for an unknown host, ValidationError if k < 1.
   */
  busiestDays(hostId, k) {
    throw new Error('Not implemented: busiestDays (Part 3)');
  }
}

module.exports = { SlotKeeper };
