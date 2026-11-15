"""Writes the test files for Streaming Top K. Run from this folder: python generator.py"""
import heapq
import random
from itertools import accumulate
from pathlib import Path


def solve(events):
    plays, heap, answers = {}, [], []
    for kind, value in events:
        if kind == 1:
            plays[value] = plays.get(value, 0) + 1
            heapq.heappush(heap, (-plays[value], value))
        else:
            top = []
            while heap and len(top) < value:
                entry = heapq.heappop(heap)
                if plays[entry[1]] == -entry[0]:
                    top.append(entry)
            for entry in top:
                heapq.heappush(heap, entry)
            answers.append(' '.join(str(track) for _, track in top))
    return answers


def write(index, events):
    assert 1 <= len(events) <= 10**5 and events[0][0] == 1 and any(kind == 2 for kind, _ in events)
    assert all((kind == 1 and 1 <= v <= 10**6) or (kind == 2 and 1 <= v <= 10) for kind, v in events)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    lines = [str(len(events))] + [f"{kind} {value}" for kind, value in events]
    (tests / f"input{index:02d}.txt").write_text('\n'.join(lines) + '\n', newline="\n")
    (tests / f"output{index:02d}.txt").write_text('\n'.join(solve(events)) + '\n', newline="\n")


def build(q, query_rate, pick_track, pick_k, warmup=1):
    """A stream that opens with a play, queries at the given rate after the warmup, and ends with a query."""
    events = [(1, pick_track())]
    while len(events) < q - 1:
        if len(events) >= warmup and rng.random() < query_rate:
            events.append((2, pick_k()))
        else:
            events.append((1, pick_track()))
    return events + [(2, pick_k())]


def zipf(ids, s=1.1):
    """Picks from ids, with the first ids far more popular than the rest."""
    cum = list(accumulate(1 / (rank + 1) ** s for rank in range(len(ids))))
    return lambda: rng.choices(ids, cum_weights=cum)[0]


def uniform(high):
    return lambda: rng.randint(1, high)


def close_race():
    """50 contenders take turns in a fresh random order each round, so their counts stay within one play of each other."""
    if rng.random() < 0.6:
        return rng.randint(1, 10**6)
    if not race:
        race.extend(rng.sample(contenders, len(contenders)))
    return race.pop()


def viral():
    """Each stretch of plays has its own set of hits, plus older hits and a long tail of one-off plays."""
    era = eras[min(len(played) // 4000, len(eras) - 1)]
    played.append(1)
    r = rng.random()
    if r < 0.4:
        return rng.choice(era)
    if r < 0.6:
        return rng.choice(rng.choice(eras))
    return rng.randint(1, 10**6)


rng = random.Random(2026)
write(0, [(1, 5), (1, 3), (1, 5), (2, 2), (1, 3), (1, 9), (2, 3), (1, 9), (2, 1)])
write(1, [(1, 42), (1, 42), (1, 7), (2, 5)])
write(2, [(1, 1000000), (2, 10)])
write(3, [(1, 777)] + [(2, rng.randint(1, 10)) if i % 3 == 0 else (1, 777) for i in range(1, 600)])
ties = []
for track in range(1000, 0, -1):
    ties.append((1, track))
    if track % 50 == 0:
        ties.append((2, 10))
for track in [500, 999, 2, 500, 1000, 1000, 1000]:
    ties += [(1, track), (2, 3)]
write(4, ties)
lead = []
for _ in range(400):
    lead += [(1, rng.choice([3, 8, 8, 3, 21])), (2, rng.randint(1, 3))]
write(5, lead)
write(6, build(60, 0.3, uniform(8), lambda: rng.randint(1, 10)))
write(7, build(3000, 0.3, zipf(rng.sample(range(1, 10**6 + 1), 300)), lambda: rng.randint(1, 10)))
write(8, build(5000, 0.2, uniform(10**6), lambda: 10))
contenders, race = rng.sample(range(1, 10**6 + 1), 50), []
write(9, build(100000, 0.5, close_race, lambda: rng.randint(1, 5), warmup=60000))
eras, played = [rng.sample(range(1, 10**6 + 1), 20) for _ in range(20)], []
write(10, build(100000, 0.25, viral, lambda: rng.randint(1, 3)))
write(11, build(100000, 0.3, uniform(2 * 10**5), lambda: 10 if rng.random() < 0.01 else 1))
print("wrote 12 tests")
