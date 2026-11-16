const {ValidationError} = require('../errors');

const OUTCOMES = ['success', 'denied', 'failed'];
const outcomeOf = status => (status === 401 || status === 403 ? 'denied' : status < 400 ? 'success' : 'failed');

// Cursors are opaque to clients: the seq of the last entry they saw.
const encodeCursor = seq => Buffer.from(`aud:${seq}`).toString('base64url');
function decodeCursor(cursor) {
  const match = /^aud:(\d{1,12})$/.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return match ? Number(match[1]) : null;
}

function parseQuery(query) {
  const fields = {};
  const single = name => {
    const value = query[name];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') { fields[name] = 'must be given once, as plain text'; return undefined; }
    return value;
  };
  const actor = single('actor');
  if (actor !== undefined && !actor) fields.actor = 'must not be empty';
  const outcome = single('outcome');
  if (outcome !== undefined && !OUTCOMES.includes(outcome)) fields.outcome = `must be one of ${OUTCOMES.join(', ')}`;
  let limit = 50;
  const rawLimit = single('limit');
  if (rawLimit !== undefined) {
    limit = /^\d{1,3}$/.test(rawLimit) ? Number(rawLimit) : NaN;
    if (!(limit >= 1 && limit <= 100)) fields.limit = 'must be a whole number from 1 to 100';
  }
  let before = Infinity;
  const cursor = single('cursor');
  if (cursor !== undefined) {
    const seq = decodeCursor(cursor);
    if (seq === null) fields.cursor = 'is not a cursor returned by this endpoint';
    else before = seq;
  }
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return {actor, outcome, limit, before};
}

// The security audit log: every write and every refused request.
function createAuditService({store, clock}) {
  function record({actor, role, method, path, status}) {
    store.appendAudit({at: new Date(clock()).toISOString(), actor, role, method, path, status, outcome: outcomeOf(status)});
  }

  // Newest first, filtered, `limit` at a time. nextCursor is null on the
  // last page.
  function list(query) {
    const {actor, outcome, limit, before} = parseQuery(query);
    const entries = store.listAudit();
    const page = [];
    let more = false;
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.seq >= before) continue;
      if (actor !== undefined && entry.actor !== actor) continue;
      if (outcome !== undefined && entry.outcome !== outcome) continue;
      if (page.length === limit) { more = true; break; }
      page.push(entry);
    }
    return {
      data: page.map(({seq, ...entry}) => entry),
      nextCursor: more ? encodeCursor(page[page.length - 1].seq) : null
    };
  }

  return {record, list};
}

module.exports = {createAuditService};
