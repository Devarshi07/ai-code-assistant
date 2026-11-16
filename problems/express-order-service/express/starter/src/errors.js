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

// 422: the body or query string is well-formed JSON but breaks a rule.
// fields maps each offending field to a short explanation.
class ValidationError extends AppError {
  constructor(fields, message = 'The request is invalid.') {
    super(422, 'validation_error', message, fields);
  }
}

// 409: the request is valid but conflicts with the current state,
// for example not enough stock.
class ConflictError extends AppError {
  constructor(code, message) {
    super(409, code, message);
  }
}

// 404: an id in the path does not exist.
class NotFoundError extends Error {
  constructor(resource, id) {
    super(`${resource} ${id} was not found.`);
    this.name = 'NotFoundError';
    this.status = 404;
    this.code = 'not_found';
  }
}

module.exports = {AppError, ValidationError, ConflictError, NotFoundError};
