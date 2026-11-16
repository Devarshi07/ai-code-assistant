const {ValidationError} = require('./errors');

const MAX_LINES = 50;
const MAX_QUANTITY = 99;
const CUSTOMER_ID = /^cus_[a-z0-9_]{1,40}$/;

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

module.exports = {parseOrderInput, MAX_QUANTITY};
