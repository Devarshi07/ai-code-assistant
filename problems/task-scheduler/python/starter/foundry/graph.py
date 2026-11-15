"""Dependency graph utilities: validation, cycle detection, ordering."""
from collections import deque

from .parser import parse_pipeline
from .task import PipelineError


class CycleError(PipelineError):
    """The pipeline's dependencies loop back on themselves."""

    def __init__(self, cycle):
        super().__init__("dependency cycle: " + " -> ".join(cycle))
        self.cycle = cycle


class DependencyGraph:
    """A validated, acyclic set of tasks.

    graph["compile"]             the Task named compile
    graph.dependents("compile")  names of the tasks that list compile in `after`
    Iterating a graph yields its tasks in definition order.
    """

    def __init__(self, tasks):
        self._tasks = {}
        for task in tasks:
            if task.name in self._tasks:
                raise PipelineError(f"task {task.name!r} is defined twice")
            self._tasks[task.name] = task
        dependents = {name: [] for name in self._tasks}
        for task in self._tasks.values():
            for dep in task.deps:
                if dep == task.name:
                    raise PipelineError(f"task {task.name!r} depends on itself")
                if dep not in self._tasks:
                    raise PipelineError(f"task {task.name!r} depends on unknown task {dep!r}")
                dependents[dep].append(task.name)
        self._dependents = {name: tuple(names) for name, names in dependents.items()}
        cycle = find_cycle({name: task.deps for name, task in self._tasks.items()})
        if cycle:
            raise CycleError(cycle)

    def __len__(self):
        return len(self._tasks)

    def __iter__(self):
        return iter(self._tasks.values())

    def __contains__(self, name):
        return name in self._tasks

    def __getitem__(self, name):
        return self._tasks[name]

    @property
    def names(self):
        return list(self._tasks)

    def dependents(self, name):
        return self._dependents[name]

    def topological_order(self):
        """Task names, each after all of its dependencies.

        Kahn's algorithm with a FIFO queue seeded in definition order, so the
        result is deterministic.
        """
        waiting = {name: len(task.deps) for name, task in self._tasks.items()}
        queue = deque(name for name, count in waiting.items() if count == 0)
        order = []
        while queue:
            name = queue.popleft()
            order.append(name)
            for child in self._dependents[name]:
                waiting[child] -= 1
                if waiting[child] == 0:
                    queue.append(child)
        return order

    def critical_path(self):
        """The longest chain of work: (minutes, [names from first to last]).

        No number of runners can finish the pipeline faster than this.
        """
        finish, via = {}, {}
        for name in self.topological_order():
            start, before = 0, None
            for dep in self._tasks[name].deps:
                if finish[dep] > start:
                    start, before = finish[dep], dep
            finish[name] = start + self._tasks[name].duration
            via[name] = before
        last = None
        for name in finish:
            if last is None or finish[name] > finish[last]:
                last = name
        path = []
        while last is not None:
            path.append(last)
            last = via[last]
        path.reverse()
        return (finish[path[-1]] if path else 0), path


def find_cycle(deps):
    """Return one cycle in {name: deps} as [a, b, ..., a], or None.

    Iterative depth-first search, so very deep pipelines can't overflow the
    stack. A dependency still on the current trail closes a loop.
    """
    done, on_trail = set(), set()
    for root in deps:
        if root in done:
            continue
        trail, pending = [root], [iter(deps[root])]
        on_trail.add(root)
        while pending:
            dep = next(pending[-1], None)
            if dep is None:
                finished = trail.pop()
                pending.pop()
                on_trail.discard(finished)
                done.add(finished)
            elif dep in on_trail:
                return trail[trail.index(dep):] + [dep]
            elif dep not in done:
                trail.append(dep)
                pending.append(iter(deps[dep]))
                on_trail.add(dep)
    return None


def load_pipeline(text):
    """Parse pipeline text and validate it into a DependencyGraph."""
    return DependencyGraph(parse_pipeline(text))
