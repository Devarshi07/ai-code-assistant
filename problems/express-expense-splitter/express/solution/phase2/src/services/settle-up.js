// The settle-up rule, kept apart from the HTTP and storage code so it is easy
// to test: greedy matching of the biggest debtor with the biggest creditor.

// Of the {id, cents} entries, the one with the most cents; ties go to the lowest id.
const largest = entries => entries.reduce((best, entry) =>
  entry.cents > best.cents || (entry.cents === best.cents && entry.id < best.id) ? entry : best);

// balances: [{memberId, balanceCents}] adding up to zero.
// Returns [{fromId, toId, amountCents}]: each step the member who owes the most
// pays the member who is owed the most, the smaller of the two amounts.
function planTransfers(balances) {
  const debtors = balances.filter(b => b.balanceCents < 0).map(b => ({id: b.memberId, cents: -b.balanceCents}));
  const creditors = balances.filter(b => b.balanceCents > 0).map(b => ({id: b.memberId, cents: b.balanceCents}));
  const transfers = [];
  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = largest(debtors);
    const creditor = largest(creditors);
    const amountCents = Math.min(debtor.cents, creditor.cents);
    transfers.push({fromId: debtor.id, toId: creditor.id, amountCents});
    debtor.cents -= amountCents;
    creditor.cents -= amountCents;
    if (debtor.cents === 0) debtors.splice(debtors.indexOf(debtor), 1);
    if (creditor.cents === 0) creditors.splice(creditors.indexOf(creditor), 1);
  }
  return transfers;
}

module.exports = {planTransfers};
