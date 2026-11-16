const {UnauthorizedError} = require('../errors');

const BEARER = /^Bearer ([\w-]{8,128})$/;

// Reads "Authorization: Bearer <secret>", looks the token up and sets
// req.user = {id, name, role} and req.token = {id}. Everything mounted after
// this middleware requires a valid, unrevoked token.
module.exports = function authenticate(store) {
  return (req, res, next) => {
    const header = req.get('Authorization');
    if (!header) {
      return next(new UnauthorizedError('unauthenticated', 'Send an API token: Authorization: Bearer <token>.'));
    }
    const match = BEARER.exec(header);
    if (!match) {
      return next(new UnauthorizedError('invalid_token', 'The Authorization header must be "Bearer <token>".'));
    }
    const token = store.findTokenBySecret(match[1]);
    const user = token && !token.revoked ? store.getUser(token.userId) : null;
    if (!user) {
      return next(new UnauthorizedError('invalid_token', 'The token is unknown or has been revoked.'));
    }
    req.user = {id: user.id, name: user.name, role: user.role};
    req.token = {id: token.id};
    next();
  };
};
