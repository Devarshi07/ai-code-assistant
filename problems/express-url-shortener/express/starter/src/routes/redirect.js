const {Router} = require('express');
const asyncHandler = require('../middleware/async-handler');

// Public: anyone with the short link can follow it, no X-User-Id needed.
module.exports = function redirectRouter(controller) {
  const router = Router();
  router.get('/:slug([A-Za-z0-9_-]+)', asyncHandler(controller.redirect));
  return router;
};
