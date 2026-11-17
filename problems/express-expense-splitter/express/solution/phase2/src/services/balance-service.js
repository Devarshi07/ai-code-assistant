const {NotFoundError} = require('../errors');
const {parseSettlementInput} = require('../validation');
const {requireGroup} = require('./group-service');
const {planTransfers} = require('./settle-up');

// Who is owed money and who owes it. See "Money rules" in README.md.
function createBalanceService({store, now = () => new Date()}) {
  // Net balance of every member of the group: paid minus owed, adjusted by
  // settlements. Worked out from the group's whole history.
  async function netBalances(group) {
    const [expenses, settlements] = await Promise.all([store.listExpenses(group.id), store.listSettlements(group.id)]);
    const net = new Map(group.members.map(member => [member.id, 0]));
    for (const expense of expenses) {
      net.set(expense.payerId, net.get(expense.payerId) + expense.amountCents);
      for (const share of expense.shares) net.set(share.memberId, net.get(share.memberId) - share.cents);
    }
    for (const settlement of settlements) {
      net.set(settlement.fromId, net.get(settlement.fromId) + settlement.amountCents);
      net.set(settlement.toId, net.get(settlement.toId) - settlement.amountCents);
    }
    return net;
  }

  const entries = (group, net) => group.members.map(member => ({memberId: member.id, name: member.name, balanceCents: net.get(member.id)}));

  async function getBalances(groupId) {
    const group = await requireGroup(store, groupId);
    return {groupId, currency: group.currency, balances: entries(group, await netBalances(group))};
  }

  async function getMemberBalance(groupId, memberId) {
    const group = await requireGroup(store, groupId);
    if (!group.members.some(member => member.id === memberId)) throw new NotFoundError('Member', memberId);
    const entry = entries(group, await netBalances(group)).find(e => e.memberId === memberId);
    return {groupId, currency: group.currency, ...entry};
  }

  async function settleUp(groupId) {
    const group = await requireGroup(store, groupId);
    const transfers = planTransfers(entries(group, await netBalances(group)));
    return {groupId, currency: group.currency, transfers};
  }

  // POST /api/groups/:groupId/settlements
  async function createSettlement(groupId, body) {
    const group = await requireGroup(store, groupId);
    const input = parseSettlementInput(body);
    for (const id of [input.fromId, input.toId]) {
      if (!group.members.some(member => member.id === id)) throw new NotFoundError('Member', id);
    }
    return store.insertSettlement({
      id: store.nextSettlementId(),
      groupId,
      ...input,
      currency: group.currency,
      createdAt: now().toISOString()
    });
  }

  async function getSettlement(groupId, settlementId) {
    await requireGroup(store, groupId);
    const settlement = await store.getSettlement(settlementId);
    if (!settlement || settlement.groupId !== groupId) throw new NotFoundError('Settlement', settlementId);
    return settlement;
  }

  return {getBalances, getMemberBalance, settleUp, createSettlement, getSettlement};
}

module.exports = {createBalanceService};
