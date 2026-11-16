const {Router} = require('express');
const asyncHandler = require('../middleware/async-handler');

module.exports = function ordersRouter(controller) {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));
  router.get('/:id', asyncHandler(controller.show));
  router.post('/:id/cancel', asyncHandler(controller.cancel));
  return router;
};
