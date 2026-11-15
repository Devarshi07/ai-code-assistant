"""Errors raised by JobQueue.

Every error subclasses JobLineError, so callers can catch the whole family
with one ``except JobLineError``. Raise the most specific class that applies.
"""


class JobLineError(Exception):
    """Base class for every JobLine error."""


class ValidationError(JobLineError):
    """An argument is invalid: an empty job type, a non-integer priority,
    an empty worker id, or a type limit that isn't a positive integer.
    Nothing changes when this is raised."""


class JobNotFoundError(JobLineError):
    """No job has the given id."""


class LeaseError(JobLineError):
    """The caller doesn't hold a live lease on the job.

    The job isn't leased at all (it is queued or waiting for a retry), another
    worker holds it, or the caller's own lease has expired.
    """


class InvalidStateError(JobLineError):
    """The job's state doesn't allow the operation.

    Examples: ``ack`` or ``fail`` on a job that already succeeded or is dead
    (such as a second ``ack``), or ``requeue_dead`` on a job that isn't dead.
    """
