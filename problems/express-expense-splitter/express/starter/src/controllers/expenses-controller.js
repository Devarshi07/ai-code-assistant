function expensesController(expenses) {
  return {
    async create(req, res) {
      const {groupId} = req.params;
      const expense = await expenses.createExpense(groupId, req.body);
      res.status(201).location(`/api/groups/${groupId}/expenses/${expense.id}`).json(expense);
    },

    async show(req, res) {
      res.json(await expenses.getExpense(req.params.groupId, req.params.expenseId));
    }
  };
}

module.exports = {expensesController};
