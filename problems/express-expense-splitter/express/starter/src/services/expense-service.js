const {NotFoundError} = require('../errors');
const {parseExpenseInput} = require('../validation');
const {computeShares, splitMemberIds} = require('./money');
const {requireGroup} = require('./group-service');

// Business rules for expenses: who paid, who owes what.
function createExpenseService({store, now = () => new Date()}) {
  // POST /api/groups/:groupId/expenses. The group must exist (404), the body
  // must be valid (422), and every member it names must belong to the group
  // (404). The shares are worked out once, here, and saved with the expense.
  async function createExpense(groupId, body) {
    const group = await requireGroup(store, groupId);
    const input = parseExpenseInput(body);

    const memberIds = group.members.map(member => member.id).sort();
    const split = input.split.type === 'equal' && !input.split.memberIds
      ? {type: 'equal', memberIds}
      : input.split;
    for (const id of [input.payerId, ...splitMemberIds(split)]) {
      if (!memberIds.includes(id)) throw new NotFoundError('Member', id);
    }

    return store.insertExpense({
      id: store.nextExpenseId(),
      groupId,
      description: input.description,
      payerId: input.payerId,
      amountCents: input.amountCents,
      currency: group.currency,
      split,
      shares: computeShares(input.amountCents, split),
      createdAt: now().toISOString()
    });
  }

  async function getExpense(groupId, expenseId) {
    await requireGroup(store, groupId);
    const expense = await store.getExpense(expenseId);
    if (!expense || expense.groupId !== groupId) throw new NotFoundError('Expense', expenseId);
    return expense;
  }

  return {createExpense, getExpense};
}

module.exports = {createExpenseService};
