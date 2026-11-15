// Errors raised by the booking engine.
//
// Everything SlotKeeper throws on purpose is a BookingError, so the web layer
// can catch the whole family at once and turn it into a friendly message.
// Tests check the exact subclass, never the message text.

/** Base class for every error SlotKeeper throws on purpose. */
class BookingError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Malformed input: a bad window, duration, buffer, range or limit, an
 * off-grid start time, or a duplicate host or meeting-type id.
 */
class ValidationError extends BookingError {}

/** Unknown host, meeting type or booking id. Cancelled bookings count as unknown. */
class NotFoundError extends BookingError {}

/** The start time is earlier than `now + minNotice`. */
class TooSoonError extends BookingError {}

/** The meeting does not fit inside the host's availability for that day. */
class SlotUnavailableError extends BookingError {}

/** The meeting, or a buffer around it, collides with another booking of the same host. */
class ConflictError extends BookingError {}

/** The host already has as many bookings on that day as their daily limit allows. */
class DailyLimitError extends BookingError {}

module.exports = {
  BookingError,
  ValidationError,
  NotFoundError,
  TooSoonError,
  SlotUnavailableError,
  ConflictError,
  DailyLimitError,
};
