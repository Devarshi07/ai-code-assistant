function adminController({audit}) {
  return {
    listAudit(req, res) {
      res.json(audit.list(req.query));
    }
  };
}

module.exports = {adminController};
