const {NotFoundError} = require('../errors');

function createTokenService({store}) {
  // Revoking is permanent and idempotent. The secret is never returned.
  function revoke(id) {
    if (!store.getToken(id)) throw new NotFoundError('Token', id);
    const {secret, ...token} = store.updateToken(id, {revoked: true});
    return token;
  }

  return {revoke};
}

module.exports = {createTokenService};
