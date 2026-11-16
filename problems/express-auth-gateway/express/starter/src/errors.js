// Errors the API turns into JSON: {"error": {"code", "message", "fields"?}}.
// headers are sent with the response (for example WWW-Authenticate).

class AppError extends Error {
  constructor(status, code, message, {fields, headers} = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.headers = headers || {};
  }

  toJSON() {
    return {code: this.code, message: this.message, ...(this.fields ? {fields: this.fields} : {})};
  }
}

const REALM = 'Bearer realm="inkwell"';

// 401: no credentials (code "unauthenticated") or bad ones ("invalid_token").
class UnauthorizedError extends AppError {
  constructor(code, message) {
    super(401, code, message, {headers: {'WWW-Authenticate': code === 'invalid_token' ? `${REALM}, error="invalid_token"` : REALM}});
  }
}

// 403: the caller is known but may not do this.
class ForbiddenError extends AppError {
  constructor(message) {
    super(403, 'forbidden', message);
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(404, 'not_found', `${resource} ${id} was not found.`);
  }
}

// 422: fields maps each bad field or parameter to a short explanation.
class ValidationError extends AppError {
  constructor(fields, message = 'The request is invalid.') {
    super(422, 'validation_error', message, {fields});
  }
}

module.exports = {AppError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError};
