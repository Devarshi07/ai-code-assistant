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


def remaining_paths(graph):
    """Each task's priority: its duration plus the longest remaining path of
    any task that depends on it. Dependents come first in reverse topological
    order, so one backward pass is enough."""
    longest = {}
    for name in reversed(graph.topological_order()):
        tail = max((longest[child] for child in graph.dependents(name)), default=0)
        longest[name] = graph[name].duration + tail
    return longest


def schedule(graph, workers):
    """Plan the pipeline on `workers` identical runners.

    Uses the list-scheduling policy described under "Parallel runners" in
    README.md: whenever a runner is idle, it starts the ready task with the
    highest priority. Returns a Schedule with one Slot per task.

    Event by event: finish everything ending now, rescan the waiting tasks for
    ready ones, hand them out by priority, then jump to the next finish.
    """
    if workers < 1:
        raise ValueError("schedule needs at least one runner")
    priority = remaining_paths(graph)
    waiting = graph.names            # tasks that have not started yet
    finished = set()
    running = []                     # slots in progress
    idle = list(range(workers))
    slots = []
    clock = 0
    while waiting or running:
        for slot in [s for s in running if s.end == clock]:
            running.remove(slot)
            finished.add(slot.task)
            idle.append(slot.worker)
        ready = [name for name in waiting if all(dep in finished for dep in graph[name].deps)]
        ready.sort(key=lambda name: (-priority[name], name))
        idle.sort()
        started = set()
        for name, worker in zip(ready, idle):
            slot = Slot(name, worker, clock, clock + graph[name].duration)
            slots.append(slot)
            running.append(slot)
            started.add(name)
        idle = idle[len(started):]
        if started:
            waiting = [name for name in waiting if name not in started]
        if running:
            clock = min(slot.end for slot in running)
    return Schedule(workers, slots)
