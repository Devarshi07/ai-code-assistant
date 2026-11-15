"""Turns a dependency graph into a Schedule of runner assignments."""
from .timeline import Schedule, Slot


def serial_schedule(graph):
    """Today's behaviour: one runner, tasks back to back in topological order."""
    slots, clock = [], 0
    for name in graph.topological_order():
        duration = graph[name].duration
        slots.append(Slot(name, 0, clock, clock + duration))
        clock += duration
    return Schedule(1, slots)


def schedule(graph, workers):
    """Plan the pipeline on `workers` identical runners.

    Uses the list-scheduling policy described under "Parallel runners" in
    README.md: whenever a runner is idle, it starts the ready task with the
    highest priority. Returns a Schedule with one Slot per task.
    """
    raise NotImplementedError("Phase 2: schedule is not implemented yet")
