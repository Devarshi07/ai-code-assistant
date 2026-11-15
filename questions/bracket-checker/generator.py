"""Writes the test files for Bracket Checker. Run from this folder: python generator.py"""
import itertools
import random
from pathlib import Path

OPEN, CLOSE = "([{", ")]}"
BRACKETS = OPEN + CLOSE


def solve(s):
    stack = []
    for ch in s:
        if ch in OPEN:
            stack.append(ch)
        elif not stack or OPEN.index(stack.pop()) != CLOSE.index(ch):
            return "NO"
    return "NO" if stack else "YES"


def write(index, strings):
    assert 1 <= len(strings) <= 10**4 and sum(map(len, strings)) <= 5 * 10**5
    assert all(1 <= len(s) <= 10**5 and set(s) <= set(BRACKETS) for s in strings)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(strings)}\n" + "".join(s + "\n" for s in strings))
    (tests / f"output{index:02d}.txt").write_text("".join(solve(s) + "\n" for s in strings))


def balanced(rng, length, close_chance=0.5):
    """A random balanced string of even length; a lower close_chance nests deeper."""
    out, stack = [], []
    for i in range(length):
        if stack and (length - i == len(stack) or rng.random() < close_chance):
            out.append(CLOSE[OPEN.index(stack.pop())])
        else:
            stack.append(rng.choice(OPEN))
            out.append(stack[-1])
    return "".join(out)


def cross(rng, s, spot=None):
    """Swaps two neighbouring closers (or two openers) of different types. Each type still opens and
    closes equally often, so per-type counters see nothing wrong, but two pairs now cross."""
    same_side = lambda a, b: a != b and ((a in OPEN) == (b in OPEN))
    spots = [i for i in range(len(s) - 1) if same_side(s[i], s[i + 1])]
    if not spots:
        return s[1:] + s[0]
    i = spot if spot is not None else rng.choice(spots)
    assert i in spots
    return s[:i] + s[i + 1] + s[i] + s[i + 2:]


def corrupt(rng, s):
    """Breaks a balanced string with one small edit; the result is usually, not always, unbalanced."""
    i = rng.randrange(len(s))
    kind = rng.randrange(4)
    if kind == 0:
        return s[:i] + rng.choice([c for c in BRACKETS if c != s[i]]) + s[i + 1:]
    if kind == 1:
        return s[:i] + s[i + 1:]
    if kind == 2:
        return cross(rng, s)
    return s[:i] + rng.choice(BRACKETS) + s[i:-1] if len(s) > 2 else s + rng.choice(BRACKETS)


def mix(rng, lengths):
    return [balanced(rng, n) if rng.random() < 0.5 else corrupt(rng, balanced(rng, n)) for n in lengths]


rng = random.Random(2026)
write(0, ["{[()]}", "([)]", "()[]{}", "(("])
write(1, [")(", "[{}]}", "{{[]}()}"])
write(2, list(BRACKETS) + ["".join(p) for p in itertools.product(BRACKETS, repeat=2)])
write(3, ["".join(p) for p in itertools.product(BRACKETS, repeat=4)])
write(4, ["(" * 1000, "{[(" * 333, ")" * 1000, ")]}" * 333, "(" * 50000 + ")" * 49999, "[" * 49999 + "]" * 50000])
write(5, ["(()", "())", "{[]}" * 250 + "{", "}" + "{[]}" * 250, "[" * 300 + "]" * 300, "[" * 300 + "]" * 299 + ")",
          "([]{})" * 100, "([]{)}", "(" * 10 + ")" * 10, "}{", "{}" * 50 + "]", "[(" + "{}" * 40 + ")]"])
write(6, mix(rng, [rng.randrange(2, 31, 2) for _ in range(200)]))
write(7, [balanced(rng, 8) if rng.random() < 0.3 else "".join(rng.choice(BRACKETS) for _ in range(rng.randint(6, 8)))
          for _ in range(5000)])
write(8, mix(rng, [rng.randrange(2, 1001, 2) for _ in range(500)]))
deep = "".join(rng.choice(OPEN) for _ in range(50000))
nested = deep + "".join(CLOSE[OPEN.index(c)] for c in reversed(deep))
middle = next(i for i in range(75000, 100000) if nested[i] != nested[i + 1])
write(9, ["(" * 50000 + ")" * 50000, nested, cross(rng, nested, middle)])
write(10, [balanced(rng, 100000), balanced(rng, 100000, 0.3), corrupt(rng, balanced(rng, 100000)),
           balanced(rng, 99998) + "{)", cross(rng, balanced(rng, 100000, 0.4))])
write(11, mix(rng, [rng.randrange(2, 97, 2) for _ in range(10000)]))
write(12, [balanced(rng, 200) if rng.random() < 0.5 else cross(rng, balanced(rng, 200)) for _ in range(2500)])
print("wrote 13 tests")
