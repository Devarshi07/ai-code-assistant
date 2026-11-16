const {AppError} = require('../errors');

module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({error: {code: 'invalid_json', message: 'The request body is not valid JSON.'}});
  }
  if (err instanceof AppError) {
    res.set(err.headers);
    return res.status(err.status).json({error: err.toJSON()});
  }
  console.error(`${req.method} ${req.originalUrl} failed: ${err.message}`);
  res.status(500).json({error: {code: 'internal_error', message: 'Something went wrong.'}});
};
