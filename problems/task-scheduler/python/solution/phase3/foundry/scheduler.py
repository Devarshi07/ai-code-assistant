"""Turns a dependency graph into a Schedule of runner assignments."""
import heapq

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

    Event-driven with three heaps, O((n + e) log n) overall:
      ready    (-priority, name) of tasks whose dependencies have all finished
      idle     runner ids, so the lowest-numbered idle runner comes first
      running  (end, worker, name) of tasks in progress, soonest finish first
    `blockers` counts each task's unfinished dependencies (Kahn's algorithm),
    so a finish only touches the dependents of the task that finished.
    """
    if workers < 1:
        raise ValueError("schedule needs at least one runner")
    priority = remaining_paths(graph)
    blockers = {task.name: len(task.deps) for task in graph}
    ready = [(-priority[name], name) for name, count in blockers.items() if count == 0]
    heapq.heapify(ready)
    idle = list(range(workers))      # sorted, so already a valid heap
    running = []
    slots = []
    clock = 0
    while ready or running:
        while ready and idle:
            _, name = heapq.heappop(ready)
            worker = heapq.heappop(idle)
            end = clock + graph[name].duration
            slots.append(Slot(name, worker, clock, end))
            heapq.heappush(running, (end, worker, name))
        clock = running[0][0]
        # Finish everything that ends at this minute before starting anything new.
        while running and running[0][0] == clock:
            _, worker, name = heapq.heappop(running)
            heapq.heappush(idle, worker)
            for child in graph.dependents(name):
                blockers[child] -= 1
                if blockers[child] == 0:
                    heapq.heappush(ready, (-priority[child], child))
    return Schedule(workers, slots)
