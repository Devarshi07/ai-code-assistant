// Errors thrown by JobQueue.
//
// Every error extends JobLineError, so callers can catch the whole family with
// one `instanceof JobLineError` check. Throw the most specific class that applies.

/** Base class for every JobLine error. */
class JobLineError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * An argument is invalid: an empty job type, a non-integer priority, an empty
 * worker id, or a type limit that isn't a positive integer. Nothing changes
 * when this is thrown.
 */
class ValidationError extends JobLineError {}

/** No job has the given id. */
class JobNotFoundError extends JobLineError {}

/**
 * The caller doesn't hold a live lease on the job: the job isn't leased at all
 * (it is queued or waiting for a retry), another worker holds it, or the
 * caller's own lease has expired.
 */
class LeaseError extends JobLineError {}

/**
 * The job's state doesn't allow the operation. Examples: ack or fail on a job
 * that already succeeded or is dead (such as a second ack), or requeueDead on a
 * job that isn't dead.
 */
class InvalidStateError extends JobLineError {}

module.exports = { JobLineError, ValidationError, JobNotFoundError, LeaseError, InvalidStateError };
