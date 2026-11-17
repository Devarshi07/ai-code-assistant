// Money is always an integer number of cents, never a float. These helpers
// turn an expense's split into what each member owes.
//
// Rule: the shares of an expense always add up to its amount exactly.

// Splits totalCents across weights (one per member, in the order given).
// Returns one integer per weight.
function allocate(totalCents, weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  // Everyone gets their whole-cent share first, then the cents left over go
  // one each to the members with the largest remainder (ties: earlier first).
  const shares = weights.map(weight => Math.floor((totalCents * weight) / totalWeight));
  const leftover = totalCents - shares.reduce((sum, cents) => sum + cents, 0);
  const byRemainder = weights
    .map((weight, index) => ({index, remainder: (totalCents * weight) % totalWeight}))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < leftover; i++) shares[byRemainder[i].index] += 1;
  return shares;
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
