// Errors thrown by TinyLink.
//
// Every error the service throws on purpose extends TinyLinkError, so callers
// can catch the whole family at once. Tests only check the class of an error,
// never its message.
//
//   TinyLinkError
//   ├── ValidationError            the arguments themselves are bad
//   │   ├── InvalidUrlError
//   │   ├── InvalidAliasError
//   │   └── InvalidExpiryError       (Part 2)
//   ├── AliasTakenError
//   ├── QuotaExceededError           (Part 2)
//   ├── LinkNotFoundError
//   ├── LinkExpiredError             (Part 2)
//   ├── LinkDeletedError             (Part 3)
//   └── RestoreConflictError         (Part 3)

/** Base class for every TinyLink error. */
class TinyLinkError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/** An argument is malformed, regardless of the service's current state. */
class ValidationError extends TinyLinkError {}

/** The target URL breaks one of the URL rules. */
class InvalidUrlError extends ValidationError {}

/** A custom alias has the wrong length or a character outside [A-Za-z0-9-]. */
class InvalidAliasError extends ValidationError {}

/** `expiresAt` is not strictly later than `now`. */
class InvalidExpiryError extends ValidationError {}

/** A custom alias clashes with the code of an existing, non-deleted link. */
class AliasTakenError extends TinyLinkError {}

/** The owner already has the maximum number of active links. */
class QuotaExceededError extends TinyLinkError {}

/** No link matches the code. */
class LinkNotFoundError extends TinyLinkError {}

/** The link exists but has expired. */
class LinkExpiredError extends TinyLinkError {}

/** The link exists but has been soft-deleted. */
class LinkDeletedError extends TinyLinkError {}

/** The link cannot be restored because a non-deleted link holds its code. */
class RestoreConflictError extends TinyLinkError {}

module.exports = {
  TinyLinkError,
  ValidationError,
  InvalidUrlError,
  InvalidAliasError,
  InvalidExpiryError,
  AliasTakenError,
  QuotaExceededError,
  LinkNotFoundError,
  LinkExpiredError,
  LinkDeletedError,
  RestoreConflictError,
};
