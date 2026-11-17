const {ValidationError} = require('./errors');

const ALIAS = /^[A-Za-z0-9_-]{3,32}$/;
const RESERVED = new Set(['api', 'health', 'admin']);
const MAX_URL_LENGTH = 2048;

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

module.exports = {parseCreateInput};
