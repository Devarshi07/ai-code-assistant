# Authoring coding questions

Coding questions are HackerRank-style, single-file problems. The candidate reads a statement and completes a function in a starter template. The template's `main` already reads **stdin** and prints the result to **stdout**. **Run Code** runs the sample tests (or custom input), and **Submit Code** runs every test. Each test is a pair of files: input from stdin, expected stdout.

Classic questions ship in five languages: `python`, `javascript`, `java`, `cpp` and `go`. Other **kinds** list their own languages (see [Question kinds](#question-kinds)); only classic questions appear in practice tests and mock interviews, which offer all five languages.

## Layout

```
questions/<id>/question.json
questions/<id>/templates/python.py  javascript.js  Solution.java  cpp.cpp  go.go
questions/<id>/solutions/python.py  javascript.js  Solution.java  cpp.cpp  go.go
questions/<id>/tests/input00.txt  output00.txt  input01.txt  output01.txt  …
questions/<id>/generator.py        optional: a deterministic script that wrote the large tests
```

## question.json

```json
{
  "id": "pairs-with-difference",
  "title": "Pairs With Difference",
  "difficulty": "Easy",
  "maxScore": 30,
  "skills": ["Arrays", "Hash Tables"],
  "summary": "One sentence for the question list.",
  "statement": "Markdown: the story and the task.",
  "functionDescription": "Markdown: Complete the **countPairs** function… It has the following parameters: … Returns: …",
  "inputFormat": "Markdown",
  "constraints": "Markdown, for example `1 ≤ n ≤ 2 × 10^5`",
  "outputFormat": "Markdown",
  "samples": [{"input": "5 2\n1 5 3 4 2\n", "output": "3\n", "explanation": "Markdown"}],
  "tests": [{"file": "00", "sample": true}, {"file": "01"}, {"file": "02", "weight": 2}]
}
```

- `difficulty` is `Easy`, `Medium` or `Hard`. `maxScore` is 30, 50 or 80 to match.
- Pick `skills` from: Arrays, Strings, Hash Tables, Sorting, Searching, Two Pointers, Sliding Window, Stacks, Queues, Linked Lists, Trees, Graphs, BFS, DFS, Greedy, Dynamic Programming, Recursion, Math, Bit Manipulation, Heaps, Intervals, Simulation, Implementation, Machine Learning, SQL, REST APIs, API Design.
- Optional fields: `kind` (default `algorithm`), `languages` (the question's languages; default depends on the kind), `images` (a language → runtime image map, overriding the kind's default) and `ordered` (SQL only, default `true`).
- Each `samples[i]` must equal the test marked `"sample": true` at the same position, byte for byte after trailing-whitespace normalisation. Provide 1–2 samples.
- Provide 10–16 tests in total. They should cover the edge cases the constraints allow (minimum sizes, duplicates, negatives, all-equal values, maximum values) plus at least two **large** tests at the upper limits.
- `weight` is optional (default 1). The score is `maxScore × passed weight / total weight`.
- For Medium and Hard questions, the large tests should make the obvious brute force fail the time limit while the intended solution passes easily. Easy questions may simply need a linear pass.
- Keep each test file under 1.2 MB and all of a question's tests under 4 MB, so the repository stays small. Large tests may stop short of the constraint maximums: 10^5 elements is usually enough for a brute force to time out. Write large tests with a seeded `generator.py` so they're reproducible.
- Output must be deterministic: a single correct output per input. If several answers are valid, define a tie-break in the statement.

## Templates (what the candidate starts with)

Follow HackerRank's style. The function to complete comes first, with a comment header describing the parameters and return type, then a `main` that parses stdin and prints the return value. The body says `Write your code here` and returns a placeholder (`0`, `""`, an empty list), so an unmodified template compiles and fails with Wrong Answer, not a syntax error.

- **Python:** start with `#!/bin/python3` and the usual imports (`math`, `os`, `random`, `re`, `sys`). Define the function, then guard the I/O with `if __name__ == '__main__':`. Read with `input()` / `sys.stdin`.
- **JavaScript (Node.js):** use HackerRank's `'use strict'` stdin boilerplate (`process.stdin.on('data'…)`, `readLine()`, `main()`), with the function above `main`. Print with `console.log`. Plain CommonJS, no modules.
- **Java:** put a `class Result` containing `public static` method(s), then `public class Solution` with `main` using `BufferedReader`. The file is `Solution.java`. Java 21.
- **C++:** use `#include <bits/stdc++.h>` and `using namespace std;`, put the function above `main`, and read with `cin` or `getline`. Print with `cout`. C++20, compiled with `g++ -O2`.
- **Go:** `package main`, with the function above `main` and a `bufio.Reader` sized `16 * 1024 * 1024` for input. Print with `fmt`. Use only the standard library.

Parameter types must suit the constraints: use 64-bit integers wherever sums or products can exceed 2^31.

## Solutions

`solutions/` holds a complete program per language: the same template with the function implemented. Solutions must be correct and efficient. The validator requires every test to finish within half of the language's time limit (Python 10 s, JavaScript 10 s, Java 4 s, C++ 2 s, Go 4 s).

## Question kinds

| `kind` | Languages | What runs | Test input | Expected output |
| --- | --- | --- | --- | --- |
| `algorithm` (default) | all five | the program, stdin to stdout | the program's stdin | its stdout |
| `ml` | `python` | the program in `debug-gym/python-ml` (Python with NumPy) | the program's stdin | its stdout |
| `sql` | `sql` | `judge-runners/sql_runner.py`: the input builds an in-memory SQLite database, then `query.sql` runs on it | `CREATE TABLE` / `INSERT` statements | a header of lower-case column names, then one row per line, values separated by tabs (`NULL`, numbers with up to 10 significant digits) |
| `rest` | `python`, `javascript` | `judge-runners/rest_harness.*` serves a paginated JSON API on 127.0.0.1 and runs the program with `API_BASE_URL` set | the program's stdin, a line `--- api data ---`, then the API's data as JSON | the program's stdout |
| `api` | `python`, `javascript` | `judge-runners/api_harness.*` starts the candidate's Flask (`debug-gym/python-api`) or Express (`debug-gym/node-api`) app with `PORT` set, then sends the requests | one JSON request per line: `method`, `path`, optional `headers` and `body` | one line per request: `<n>. <METHOD> <path> -> <status> <body>`, with the body as canonical JSON (sorted keys, no spaces), a JSON string, or `-` when empty |

- **Runtime images** are built once from `docker/<name>.Dockerfile` the first time a question needs them (this needs the internet); the judge containers that use them still run with no network.
- **SQL:** hidden tests must use different rows from the samples, so a query can't hard-code answers. Set `"ordered": false` when the statement says rows may come in any order: the runner then sorts the rows before comparing. Templates are a valid query that returns the right columns and no rows.
- **REST:** the API data's `resources` maps a name to its records; `GET /api/<name>?page=N&field=value` filters by exact field match and paginates with the data's `per_page`. `"throttle": "first"` answers the first request for every URL with `429` and `Retry-After: 0`. A custom-input run without the marker reuses the first sample's API data.
- **API:** a fresh app starts for every test case. Keep request values that Python and JavaScript read differently out of the tests (for example `2.0` as an integer, or `true` compared with `1`).
- **Numbers in ML answers:** print rounded values, and make the generator reject inputs whose exact answer sits on a rounding boundary, so every correct method rounds the same way. Templates print `0.0000` instead of `-0.0000`.
- Generators for these kinds compute the expected outputs from an independent model (exact fractions, a plain-Python simulation of the API, or the runner itself for SQL) and copy the sample tests into `question.json`.

## Validation

```
node scripts/validate-questions.mjs [question-id ...]
```

For each question and each of its languages, the validator runs the template and the solution through the real Docker judge, with the question kind's runner and runtime image (building the image first if needed). It checks the schema, that the samples match the sample tests, that the template fails at least one test, that the solution passes every test, and that no test takes more than half its time limit.
