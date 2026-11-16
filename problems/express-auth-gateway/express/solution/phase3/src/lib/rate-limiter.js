// Per-key request limiting: at most `limit` requests per `windowMs`.
//
//   const limiter = createRateLimiter({limit: 100, windowMs: 60000, now: Date.now});
//   limiter.hit('tok_ada')  // -> {allowed, limit, remaining, retryAfterMs}
//
// remaining: requests still allowed right now after this one (0 when denied).
// retryAfterMs: when denied, how long until a request would be allowed; else 0.
//
// Sliding window: a request at time t is allowed when fewer than `limit`
// allowed requests happened in (t - windowMs, t]. Refused requests do not
// count. Each key keeps the times of its allowed requests in a ring buffer
// (oldest at `head`), so a hit drops expired times from the front and
// appends at the back: O(1) amortized, never a scan of the whole window.
function createRateLimiter({limit, windowMs, now = Date.now}) {
  if (!(Number.isInteger(limit) && limit > 0)) throw new Error('limit must be a positive integer');
  if (!(windowMs > 0)) throw new Error('windowMs must be positive');
  const keys = new Map(); // key -> {times: Float64Array(limit), head, count}
  let lastSweep = now();

  // Forget keys whose every request has expired, at most once per window,
  // so idle tokens do not hold memory forever. Amortized O(1) per hit.
  function sweep(time) {
    for (const [key, state] of keys) {
      const newest = state.times[(state.head + state.count - 1) % limit];
      if (state.count === 0 || time - newest >= windowMs) keys.delete(key);
    }
    lastSweep = time;
  }

  function hit(key) {
    const time = now();
    if (time - lastSweep >= windowMs) sweep(time);
    let state = keys.get(key);
    if (!state) {
      state = {times: new Float64Array(limit), head: 0, count: 0};
      keys.set(key, state);
    }
    while (state.count > 0 && time - state.times[state.head] >= windowMs) {
      state.head = (state.head + 1) % limit;
      state.count -= 1;
    }
    if (state.count < limit) {
      state.times[(state.head + state.count) % limit] = time;
      state.count += 1;
      return {allowed: true, limit, remaining: limit - state.count, retryAfterMs: 0};
    }
    // Full: the oldest allowed request leaves the window at times[head] + windowMs.
    return {allowed: false, limit, remaining: 0, retryAfterMs: state.times[state.head] + windowMs - time};
  }

  return {hit, size: () => keys.size};
}

module.exports = {createRateLimiter};
