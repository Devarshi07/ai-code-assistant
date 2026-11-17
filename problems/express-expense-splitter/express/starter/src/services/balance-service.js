// Who is owed money and who owes it. See "Balances and settling up" in README.md.
function createBalanceService({store, now = () => new Date()}) {
  // GET /api/groups/:groupId/balances
  async function getBalances(groupId) {
    throw new Error('Not implemented: getBalances');
  }

  // GET /api/groups/:groupId/balances/:memberId
  async function getMemberBalance(groupId, memberId) {
    throw new Error('Not implemented: getMemberBalance');
  }

  // GET /api/groups/:groupId/settle-up
  async function settleUp(groupId) {
    throw new Error('Not implemented: settleUp');
  }

  return {getBalances, getMemberBalance, settleUp};
}

module.exports = {createBalanceService};
