// The TinyLink service. README.md has the full brief.
//
// Everything is in memory. There is no real clock: every time-dependent method
// takes `now`, an integer number of milliseconds since the Unix epoch (UTC).

const errors = require('./errors'); // eslint-disable-line no-unused-vars

// Base-62 digits, in value order: 0-9, then A-Z, then a-z.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CODE_LENGTH = 6;           // generated codes are left-padded with "0" to this length
const MAX_URL_LENGTH = 2048;     // inclusive
const ALIAS_MIN_LENGTH = 3;      // inclusive
const ALIAS_MAX_LENGTH = 30;     // inclusive
const MS_PER_DAY = 86_400_000;   // UTC day number = Math.floor(now / MS_PER_DAY)

/** In-memory URL shortener. */
class TinyLink {
  /**
   * @param {{maxLinksPerOwner?: number|null}} [options]
   *   `maxLinksPerOwner` caps each owner's *active* links (Part 2).
   *   `null` or omitted means no cap.
   */
  constructor({ maxLinksPerOwner = null } = {}) {
    this.maxLinksPerOwner = maxLinksPerOwner;
    // Add your own state here.
  }

  // ------------------------------------------------------------ Part 1 · Core

  /**
   * Create a link owned by `owner` and return its code.
   *
   * Without an alias the code is generated: base 62 of a counter that starts
   * at 1, left-padded with "0" to 6 characters, skipping (and consuming) any
   * candidate that clashes with a custom alias ever created. Otherwise the
   * alias is the code, returned exactly as given.
   *
   * Throws, checked in this order: InvalidUrlError, InvalidAliasError,
   * InvalidExpiryError (Part 2), AliasTakenError, QuotaExceededError (Part 2).
   * A call that throws changes nothing, not even the counter.
   *
   * @param {string} url
   * @param {string} owner
   * @param {number} now
   * @param {{alias?: string|null, expiresAt?: number|null}} [options]
   * @returns {string}
   */
  create(url, owner, now, { alias = null, expiresAt = null } = {}) {
    throw new Error('Not implemented: create (Part 1)');
  }

  /**
   * Return the link's URL and record one click at `now` by `visitorId`.
   *
   * A generated code matches only its exact spelling; an alias matches any
   * capitalisation. Throws LinkNotFoundError, LinkDeletedError (Part 3, wins
   * over expiry) or LinkExpiredError (Part 2, when now >= expiresAt).
   * Failed calls record no click.
   *
   * @param {string} code
   * @param {number} now
   * @param {string} visitorId
   * @returns {string}
   */
  resolve(code, now, visitorId) {
    throw new Error('Not implemented: resolve (Part 1)');
  }

  // ------------------------------------------------------------------ Part 2

  /**
   * Return click analytics for the link, including expired and deleted links.
   * Throws LinkNotFoundError if no link matches.
   *
   * @param {string} code
   * @returns {{totalClicks: number, uniqueVisitors: number, clicksByDay: Object<number, number>}}
   *   `clicksByDay` is a plain object mapping a UTC day number to that day's
   *   clicks. Days without clicks are left out.
   */
  stats(code) {
    throw new Error('Not implemented: stats (Part 2)');
  }

  // --------------------------------------------------------- Part 3 · Stretch

  /**
   * Soft-delete the link: it stops resolving, stops counting toward the quota
   * and releases its code, but keeps its clicks.
   * Throws LinkNotFoundError or, if already deleted, LinkDeletedError.
   *
   * @param {string} code
   * @returns {void}
   */
  delete(code) {
    throw new Error('Not implemented: delete (Part 3)');
  }

  /**
   * Undo a delete, keeping the link's clicks and expiry.
   *
   * Throws, in this order: LinkNotFoundError; RestoreConflictError if the
   * matching link is not deleted (it is live, or a newer link holds the code);
   * QuotaExceededError if the link would be active and the owner is already at
   * the cap.
   *
   * @param {string} code
   * @param {number} now
   * @returns {void}
   */
  restore(code, now) {
    throw new Error('Not implemented: restore (Part 3)');
  }

  /**
   * Return up to `n` [code, clicks] pairs for the owner's links.
   *
   * Clicks count only when their timestamp is >= since. Most clicks first;
   * ties go to the link created first. Deleted links and links with no clicks
   * in the window are left out; expired links are included.
   *
   * @param {string} owner
   * @param {number} n
   * @param {number} since
   * @returns {Array<[string, number]>}
   */
  topLinks(owner, n, since) {
    throw new Error('Not implemented: topLinks (Part 3)');
  }
}

module.exports = {
  TinyLink,
  ALPHABET,
  CODE_LENGTH,
  MAX_URL_LENGTH,
  ALIAS_MIN_LENGTH,
  ALIAS_MAX_LENGTH,
  MS_PER_DAY,
};
