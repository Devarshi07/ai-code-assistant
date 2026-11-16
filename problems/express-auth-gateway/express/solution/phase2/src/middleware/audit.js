const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Records every write and every refused request (401 or 403) once the
// response has been sent. Mount it before authenticate: a 401 never reaches
// anything mounted after it.
module.exports = function auditTrail(audit) {
  return (req, res, next) => {
    res.on('finish', () => {
      const refused = res.statusCode === 401 || res.statusCode === 403;
      if (!refused && !WRITES.has(req.method)) return;
      audit.record({
        actor: req.user ? req.user.id : null,
        role: req.user ? req.user.role : null,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode
      });
    });
    next();
  };
};
