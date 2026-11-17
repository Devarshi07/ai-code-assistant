const {ValidationError} = require('./errors');

const MEMBER_ID = /^mem_[a-z0-9_]{1,30}$/;
const CURRENCIES = ['AUD', 'CAD', 'EUR', 'GBP', 'USD'];
const MAX_AMOUNT_CENTS = 100000000;
const MAX_MEMBERS = 50;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value, max) => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= max;

// Checks a POST /api/groups body and returns {name, currency, members}, with
// members sorted by id. Every problem is reported at once, keyed by field path.
function parseGroupInput(body) {
  if (!isObject(body)) throw new ValidationError({body: 'must be a JSON object'});
  const fields = {};
  const {name, currency, members} = body;
  if (!isText(name, 60)) fields.name = 'must be 1 to 60 characters';
  if (!CURRENCIES.includes(currency)) fields.currency = `must be one of ${CURRENCIES.join(', ')}`;
  if (!Array.isArray(members) || members.length === 0) {
    fields.members = 'must be a non-empty array';
  } else if (members.length > MAX_MEMBERS) {
    fields.members = `must have at most ${MAX_MEMBERS} members`;
  } else {
    const seen = new Set();
    members.forEach((member, i) => {
      const id = member && member.id;
      if (typeof id !== 'string' || !MEMBER_ID.test(id)) fields[`members[${i}].id`] = 'must be a member id such as mem_ana';
      else if (seen.has(id)) fields[`members[${i}].id`] = 'appears more than once';
      else seen.add(id);
      if (!isText(member && member.name, 40)) fields[`members[${i}].name`] = 'must be 1 to 40 characters';
    });
  }
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return {
    name: name.trim(),
    currency,
    members: members.map(({id, name: memberName}) => ({id, name: memberName.trim()})).sort((a, b) => (a.id < b.id ? -1 : 1))
  };
}

// Checks a POST /api/groups/:id/expenses body and returns
// {description, payerId, amountCents, split}. Whether the member ids exist in
// the group is the service's job (a 404), not this function's (a 422).
function parseExpenseInput(body) {
  if (!isObject(body)) throw new ValidationError({body: 'must be a JSON object'});
  const fields = {};
  const {description, payerId, amountCents, split} = body;
  if (!isText(description, 100)) fields.description = 'must be 1 to 100 characters';
  if (typeof payerId !== 'string' || !MEMBER_ID.test(payerId)) fields.payerId = 'must be a member id such as mem_ana';
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
    fields.amountCents = `must be a whole number of cents from 1 to ${MAX_AMOUNT_CENTS}`;
  }
  const parsedSplit = parseSplit(split, amountCents, fields);
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return {description: description.trim(), payerId, amountCents, split: parsedSplit};
}

// Returns the normalized split, or null after recording what is wrong in `fields`.
//   {type: 'equal', memberIds: [...] | null}   (null means every member)
//   {type: 'exact', amounts: {memberId: cents}}
//   {type: 'shares', shares: {memberId: weight}}
function parseSplit(split, amountCents, fields) {
  if (!isObject(split)) {
    fields.split = 'must be an object with a type';
    return null;
  }
  if (split.type === 'equal') {
    if (split.memberIds === undefined) return {type: 'equal', memberIds: null};
    const ids = split.memberIds;
    const valid = Array.isArray(ids) && ids.length > 0 && ids.length <= MAX_MEMBERS &&
      ids.every(id => typeof id === 'string' && MEMBER_ID.test(id)) && new Set(ids).size === ids.length;
    if (!valid) {
      fields['split.memberIds'] = 'must be a non-empty array of distinct member ids';
      return null;
    }
    return {type: 'equal', memberIds: [...ids].sort()};
  }
  if (split.type === 'exact') {
    const amounts = parseWeights(split.amounts, 'split.amounts', 0, MAX_AMOUNT_CENTS, fields);
    if (amounts && Number.isInteger(amountCents)) {
      const sum = Object.values(amounts).reduce((total, cents) => total + cents, 0);
      if (sum !== amountCents) fields['split.amounts'] = `must add up to amountCents (${amountCents})`;
    }
    return amounts && {type: 'exact', amounts};
  }
  if (split.type === 'shares') {
    const shares = parseWeights(split.shares, 'split.shares', 1, 1000, fields);
    return shares && {type: 'shares', shares};
  }
  fields['split.type'] = "must be 'equal', 'exact' or 'shares'";
  return null;
}

// A {memberId: whole number} map with values from min to max. Returns it with
// the keys sorted, or null after recording every problem in `fields`.
function parseWeights(value, path, min, max, fields) {
  if (!isObject(value) || Object.keys(value).length === 0 || Object.keys(value).length > MAX_MEMBERS) {
    fields[path] = 'must be a non-empty object keyed by member id';
    return null;
  }
  let valid = true;
  const result = {};
  for (const id of Object.keys(value).sort()) {
    if (!MEMBER_ID.test(id)) {
      fields[`${path}.${id}`] = 'is not a member id';
      valid = false;
    } else if (!Number.isInteger(value[id]) || value[id] < min || value[id] > max) {
      fields[`${path}.${id}`] = `must be a whole number from ${min} to ${max}`;
      valid = false;
    } else {
      result[id] = value[id];
    }
  }
  return valid ? result : null;
}

module.exports = {parseGroupInput, parseExpenseInput, MEMBER_ID, MAX_AMOUNT_CENTS};
