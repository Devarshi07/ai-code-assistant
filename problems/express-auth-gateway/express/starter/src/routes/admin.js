const {Router} = require('express');
const {requireRole} = require('../middleware/require-role');

// Everything under /admin is for admins only.
module.exports = function adminRouter(controller) {
  const router = Router();
  router.use(requireRole('admin'));
  router.get('/audit', controller.listAudit);
  return router;
};
