# Authoring multiple-choice and written-answer questions

Practice tests mix coding questions with **multiple-choice** questions (one or several correct options) and **written-answer** questions, as engineering assessments often do.

## Multiple choice: `mcq/<topic-file>.json`

Each file holds an array. Group questions by topic, for example `mcq/data-structures.json`.

```json
{
  "id": "ds-stack-undo",
  "topic": "Data Structures",
  "difficulty": "Easy",
  "points": 5,
  "type": "single",
  "question": "Markdown. Code in fenced blocks is fine.",
  "options": ["Queue", "Stack", "Min-heap", "Hash map"],
  "answer": [1],
  "explanation": "Markdown: why the answer is right and why the strongest distractor is wrong."
}
```

- `topic`: Data Structures, Algorithms, Complexity, Databases, Operating Systems, Networking, Concurrency, Security, Object-Oriented Design, System Design, Testing, Git, Web, Python, JavaScript, Java, Machine Learning, Deep Learning, LLMs and RAG, ML Systems, REST APIs, SQL. The general quizzes (Sample test, full assessment, CS fundamentals) draw only from the first sixteen; the ML and back-end templates name their topics.
- `points`: Easy 5, Medium 10, Hard 15. Scoring is all-or-nothing.
- `type`: `single` (exactly one answer) or `multiple` (two or more answers; the question must say "Select all that apply").
- 4–6 distinct options, `answer` as option indexes (0-based).
- Write plausible distractors that reflect real misconceptions. Avoid "all of the above", trick wording and trivia about version numbers.
- Code-output questions ("What does this print?") must be fully deterministic and checked by actually running the code.
- Ids are unique across all files.

## Written answers: `mcq/subjective.json`

```json
{
  "id": "sd-rate-limiter",
  "topic": "System Design",
  "difficulty": "Medium",
  "points": 20,
  "question": "Markdown. Ask for a focused answer someone can write in 5–10 minutes.",
  "rubric": ["3–6 specific points a strong answer makes"],
  "sampleAnswer": "A model answer of 80–200 words."
}
```

`points`: Easy 10, Medium 20, Hard 30. A local model grades each answer against the rubric.

## Validating

```sh
node scripts/validate-mcq.mjs
```
