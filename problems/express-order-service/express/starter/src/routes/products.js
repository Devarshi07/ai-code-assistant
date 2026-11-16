const {Router} = require('express');
const asyncHandler = require('../middleware/async-handler');

module.exports = function productsRouter(controller) {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.get('/:sku', asyncHandler(controller.show));
  return router;
};
