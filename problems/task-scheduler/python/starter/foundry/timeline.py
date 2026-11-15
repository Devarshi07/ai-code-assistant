"""Schedules (which runner does what, and when) and a text Gantt chart."""
from typing import NamedTuple


class Slot(NamedTuple):
    """One task's place in a schedule."""
    task: str      # task name
    worker: int    # runner index, starting at 0
    start: int     # minute the task starts
    end: int       # minute it finishes: start + duration


class Schedule:
    """Slots on `workers` identical runners, kept sorted by (start, worker)."""

    def __init__(self, workers, slots):
        self.workers = workers
        self.slots = sorted(slots, key=lambda slot: (slot.start, slot.worker))
        self._by_task = {slot.task: slot for slot in self.slots}

    def __len__(self):
        return len(self.slots)

    def __iter__(self):
        return iter(self.slots)

    def slot_for(self, name):
        return self._by_task[name]

    @property
    def makespan(self):
        """Minutes from the start of the pipeline until its last task finishes."""
        return max((slot.end for slot in self.slots), default=0)

    def busy_minutes(self):
        return sum(slot.end - slot.start for slot in self.slots)

    def busy_percent(self):
        capacity = self.workers * self.makespan
        return self.busy_minutes() * 100 // capacity if capacity else 0


def render_gantt(schedule, graph=None, width=48):
    """Draw one row per task: name, runner, a bar on a shared timeline, times.

    Each column covers `scale` minutes, chosen so the bars fit in `width`
    columns. Pass the graph to show each task's resource label.
    """
    if not schedule.slots:
        return "(empty schedule)"
    span = schedule.makespan
    scale = -(-span // width)                 # minutes per column, rounded up
    columns = -(-span // scale)
    label = max(len(slot.task) for slot in schedule.slots)
    axis = ""
    for col in range(0, columns + 1, 10):
        axis = axis.ljust(col) + str(col * scale)
    lines = [" " * (label + 8) + axis]
    for slot in schedule.slots:
        first = slot.start // scale
        last = max(first + 1, -(-slot.end // scale))
        bar = " " * first + "=" * (last - first) + " " * (columns - last)
        row = f"{slot.task:<{label}}  r{slot.worker:<3} |{bar}| {slot.start}-{slot.end}"
        resource = graph[slot.task].resource if graph is not None else None
        lines.append(row + (f"  [{resource}]" if resource else ""))
    lines.append(f"makespan {span} min on {schedule.workers} runner(s), {schedule.busy_percent()}% busy")
    return "\n".join(lines)
