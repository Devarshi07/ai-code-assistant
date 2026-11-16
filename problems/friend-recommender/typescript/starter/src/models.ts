// Member records and the small parsing helpers shared by the loaders.

const ID_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Raised when a member record is malformed. */
export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelError';
  }
}

/** Returns userId if it is a valid Campfire handle, else throws ModelError. */
export function checkId(userId: string): string {
  if (typeof userId !== 'string' || !ID_PATTERN.test(userId)) throw new ModelError(`invalid member id '${userId}'`);
  return userId;
}

/** '  Board Games ' -> 'board-games'. */
export function normalizeInterest(tag: string): string {
  return tag.toLowerCase().split(/\s+/).filter(Boolean).join('-');
}

/** Parse a ';'-separated interest list into a Set of normalized tags. */
export function parseInterests(text: string): Set<string> {
  return new Set(text.split(';').filter(tag => tag.trim()).map(normalizeInterest));
}

/** Validate a YYYY-MM-DD date from an export. Dates are kept as ISO strings. */
export function parseDate(text: string): string {
  const match = DATE_PATTERN.exec(String(text).trim());
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return match[0];
  }
  throw new ModelError(`invalid date '${text}'; expected YYYY-MM-DD`);
}

/** One Campfire member. Members are identified by their handle, `id`. */
export class User {
  readonly id: string;
  readonly name: string;
  readonly joined: string; // YYYY-MM-DD
  readonly interests: ReadonlySet<string>;
  active: boolean;

  constructor(id: string, name: string, joined: string, interests: Iterable<string> = [], active = true) {
    this.id = checkId(id);
    if (!String(name).trim()) throw new ModelError(`${id}: name must not be empty`);
    this.name = name;
    this.joined = joined;
    this.interests = new Set(interests);
    this.active = active;
  }

  get firstName(): string {
    return this.name.split(/\s+/)[0];
  }

  /** 'Apr 2019'. */
  get memberSince(): string {
    const [year, month] = this.joined.split('-').map(Number);
    return `${MONTHS[month - 1]} ${year}`;
  }

  toString(): string {
    return `${this.name} (@${this.id})`;
  }
}
