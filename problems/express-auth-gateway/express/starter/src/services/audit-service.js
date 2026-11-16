// The security audit log. See "Audit log" in README.md for what it must
// record and how GET /admin/audit pages through it.
function createAuditService({store, clock}) {
  function record(entry) {
    // Not built yet.
  }

  function list(query) {
    throw new Error('Not implemented: audit log listing');
  }

  return {record, list};
}

module.exports = {createAuditService};
