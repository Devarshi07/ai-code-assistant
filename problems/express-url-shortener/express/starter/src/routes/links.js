const {Router} = require('express');
const asyncHandler = require('../middleware/async-handler');
const requireUser = require('../middleware/auth');

// Mounted at /api/links. Every route here needs an X-User-Id header.
module.exports = function linksRouter(controller) {
  const router = Router();
  router.use(requireUser);
  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));
  router.get('/:slug', asyncHandler(controller.show));
  router.get('/:slug/stats', asyncHandler(controller.stats));
  return router;
};
