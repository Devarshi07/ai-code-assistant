const {randomUUID} = require('node:crypto');

// Gives every request an id for the logs and echoes it in X-Request-Id.
// A well-formed id sent by the client (or a proxy) is kept.
module.exports = function requestId(req, res, next) {
  const incoming = req.get('X-Request-Id');
  req.id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  res.set('X-Request-Id', req.id);
  next();
};
