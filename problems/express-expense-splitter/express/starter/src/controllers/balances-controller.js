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
    }
  };
}

module.exports = {balancesController};
