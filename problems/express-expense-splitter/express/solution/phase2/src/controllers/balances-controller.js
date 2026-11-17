function balancesController(balances) {
  return {
    async list(req, res) {
      res.json(await balances.getBalances(req.params.groupId));
    },

    async show(req, res) {
      res.json(await balances.getMemberBalance(req.params.groupId, req.params.memberId));
    },

    async settleUp(req, res) {
      res.json(await balances.settleUp(req.params.groupId));
    },

    async createSettlement(req, res) {
      const {groupId} = req.params;
      const settlement = await balances.createSettlement(groupId, req.body);
      res.status(201).location(`/api/groups/${groupId}/settlements/${settlement.id}`).json(settlement);
    },

    async showSettlement(req, res) {
      res.json(await balances.getSettlement(req.params.groupId, req.params.settlementId));
    }
  };
}

module.exports = {balancesController};
