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

// 422: the body is well-formed JSON but breaks a rule.
// fields maps each offending field to a short explanation.
class ValidationError extends AppError {
  constructor(fields, message = 'The request is invalid.') {
    super(422, 'validation_error', message, fields);
  }
}

// 404: an id in the path or the body does not exist.
class NotFoundError extends AppError {
  constructor(resource, id) {
    super(404, 'not_found', `${resource} ${id} was not found.`);
  }
}

module.exports = {AppError, ValidationError, NotFoundError};
