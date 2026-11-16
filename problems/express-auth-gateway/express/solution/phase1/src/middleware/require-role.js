const {UnauthorizedError, ForbiddenError} = require('../errors');

// From least to most privileged. Each role can do everything the roles
// before it can.
const ROLES = ['viewer', 'editor', 'admin'];

// Route guard: requireRole('editor') lets editors and admins through.
function requireRole(minimum) {
  if (!ROLES.includes(minimum)) throw new Error(`Unknown role ${minimum}`);
  const needed = ROLES.indexOf(minimum);
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError('unauthenticated', 'Sign in first.'));
    if (!(ROLES.indexOf(req.user.role) >= needed)) {
      return next(new ForbiddenError(`This needs the ${minimum} role; you are ${req.user.role}.`));
    }
    next();
  };
}

module.exports = {requireRole, ROLES};
