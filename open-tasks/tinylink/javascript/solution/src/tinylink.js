// The TinyLink service. README.md has the full brief.
//
// Everything is in memory. There is no real clock: every time-dependent method
// takes `now`, an integer number of milliseconds since the Unix epoch (UTC).

const {
  AliasTakenError,
  InvalidAliasError,
  InvalidExpiryError,
  InvalidUrlError,
  LinkDeletedError,
  LinkExpiredError,
  LinkNotFoundError,
  QuotaExceededError,
  RestoreConflictError,
} = require('./errors');

// Base-62 digits, in value order: 0-9, then A-Z, then a-z.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CODE_LENGTH = 6;           // generated codes are left-padded with "0" to this length
const MAX_URL_LENGTH = 2048;     // inclusive
const ALIAS_MIN_LENGTH = 3;      // inclusive
const ALIAS_MAX_LENGTH = 30;     // inclusive
const MS_PER_DAY = 86_400_000;   // UTC day number = Math.floor(now / MS_PER_DAY)

const ALIAS_PATTERN = /^[A-Za-z0-9-]+$/;
const WHITESPACE = /[ \t\r\n]/;

function encodeBase62(number) {
  let out = '';
  while (number > 0) {
    out = ALPHABET[number % 62] + out;
    number = Math.floor(number / 62);
  }
  return out.padStart(CODE_LENGTH, '0');
}

function validateUrl(url) {
  if (typeof url !== 'string' || url.length > MAX_URL_LENGTH) throw new InvalidUrlError(String(url));
  const lowered = url.toLowerCase();
  const scheme = ['http://', 'https://'].find(s => lowered.startsWith(s));
  if (!scheme) throw new InvalidUrlError(url);
  const rest = url.slice(scheme.length);
  const hostEnd = rest.search(/[/?#]/);
  if (hostEnd === 0 || rest.length === 0) throw new InvalidUrlError(url);
  if (WHITESPACE.test(url)) throw new InvalidUrlError(url);
}

function validateAlias(alias) {
  if (
    typeof alias !== 'string' ||
    alias.length < ALIAS_MIN_LENGTH ||
    alias.length > ALIAS_MAX_LENGTH ||
    !ALIAS_PATTERN.test(alias)
  ) {
    throw new InvalidAliasError(String(alias));
  }
}

class Link {
  constructor(seq, code, url, owner, isAlias, expiresAt) {
    Object.assign(this, { seq, code, url, owner, isAlias, expiresAt, deleted: false, clicks: [] });
  }

  matches(code) {
    return this.isAlias ? this.code.toLowerCase() === code.toLowerCase() : this.code === code;
  }

  expired(now) {
    return this.expiresAt !== null && now >= this.expiresAt;
  }

  active(now) {
    return !this.deleted && !this.expired(now);
  }
}

/** In-memory URL shortener. */
class TinyLink {
  constructor({ maxLinksPerOwner = null } = {}) {
    this.maxLinksPerOwner = maxLinksPerOwner;
    this._counter = 1;
    this._seq = 0;
    this._liveGenerated = new Map();      // exact code -> link
    this._liveGeneratedLower = new Map(); // lowercased code -> how many
    this._liveAliases = new Map();        // lowercased alias -> link
    this._aliasesEver = new Set();        // lowercased aliases ever created
    this._deleted = [];                   // in deletion order
    this._byOwner = new Map();
  }

  // ----------------------------------------------------------------- helpers

  _find(code) {
    const live = this._liveGenerated.get(code) || this._liveAliases.get(code.toLowerCase());
    if (live) return live;
    for (let i = this._deleted.length - 1; i >= 0; i--) {
      if (this._deleted[i].matches(code)) return this._deleted[i];
    }
    return null;
  }

  _get(code) {
    const link = this._find(String(code));
    if (!link) throw new LinkNotFoundError(String(code));
    return link;
  }

  _clashesWithLive(code, isAlias) {
    const key = code.toLowerCase();
    if (this._liveAliases.has(key)) return true;
    return isAlias && (this._liveGeneratedLower.get(key) || 0) > 0;
  }

  _atQuota(owner, now) {
    if (this.maxLinksPerOwner === null || this.maxLinksPerOwner === undefined) return false;
    const active = (this._byOwner.get(owner) || []).filter(link => link.active(now)).length;
    return active >= this.maxLinksPerOwner;
  }

  _nextCode() {
    for (;;) {
      const candidate = encodeBase62(this._counter);
      this._counter += 1;
      if (!this._aliasesEver.has(candidate.toLowerCase())) return candidate;
    }
  }

  _hold(link) {
    const key = link.code.toLowerCase();
    if (link.isAlias) {
      this._liveAliases.set(key, link);
    } else {
      this._liveGenerated.set(link.code, link);
      this._liveGeneratedLower.set(key, (this._liveGeneratedLower.get(key) || 0) + 1);
    }
  }

  _release(link) {
    const key = link.code.toLowerCase();
    if (link.isAlias) {
      this._liveAliases.delete(key);
    } else {
      this._liveGenerated.delete(link.code);
      const left = this._liveGeneratedLower.get(key) - 1;
      if (left) this._liveGeneratedLower.set(key, left);
      else this._liveGeneratedLower.delete(key);
    }
  }

  // ------------------------------------------------------------ Part 1 · Core

  create(url, owner, now, { alias = null, expiresAt = null } = {}) {
    const hasAlias = alias !== null && alias !== undefined;
    const expiry = expiresAt === undefined ? null : expiresAt;
    validateUrl(url);
    if (hasAlias) validateAlias(alias);
    if (expiry !== null && expiry <= now) throw new InvalidExpiryError(String(expiry));
    if (hasAlias && this._clashesWithLive(alias, true)) throw new AliasTakenError(alias);
    if (this._atQuota(owner, now)) throw new QuotaExceededError(String(owner));

    let code;
    if (hasAlias) {
      code = alias;
      this._aliasesEver.add(alias.toLowerCase());
    } else {
      code = this._nextCode();
    }
    this._seq += 1;
    const link = new Link(this._seq, code, url, owner, hasAlias, expiry);
    this._hold(link);
    if (!this._byOwner.has(owner)) this._byOwner.set(owner, []);
    this._byOwner.get(owner).push(link);
    return code;
  }

  resolve(code, now, visitorId) {
    const link = this._get(code);
    if (link.deleted) throw new LinkDeletedError(code);
    if (link.expired(now)) throw new LinkExpiredError(code);
    link.clicks.push({ at: now, visitorId });
    return link.url;
  }

  // ------------------------------------------------------------------ Part 2

  stats(code) {
    const link = this._get(code);
    const clicksByDay = {};
    for (const { at } of link.clicks) {
      const day = Math.floor(at / MS_PER_DAY);
      clicksByDay[day] = (clicksByDay[day] || 0) + 1;
    }
    return {
      totalClicks: link.clicks.length,
      uniqueVisitors: new Set(link.clicks.map(click => click.visitorId)).size,
      clicksByDay,
    };
  }

  // --------------------------------------------------------- Part 3 · Stretch

  delete(code) {
    const link = this._get(code);
    if (link.deleted) throw new LinkDeletedError(code);
    link.deleted = true;
    this._release(link);
    this._deleted.push(link);
  }

  restore(code, now) {
    const link = this._get(code);
    if (!link.deleted || this._clashesWithLive(link.code, link.isAlias)) throw new RestoreConflictError(code);
    if (!link.expired(now) && this._atQuota(link.owner, now)) throw new QuotaExceededError(String(link.owner));
    link.deleted = false;
    this._deleted = this._deleted.filter(other => other !== link);
    this._hold(link);
  }

  topLinks(owner, n, since) {
    const rows = [];
    for (const link of this._byOwner.get(owner) || []) {
      if (link.deleted) continue;
      const clicks = link.clicks.filter(click => click.at >= since).length;
      if (clicks) rows.push({ link, clicks });
    }
    rows.sort((a, b) => b.clicks - a.clicks || a.link.seq - b.link.seq);
    return rows.slice(0, Math.max(n, 0)).map(({ link, clicks }) => [link.code, clicks]);
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
