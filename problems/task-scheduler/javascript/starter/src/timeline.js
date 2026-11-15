// Schedules (which runner does what, and when) and a text Gantt chart.

/**
 * One task's place in a schedule.
 * task: task name; worker: runner index from 0; start: minute it starts;
 * end: minute it finishes (start + duration).
 */
function slot(task, worker, start, end) {
  return { task, worker, start, end };
}

/** Slots on `workers` identical runners, kept sorted by (start, worker). */
class Schedule {
  constructor(workers, slots) {
    this.workers = workers;
    this.slots = [...slots].sort((a, b) => a.start - b.start || a.worker - b.worker);
    this._byTask = new Map(this.slots.map(s => [s.task, s]));
  }

  get size() { return this.slots.length; }

  [Symbol.iterator]() { return this.slots[Symbol.iterator](); }

  slotFor(name) { return this._byTask.get(name); }

  /** Minutes from the start of the pipeline until its last task finishes. */
  get makespan() {
    let latest = 0;
    for (const s of this.slots) if (s.end > latest) latest = s.end;
    return latest;
  }

  busyMinutes() {
    let total = 0;
    for (const s of this.slots) total += s.end - s.start;
    return total;
  }

  busyPercent() {
    const capacity = this.workers * this.makespan;
    return capacity ? Math.floor((this.busyMinutes() * 100) / capacity) : 0;
  }
}

/**
 * Draw one row per task: name, runner, a bar on a shared timeline, times.
 * Each column covers `scale` minutes, chosen so the bars fit in `width`
 * columns. Pass the graph to show each task's resource label.
 */
function renderGantt(schedule, { graph = null, width = 48 } = {}) {
  if (!schedule.slots.length) return '(empty schedule)';
  const span = schedule.makespan;
  const scale = Math.ceil(span / width);        // minutes per column, rounded up
  const columns = Math.ceil(span / scale);
  const label = schedule.slots.reduce((widest, s) => Math.max(widest, s.task.length), 0);
  let axis = '';
  for (let col = 0; col <= columns; col += 10) axis = axis.padEnd(col) + String(col * scale);
  const lines = [' '.repeat(label + 8) + axis];
  for (const s of schedule.slots) {
    const first = Math.floor(s.start / scale);
    const last = Math.max(first + 1, Math.ceil(s.end / scale));
    const bar = ' '.repeat(first) + '='.repeat(last - first) + ' '.repeat(columns - last);
    const row = `${s.task.padEnd(label)}  r${String(s.worker).padEnd(3)} |${bar}| ${s.start}-${s.end}`;
    const resource = graph ? graph.get(s.task).resource : null;
    lines.push(row + (resource ? `  [${resource}]` : ''));
  }
  lines.push(`makespan ${span} min on ${schedule.workers} runner(s), ${schedule.busyPercent()}% busy`);
  return lines.join('\n');
}

module.exports = { slot, Schedule, renderGantt };
