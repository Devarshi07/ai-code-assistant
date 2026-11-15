// Task model: one unit of work in a pipeline.
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** A pipeline definition is invalid: bad syntax, unknown task, cycle, ... */
class PipelineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PipelineError';
  }
}

/**
 * A unit of work such as compiling the app or running a test suite.
 *
 * duration  whole minutes the task keeps one runner busy (at least 1)
 * deps      names of the tasks that must finish before this one may start
 * resource  optional runner label such as "macos"; informational for now
 */
class Task {
  constructor(name, duration, deps = [], resource = null) {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
      throw new PipelineError(`invalid task name ${JSON.stringify(name)}`);
    }
    if (!Number.isInteger(duration) || duration < 1) {
      throw new PipelineError(`${name}: duration must be a whole number of minutes, at least 1`);
    }
    if (!Array.isArray(deps)) throw new PipelineError(`${name}: deps must be an array of task names`);
    this.name = name;
    this.duration = duration;
    // Keep dependencies without repeats, in the order given.
    this.deps = Object.freeze([...new Set(deps)]);
    this.resource = resource;
    Object.freeze(this);
  }

  toString() {
    const after = this.deps.length ? ` after ${this.deps.join(', ')}` : '';
    const on = this.resource ? ` on ${this.resource}` : '';
    return `${this.name} (${this.duration} min)${after}${on}`;
  }
}

module.exports = { Task, PipelineError };
