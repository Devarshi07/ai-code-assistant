// Errors the API turns into JSON responses. Every error body has the shape
// {"error": {"code": "...", "message": "...", "fields": {...}}}, where
// "fields" only appears on validation errors.

class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  toJSON() {
    return {code: this.code, message: this.message, ...(this.fields ? {fields: this.fields} : {})};
  }
}

// 401: no usable X-User-Id header.
class UnauthorizedError extends AppError {
  constructor(message = 'Send your user id in the X-User-Id header.') {
    super(401, 'unauthorized', message);
  }
}

// 403: the caller is known but the link belongs to someone else.
class ForbiddenError extends AppError {
  constructor(message = 'Only the owner of this link can do that.') {
    super(403, 'forbidden', message);
  }
}

// 404: the slug does not exist.
class NotFoundError extends AppError {
  constructor(slug) {
    super(404, 'not_found', `Link ${slug} was not found.`);
  }
}

// 409: the request is valid but conflicts with what is stored.
class ConflictError extends AppError {
  constructor(code, message) {
    super(409, code, message);
  }
}

// 410: the link existed but has expired.
class GoneError extends AppError {
  constructor(slug) {
    super(410, 'link_expired', `Link ${slug} has expired.`);
  }
}

// 422: the body or query string is well-formed but breaks a rule.
// fields maps each offending field to a short explanation.
class ValidationError extends AppError {
  constructor(fields, message = 'The request is invalid.') {
    super(422, 'validation_error', message, fields);
  }
}

module.exports = {AppError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, GoneError, ValidationError};
