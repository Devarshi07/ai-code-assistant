// The SlotKeeper booking engine (reference solution).
//
// Conventions used by every method:
// - Times are integer minutes since Monday 00:00 of week 0 (see ./time.js).
// - Intervals are half-open: [start, end).
// - Methods that depend on the current time take `now` explicitly.
// - A method that throws leaves the service exactly as it was.

const {
  ValidationError,
  NotFoundError,
  TooSoonError,
  SlotUnavailableError,
  ConflictError,
  DailyLimitError,
} = require('./errors');
const { MINUTES_PER_DAY, SLOT_MINUTES, dayOf, weekdayOf, describe } = require('./time');

/** Validate one minute-of-day span. */
function span(start, end) {
  if (!(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start < end && end <= MINUTES_PER_DAY)) {
    throw new ValidationError(`a window needs 0 <= start < end <= 1440, got (${start}, ${end})`);
  }
  return [start, end];
}

/** Union of spans as a sorted array of disjoint, non-touching spans. */
function merge(spans) {
  const merged = [];
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
const isNonNegativeInt = value => Number.isInteger(value) && value >= 0;
const view = b => ({ id: b.id, typeId: b.typeId, hostId: b.hostId, start: b.start, end: b.end, invitee: b.invitee });

/** In-memory booking engine for hosts, meeting types and bookings. */
class SlotKeeper {
  constructor() {
    this.hosts = new Map();     // hostId -> { weekly: spans[7], overrides: Map(day -> spans), dailyLimit }
    this.types = new Map();     // typeId -> { hostId, typeId, duration, before, after, notice }
    this.bookings = new Map();  // bookingId -> record
    this.nextId = 1;
  }

  // ---------------------------------------------------------------- lookups

  host(hostId) {
    const host = this.hosts.get(hostId);
    if (!host) throw new NotFoundError(`unknown host ${hostId}`);
    return host;
  }

  type(typeId) {
    const type = this.types.get(typeId);
    if (!type) throw new NotFoundError(`unknown meeting type ${typeId}`);
    return type;
  }

  booking(bookingId) {
    const booking = this.bookings.get(bookingId);
    if (!booking) throw new NotFoundError(`unknown booking ${bookingId}`);
    return booking;
  }

  // ----------------------------------------------------------------- Part 1

  addHost(hostId, windows) {
    if (this.hosts.has(hostId)) throw new ValidationError(`host ${hostId} already exists`);
    const weekly = Array.from({ length: 7 }, () => []);
    for (const window of windows) {
      const { weekday, start, end } = window || {};
      if (!(Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) throw new ValidationError(`weekday must be 0-6, got ${weekday}`);
      weekly[weekday].push(span(start, end));
    }
    this.hosts.set(hostId, { weekly: weekly.map(merge), overrides: new Map(), dailyLimit: null });
  }

  addMeetingType(hostId, typeId, duration, { bufferBefore = 0, bufferAfter = 0, minNotice = 0 } = {}) {
    this.host(hostId);
    if (this.types.has(typeId)) throw new ValidationError(`meeting type ${typeId} already exists`);
    if (!(Number.isInteger(duration) && duration >= 1 && duration <= MINUTES_PER_DAY)) {
      throw new ValidationError(`duration must be 1-1440 minutes, got ${duration}`);
    }
    for (const [name, value] of [['bufferBefore', bufferBefore], ['bufferAfter', bufferAfter], ['minNotice', minNotice]]) {
      if (!isNonNegativeInt(value)) throw new ValidationError(`${name} must be a non-negative integer, got ${value}`);
    }
    this.types.set(typeId, { hostId, typeId, duration, before: bufferBefore, after: bufferAfter, notice: minNotice });
  }

  listSlots(typeId, firstDay, lastDay, now) {
    const type = this.type(typeId);
    if (lastDay < firstDay) throw new ValidationError('lastDay must not be before firstDay');
    const slots = [];
    for (let day = firstDay; day <= lastDay; day++) {
      const base = day * MINUTES_PER_DAY;
      for (let start = base; start < base + MINUTES_PER_DAY; start += SLOT_MINUTES) {
        if (this.problem(type, start, now) === null) slots.push(start);
      }
    }
    return slots;
  }

  book(typeId, start, invitee, now) {
    const type = this.type(typeId);
    const problem = this.problem(type, start, now);
    if (problem) throw problem;
    const id = this.nextId++;
    this.bookings.set(id, { id, typeId: type.typeId, hostId: type.hostId, start, end: start + type.duration, invitee });
    return id;
  }

  getBooking(bookingId) {
    return view(this.booking(bookingId));
  }

  listBookings(hostId) {
    this.host(hostId);
    return [...this.bookings.values()]
      .filter(b => b.hostId === hostId)
      .sort((a, b) => a.start - b.start || a.id - b.id)
      .map(view);
  }

  // ----------------------------------------------------------------- Part 2

  cancel(bookingId) {
    this.booking(bookingId);
    this.bookings.delete(bookingId);
  }

  reschedule(bookingId, newStart, now) {
    const booking = this.booking(bookingId);
    const type = this.types.get(booking.typeId);
    const problem = this.problem(type, newStart, now, bookingId);
    if (problem) throw problem;
    booking.start = newStart;
    booking.end = newStart + type.duration;
  }

  setDailyLimit(hostId, limit) {
    const host = this.host(hostId);
    if (limit != null && !(Number.isInteger(limit) && limit >= 1)) {
      throw new ValidationError(`limit must be null or at least 1, got ${limit}`);
    }
    host.dailyLimit = limit ?? null;
  }

  // ----------------------------------------------------------------- Part 3

  setOverride(hostId, day, windows) {
    const host = this.host(hostId);
    if (!Number.isInteger(day)) throw new ValidationError(`day must be an integer, got ${day}`);
    const spans = windows.map(window => {
      const { start, end } = window || {};
      return span(start, end);
    });
    host.overrides.set(day, merge(spans));
  }

  clearOverride(hostId, day) {
    this.host(hostId).overrides.delete(day);
  }

  busiestDays(hostId, k) {
    this.host(hostId);
    if (!(Number.isInteger(k) && k >= 1)) throw new ValidationError(`k must be at least 1, got ${k}`);
    const counts = new Map();
    for (const b of this.bookings.values()) {
      if (b.hostId !== hostId) continue;
      const day = dayOf(b.start);
      counts.set(day, (counts.get(day) || 0) + 1);
    }
    return [...counts]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => b.count - a.count || a.day - b.day)
      .slice(0, k);
  }

  // ---------------------------------------------------------------- checks

  spansFor(host, day) {
    return host.overrides.has(day) ? host.overrides.get(day) : host.weekly[weekdayOf(day)];
  }

  /** Return the error for the first failing check (2-6), or null. */
  problem(type, start, now, ignoreId = null) {
    if (!Number.isInteger(start) || start % SLOT_MINUTES !== 0) {
      return new ValidationError(`start must be a multiple of ${SLOT_MINUTES} minutes, got ${start}`);
    }
    if (start < now + type.notice) return new TooSoonError(`${describe(start)} is inside the ${type.notice}-minute notice period`);
    const end = start + type.duration;
    const host = this.hosts.get(type.hostId);
    const day = dayOf(start);
    const base = day * MINUTES_PER_DAY;
    if (!this.spansFor(host, day).some(([s, e]) => base + s <= start && end <= base + e)) {
      return new SlotUnavailableError(`the host is not available for all of ${describe(start)}-${describe(end)}`);
    }
    const others = [...this.bookings.values()].filter(b => b.hostId === type.hostId && b.id !== ignoreId);
    for (const other of others) {
      const otherType = this.types.get(other.typeId);
      if (
        overlaps(start - type.before, end + type.after, other.start, other.end) ||
        overlaps(start, end, other.start - otherType.before, other.end + otherType.after)
      ) {
        return new ConflictError(`${describe(start)} collides with booking ${other.id}`);
      }
    }
    if (host.dailyLimit !== null && others.filter(b => dayOf(b.start) === day).length >= host.dailyLimit) {
      return new DailyLimitError(`day ${day} already has ${host.dailyLimit} bookings`);
    }
    return null;
  }
}

module.exports = { SlotKeeper };
