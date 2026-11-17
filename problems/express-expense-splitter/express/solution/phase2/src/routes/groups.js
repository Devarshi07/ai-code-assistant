const {Router} = require('express');
const asyncHandler = require('../middleware/async-handler');

// Everything lives under /api/groups: the group itself, its expenses, and the
// balance views derived from them.
module.exports = function groupsRouter({groups, expenses, balances}) {
  const router = Router();
  router.get('/', asyncHandler(groups.list));
  router.post('/', asyncHandler(groups.create));
  router.get('/:groupId', asyncHandler(groups.show));

  router.post('/:groupId/expenses', asyncHandler(expenses.create));
  router.get('/:groupId/expenses/:expenseId', asyncHandler(expenses.show));

  router.get('/:groupId/balances', asyncHandler(balances.list));
  router.get('/:groupId/balances/:memberId', asyncHandler(balances.show));
  router.get('/:groupId/settle-up', asyncHandler(balances.settleUp));
  router.post('/:groupId/settlements', asyncHandler(balances.createSettlement));
  router.get('/:groupId/settlements/:settlementId', asyncHandler(balances.showSettlement));
  return router;
};
