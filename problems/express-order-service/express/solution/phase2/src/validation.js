const {ValidationError} = require('./errors');

const MAX_LINES = 50;
const MAX_QUANTITY = 99;
const CUSTOMER_ID = /^cus_[a-z0-9_]{1,40}$/;
const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];
const SORT_FIELDS = ['createdAt', 'totalCents'];
const MAX_PAGE_SIZE = 100;

// Checks a POST /orders body and returns {customerId, items: [{sku, quantity}]}.
// Every problem is reported at once, keyed by field path, e.g. "items[1].quantity".
function parseOrderInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError({body: 'must be a JSON object'});
  }
  const fields = {};
  const {customerId, items} = body;
  if (typeof customerId !== 'string' || !CUSTOMER_ID.test(customerId)) {
    fields.customerId = 'must be a customer id such as cus_ana';
  }
  if (!Array.isArray(items) || items.length === 0) {
    fields.items = 'must be a non-empty array';
  } else if (items.length > MAX_LINES) {
    fields.items = `must have at most ${MAX_LINES} lines`;
  } else {
    const seen = new Set();
    items.forEach((item, i) => {
      const sku = item && item.sku;
      if (typeof sku !== 'string' || !sku) fields[`items[${i}].sku`] = 'is required';
      else if (seen.has(sku)) fields[`items[${i}].sku`] = 'appears more than once; combine the quantities';
      else seen.add(sku);
      const quantity = item && item.quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        fields[`items[${i}].quantity`] = `must be a whole number from 1 to ${MAX_QUANTITY}`;
      }
    });
  }
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return {customerId, items: items.map(({sku, quantity}) => ({sku, quantity}))};
}

// Checks GET /orders query parameters and returns
// {status, customerId, sort: {field, descending}, page, pageSize}.
// Unknown parameters are ignored; a repeated parameter is an error.
function parseListQuery(query) {
  const fields = {};
  const single = name => {
    const value = query[name];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') { fields[name] = 'must be given once, as plain text'; return undefined; }
    return value;
  };
  const integer = (name, min, max, fallback) => {
    const raw = single(name);
    if (raw === undefined) return fallback;
    const value = /^\d{1,9}$/.test(raw) ? Number(raw) : NaN;
    if (!(value >= min && value <= max)) { fields[name] = `must be a whole number from ${min} to ${max}`; return fallback; }
    return value;
  };

  const status = single('status');
  if (status !== undefined && !STATUSES.includes(status)) fields.status = `must be one of ${STATUSES.join(', ')}`;
  const customerId = single('customerId');
  if (customerId !== undefined && !customerId) fields.customerId = 'must not be empty';

  const rawSort = single('sort') ?? '-createdAt';
  const descending = rawSort.startsWith('-');
  const field = descending ? rawSort.slice(1) : rawSort;
  if (!SORT_FIELDS.includes(field)) fields.sort = `must be one of ${SORT_FIELDS.flatMap(f => [f, '-' + f]).join(', ')}`;

  const page = integer('page', 1, 1000000, 1);
  const pageSize = integer('pageSize', 1, MAX_PAGE_SIZE, 20);

  if (Object.keys(fields).length) throw new ValidationError(fields);
  return {status, customerId, sort: {field, descending}, page, pageSize};
}

module.exports = {parseOrderInput, parseListQuery, MAX_QUANTITY, STATUSES};
