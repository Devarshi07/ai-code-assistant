// Per-key request limiting: at most `limit` requests per `windowMs`.
//
//   const limiter = createRateLimiter({limit: 100, windowMs: 60000, now: Date.now});
//   limiter.hit('tok_ada')  // -> {allowed, limit, remaining, retryAfterMs}
//
// remaining: requests still allowed right now after this one (0 when denied).
// retryAfterMs: when denied, how long until a request would be allowed; else 0.
//
// This version counts requests in fixed windows aligned to the clock
// (0-60 s, 60-120 s, ...).
function createRateLimiter({limit, windowMs, now = Date.now}) {
  if (!(Number.isInteger(limit) && limit > 0)) throw new Error('limit must be a positive integer');
  if (!(windowMs > 0)) throw new Error('windowMs must be positive');
  const windows = new Map(); // key -> {start, count}

  function hit(key) {
    const time = now();
    const start = Math.floor(time / windowMs) * windowMs;
    let window = windows.get(key);
    if (!window || window.start !== start) {
      window = {start, count: 0};
      windows.set(key, window);
    }
    window.count += 1;
    const allowed = window.count <= limit;
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - window.count),
      retryAfterMs: allowed ? 0 : start + windowMs - time
    };
  }

  return {hit, size: () => windows.size};
}

module.exports = {createRateLimiter};
