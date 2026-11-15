"""Writes the test files for Meeting Rooms. Run from this folder: python generator.py"""
import heapq
import random
from pathlib import Path


def solve(meetings):
    ends = []  # end times of the rooms in use, smallest first
    for start, end in sorted(meetings):
        if ends and ends[0] <= start:
            heapq.heapreplace(ends, end)
        else:
            heapq.heappush(ends, end)
    return len(ends)


def write(index, meetings):
    assert 1 <= len(meetings) <= 10**5 and all(0 <= s < e <= 10**9 for s, e in meetings)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    lines = "".join(f"{s} {e}\n" for s, e in meetings)
    (tests / f"input{index:02d}.txt").write_text(f"{len(meetings)}\n{lines}", newline="\n")
    (tests / f"output{index:02d}.txt").write_text(f"{solve(meetings)}\n", newline="\n")


rng = random.Random(9137)


def random_meetings(n, latest_start, longest):
    meetings = []
    for _ in range(n):
        start = rng.randint(0, latest_start)
        meetings.append((start, start + rng.randint(1, longest)))
    return meetings


def shuffled(meetings):
    rng.shuffle(meetings)
    return meetings


write(0, [(1, 4), (2, 6), (4, 7), (6, 9), (8, 10)])
write(1, [(0, 10), (2, 5), (3, 8), (5, 6)])
write(2, [(0, 10**9)])
write(3, shuffled([(i, i + 1) for i in range(1000)]))  # back to back: one room
write(4, [(5, 10)] * 500)
write(5, shuffled([(i, 2000 - i) for i in range(1000)]))  # nested
write(6, random_meetings(50, 99, 20))
write(7, random_meetings(2000, 10**9 - 10**7, 10**7))  # coordinates too large for a timeline array
write(8, random_meetings(5000, 50, 10))  # many shared start and end times
write(9, random_meetings(100000, 9989, 10))
write(10, random_meetings(100000, 4999, 5000))  # about half of the meetings overlap at once
# 800 tracks of back-to-back meetings: exactly 800 rooms, but touching endpoints must not count as overlaps.
tracks = []
for _ in range(800):
    time = rng.randint(0, 100)
    for _ in range(100):
        length = rng.randint(1, 30)
        tracks.append((time, time + length))
        time += length
write(11, shuffled(tracks))
print("wrote 12 tests")
