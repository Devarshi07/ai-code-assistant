const {UnauthorizedError} = require('../errors');

const USER_ID = /^[A-Za-z0-9_.-]{1,40}$/;

// Stand-in for real sign-in: the intranet gateway puts the caller's id in
// X-User-Id. Sets req.userId, or fails with 401 if the header is missing or odd.
module.exports = function requireUser(req, res, next) {
  const id = req.get('X-User-Id');
  if (!id || !USER_ID.test(id)) return next(new UnauthorizedError());
  req.userId = id;
  next();
};
