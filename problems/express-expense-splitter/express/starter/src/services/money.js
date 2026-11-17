// Money is always an integer number of cents, never a float. These helpers
// turn an expense's split into what each member owes.
//
// Rule: the shares of an expense always add up to its amount exactly.

// Splits totalCents across weights (one per member, in the order given).
// Returns one integer per weight.
function allocate(totalCents, weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => Math.round((totalCents * weight) / totalWeight));
}

// The member ids a split touches, in ascending order.
function splitMemberIds(split) {
  if (split.type === 'equal') return [...split.memberIds].sort();
  return Object.keys(split.type === 'exact' ? split.amounts : split.shares).sort();
}

// What each member owes for one expense: [{memberId, cents}], ascending by
// member id. `split` is the normalized split stored on the expense.
function computeShares(amountCents, split) {
  const ids = splitMemberIds(split);
  let cents;
  if (split.type === 'exact') cents = ids.map(id => split.amounts[id]);
  else if (split.type === 'shares') cents = allocate(amountCents, ids.map(id => split.shares[id]));
  else cents = allocate(amountCents, ids.map(() => 1));
  return ids.map((memberId, i) => ({memberId, cents: cents[i]}));
}

module.exports = {allocate, computeShares, splitMemberIds};
