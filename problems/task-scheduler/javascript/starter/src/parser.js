// Parser for pipeline files.
//
// Pipeline files use a small YAML-like format. Each task is a top-level key
// followed by indented settings:
//
//     # comments run to the end of the line
//     compile:
//       duration: 4            # minutes on one runner
//       resource: linux        # optional runner label
//
//     package:
//       duration: 2
//       after: compile, lint   # inline list; [compile, lint] also works
//
//     deploy:
//       duration: 3
//       after:                 # block list, one dependency per line
//         - package
//         - smoke-tests
//
// parsePipeline() only checks syntax. graph.loadPipeline() also checks that
// every dependency exists and that there are no cycles.
const { PipelineError, Task } = require('./task');

const SETTINGS = ['duration', 'after', 'resource'];
const WHOLE_NUMBER = /^[0-9]+$/;

/** A line of a pipeline file could not be understood. */
class PipelineSyntaxError extends PipelineError {
  constructor(lineno, message) {
    super(`line ${lineno}: ${message}`);
    this.name = 'PipelineSyntaxError';
    this.lineno = lineno;
  }
}

/** Parse pipeline text into an array of Task objects, in file order. */
function parsePipeline(text) {
  const reader = new Reader();
  text.split(/\r?\n/).forEach((raw, index) => reader.feed(index + 1, raw));
  return reader.finish();
}

/** 'a, b' or '[a, b]' -> ['a', 'b']. */
function splitNames(value, lineno) {
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
  const names = value.split(',').map(part => part.trim());
  if (names.some(name => !name)) throw new PipelineSyntaxError(lineno, `empty name in list '${value}'`);
  return names;
}

/** Line-by-line state machine behind parsePipeline. */
class Reader {
  constructor() {
    this.tasks = [];
    this.fields = null;    // settings of the task being read
    this.listKey = null;   // setting whose "- item" lines are being collected
    this.items = [];
  }

  feed(lineno, raw) {
    const line = raw.split('#')[0].trimEnd();
    const text = line.trim();
    if (!text) return;
    if (!/^\s/.test(line)) {                          // task header: "compile:"
      this.closeList();
      this.closeTask();
      const colon = text.indexOf(':');
      if (colon < 0 || text.slice(colon + 1).trim()) {
        throw new PipelineSyntaxError(lineno, `expected a task header like 'compile:', got '${text}'`);
      }
      this.fields = { name: text.slice(0, colon).trim(), lineno };
    } else if (this.fields === null) {
      throw new PipelineSyntaxError(lineno, 'indented line before the first task');
    } else if (text.startsWith('-')) {                // block list item: "- package"
      if (this.listKey === null) throw new PipelineSyntaxError(lineno, 'list item outside a list setting');
      this.items.push(text.slice(1).trim());
    } else {                                          // setting: "duration: 4"
      this.closeList();
      const colon = text.indexOf(':');
      const key = (colon < 0 ? text : text.slice(0, colon)).trim();
      const value = colon < 0 ? '' : text.slice(colon + 1).trim();
      if (colon < 0 || !SETTINGS.includes(key)) throw new PipelineSyntaxError(lineno, `unknown setting '${key}'`);
      if (key in this.fields) throw new PipelineSyntaxError(lineno, `'${key}' is set twice`);
      if (key === 'after' && !value) {
        this.listKey = key;
        this.items = [];
      } else if (key === 'after') {
        this.fields[key] = splitNames(value, lineno);
      } else if (value) {
        this.fields[key] = value;
      } else {
        throw new PipelineSyntaxError(lineno, `'${key}' needs a value`);
      }
    }
  }

  finish() {
    this.closeTask();
    return this.tasks;
  }

  /** Store the collected block-list items on the current task. */
  closeList() {
    if (this.listKey !== null) {
      this.fields[this.listKey] = this.items;
      this.listKey = null;
      this.items = [];
    }
  }

  closeTask() {
    if (this.fields === null) return;
    const fields = this.fields;
    this.fields = null;
    const { lineno, name, duration } = fields;
    if (duration === undefined) throw new PipelineSyntaxError(lineno, `task '${name}' has no duration`);
    if (!WHOLE_NUMBER.test(duration)) {
      throw new PipelineSyntaxError(lineno, `task '${name}': duration must be whole minutes, got '${duration}'`);
    }
    let task;
    try {
      task = new Task(name, Number(duration), fields.after || [], fields.resource || null);
    } catch (error) {
      if (error instanceof PipelineError) throw new PipelineSyntaxError(lineno, error.message);
      throw error;
    }
    this.tasks.push(task);
  }
}

module.exports = { parsePipeline, splitNames, PipelineSyntaxError };
