"""Deterministic pipeline generator for the scale tests (xorshift32 PRNG).

The JavaScript tests use the same generator, so both produce identical tasks.
"""
from foundry.task import Task

KINDS = ("build", "test", "lint", "pack", "scan", "docs", "bench", "deploy")


class XorShift32:
    def __init__(self, seed):
        self.state = (seed & 0xFFFFFFFF) or 0x9E3779B9

    def next(self):
        x = self.state
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.state = x
        return x

    def below(self, n):
        return self.next() % n


def generate_pipeline(seed, count, window=48, max_deps=3, max_duration=20):
    """`count` tasks; each depends on up to `max_deps` of the `window` tasks before it."""
    rng = XorShift32(seed)
    names, tasks = [], []
    for i in range(count):
        name = f"{KINDS[rng.below(len(KINDS))]}-{i}"
        deps = []
        if i:
            low = max(0, i - window)
            for _ in range(rng.below(max_deps + 1)):
                dep = names[low + rng.below(i - low)]
                if dep not in deps:
                    deps.append(dep)
        tasks.append(Task(name, 1 + rng.below(max_duration), tuple(deps)))
        names.append(name)
    return tasks


def fingerprint(tasks, plan):
    """Fold every task's (start, runner) into one number, in generation order."""
    acc = 0
    for task in tasks:
        slot = plan.slot_for(task.name)
        acc = (acc * 1_000_003 + slot.start * 1024 + slot.worker) % 2_147_483_647
    return acc
