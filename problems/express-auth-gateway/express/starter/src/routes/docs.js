const {Router} = require('express');
const {requireRole} = require('../middleware/require-role');

// Who may call what. Every route here is behind authenticate.
module.exports = function docsRouter(controller) {
  const router = Router();
  router.get('/', requireRole('viewer'), controller.list);
  router.get('/:id', requireRole('viewer'), controller.show);
  router.post('/', requireRole('editor'), controller.create);
  router.patch('/:id', requireRole('editor'), controller.update);
  router.delete('/:id', requireRole('admin'), controller.remove);
  return router;
};
