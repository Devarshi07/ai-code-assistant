const {AppError} = require('../errors');

// The last middleware: turns anything thrown or passed to next(err) into a
// JSON error response. Unknown errors become a 500 without internal details.
module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({error: {code: 'invalid_json', message: 'The request body is not valid JSON.'}});
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({error: {code: 'body_too_large', message: 'The request body is too large.'}});
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({error: err.toJSON()});
  }
  console.error(`[${req.id}] ${req.method} ${req.originalUrl} failed: ${err.message}`);
  res.status(500).json({error: {code: 'internal_error', message: 'Something went wrong.', requestId: req.id}});
};
