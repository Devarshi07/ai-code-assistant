const {ValidationError} = require('./errors');

const ALIAS = /^[A-Za-z0-9_-]{3,32}$/;
const RESERVED = new Set(['api', 'health', 'admin']);
const MAX_URL_LENGTH = 2048;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

// Checks a POST /api/links body and returns {url, alias, expiresAt}, where
// alias is null for a generated slug and expiresAt is an ISO string or null.
// Every problem is reported at once, keyed by field name.
function parseCreateInput(body, now) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError({body: 'must be a JSON object'});
  }
  const fields = {};
  const {url, alias, expiresAt} = body;

  if (typeof url !== 'string' || url.length > MAX_URL_LENGTH) {
    fields.url = `must be an http(s) URL of at most ${MAX_URL_LENGTH} characters`;
  } else {
    let parsed = null;
    try { parsed = new URL(url); } catch { /* reported below */ }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) fields.url = 'must be an absolute http or https URL';
  }

  if (alias !== undefined && alias !== null) {
    if (typeof alias !== 'string' || !ALIAS.test(alias)) {
      fields.alias = 'must be 3 to 32 letters, digits, dashes or underscores';
    } else if (RESERVED.has(alias.toLowerCase())) {
      fields.alias = 'is reserved';
    }
  }

  let expiry = null;
  if (expiresAt !== undefined && expiresAt !== null) {
    const time = typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN;
    if (Number.isNaN(time)) fields.expiresAt = 'must be an ISO 8601 date-time';
    else if (time <= now.getTime()) fields.expiresAt = 'must be in the future';
    else expiry = new Date(time).toISOString();
  }

  if (Object.keys(fields).length) throw new ValidationError(fields);
  return {url, alias: alias ?? null, expiresAt: expiry};
}

// A YYYY-MM-DD string naming a real calendar day -> that day's UTC midnight in
// epoch ms, otherwise null ("2026-02-30" and "2026-2-1" are both rejected).
function parseDay(value) {
  if (typeof value !== 'string' || !DAY_FORMAT.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) return null;
  return time;
}

// Checks ?from=&to= for the stats endpoint. Missing bounds default to the day
// the link was created and to today (UTC). Returns {from, to, fromMs, toMs}:
// the two days as YYYY-MM-DD and as UTC midnights (epoch ms).
function parseStatsQuery(query, createdAt, now) {
  const fields = {};
  const bound = (name, fallback) => {
    if (query[name] === undefined) return fallback;
    const time = parseDay(query[name]);
    if (time === null) fields[name] = 'must be a calendar day written as YYYY-MM-DD';
    return time;
  };
  const fromMs = bound('from', parseDay(createdAt.slice(0, 10)));
  const toMs = bound('to', parseDay(now.toISOString().slice(0, 10)));

  if (!fields.from && !fields.to) {
    if (fromMs > toMs) fields.from = 'must not be after to';
    else if ((toMs - fromMs) / DAY_MS + 1 > MAX_RANGE_DAYS) fields.to = `the range must not exceed ${MAX_RANGE_DAYS} days`;
  }
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return {
    from: new Date(fromMs).toISOString().slice(0, 10),
    to: new Date(toMs).toISOString().slice(0, 10),
    fromMs,
    toMs
  };
}

module.exports = {parseCreateInput, parseStatsQuery, DAY_MS};
