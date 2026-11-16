const {AppError} = require('../errors');

// Applies the limiter per API token (so it must run after authenticate).
// Every limited response carries X-RateLimit-Limit and X-RateLimit-Remaining;
// a rejected one is 429 with Retry-After in whole seconds.
module.exports = function rateLimit(limiter) {
  return (req, res, next) => {
    if (!req.token) return next();
    const result = limiter.hit(req.token.id);
    res.set('X-RateLimit-Limit', String(result.limit));
    res.set('X-RateLimit-Remaining', String(result.remaining));
    if (result.allowed) return next();
    const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    next(new AppError(429, 'rate_limited', `Too many requests for this token. Retry in ${seconds} s.`, {headers: {'Retry-After': String(seconds)}}));
  };
};
