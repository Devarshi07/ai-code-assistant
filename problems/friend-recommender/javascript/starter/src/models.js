// Member records and the small parsing helpers shared by the loaders.

const ID_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Raised when a member record is malformed. */
class ModelError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelError';
  }
}

/** Returns userId if it is a valid Campfire handle, else throws ModelError. */
function checkId(userId) {
  if (typeof userId !== 'string' || !ID_PATTERN.test(userId)) throw new ModelError(`invalid member id '${userId}'`);
  return userId;
}

/** '  Board Games ' -> 'board-games'. */
function normalizeInterest(tag) {
  return tag.toLowerCase().split(/\s+/).filter(Boolean).join('-');
}

/** Parse a ';'-separated interest list into a Set of normalized tags. */
function parseInterests(text) {
  return new Set(text.split(';').filter(tag => tag.trim()).map(normalizeInterest));
}

/** Validate a YYYY-MM-DD date from an export. Dates are kept as ISO strings. */
function parseDate(text) {
  const match = DATE_PATTERN.exec(String(text).trim());
  if (match) {
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return match[0];
  }
  throw new ModelError(`invalid date '${text}'; expected YYYY-MM-DD`);
}

/** One Campfire member. Members are identified by their handle, `id`. */
class User {
  constructor(id, name, joined, interests = [], active = true) {
    this.id = checkId(id);
    if (!String(name).trim()) throw new ModelError(`${id}: name must not be empty`);
    this.name = name;
    this.joined = joined;
    this.interests = new Set(interests);
    this.active = active;
  }

  get firstName() {
    return this.name.split(/\s+/)[0];
  }

  /** 'Apr 2019'. */
  get memberSince() {
    const [year, month] = this.joined.split('-').map(Number);
    return `${MONTHS[month - 1]} ${year}`;
  }

  toString() {
    return `${this.name} (@${this.id})`;
  }
}

module.exports = { User, ModelError, checkId, normalizeInterest, parseInterests, parseDate };
