// Express 4 does not catch a rejected promise from an async handler: the
// request would hang. Wrap async handlers so errors reach the error handler.
module.exports = function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
};
