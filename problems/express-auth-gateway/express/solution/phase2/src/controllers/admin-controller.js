function adminController({audit, tokens}) {
  return {
    listAudit(req, res) {
      res.json(audit.list(req.query));
    },

    revokeToken(req, res) {
      res.json(tokens.revoke(req.params.id));
    }
  };
}

module.exports = {adminController};
