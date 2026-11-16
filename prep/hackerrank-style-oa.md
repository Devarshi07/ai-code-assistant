# How a timed online assessment works

Many companies screen candidates with a timed online assessment (OA) on a platform such as HackerRank or CodeSignal. The format is predictable, and knowing it well frees your attention for the questions. The Practice tests in this app follow the same flow, so the real thing feels familiar.

## The flow, step by step

1. **Invitation and landing page.** You see the duration, the number and types of questions, and the instructions. Many platforms offer a sample test: take it, because the editor and the buttons are what you'll use under time pressure.
2. **Onboarding.** You agree to an honor code and, if AI is allowed, an AI notice. Proctored tests check your webcam and that you have a single monitor. Starting the test starts a countdown that **doesn't pause**, even if you close the tab.
3. **Test home.** A list of every question with its type and status. You can answer in any order and come back later.
4. **The questions.** Usually coding questions, multiple choice, and sometimes written answers, SQL queries or API tasks.
5. **Submit test.** A confirmation lists questions that won't be evaluated, then a final check. When the timer runs out, the test submits itself.
6. **The report.** The company sees a score per question and often integrity signals and the AI transcript. You usually don't see this report; in this app you do.

## Coding questions: Run Code, Run Tests, Save & Proceed

A coding question shows the problem on the left, the editor on the right and a results panel below. The starter code already reads input and prints output; you complete the function.

| Button | What it does | When to use it |
|---|---|---|
| **Run Code** | Runs the sample cases, or your own input in the Custom tab | Constantly: it's fast and shows full input and output |
| **Run Tests** | Runs every test case, hidden ones included | When the samples pass and you want the real picture |
| **Save & Proceed** | Records this code as your answer and moves on | Whenever you have a version worth keeping |

**What counts when time runs out.** Platforms evaluate your last saved answer; failing that, the code from your last Run Tests; failing that, your last Run Code. Code you typed but never ran or saved is usually **not evaluated at all**. The habit that follows: Save & Proceed as soon as something works, and save again after each improvement.

**Scoring is partial.** Your score is the share of (weighted) test cases you pass. A simple solution that passes the small tests beats an elegant one that doesn't run. Get something correct first, save it, then optimize.

**Hidden test cases** show only a verdict, never their input or expected output. Read verdicts carefully:

- **Wrong Answer**: wrong output. Check edge cases, off-by-one errors and the exact output format (spaces, line breaks, rounding).
- **Runtime Error**: a crash. Look for empty inputs, index errors, division by zero, recursion depth.
- **Terminated due to timeout**: too slow. Compare your complexity with the constraints: n = 10⁵ rules out O(n²).
- **Compilation error**: read the compiler message; check the class name (Java usually expects `Solution`) and imports.

## Multiple choice and written answers

- **Single-answer questions** are all or nothing.
- **Multiple-answer questions** ("Select all that apply") often give partial credit per correct option, but choosing more options than there are correct answers can score zero. Pick only what you're confident about.
- **Code-reading questions** reward tracing by hand: write down variable values line by line instead of guessing.
- **Written answers** are graded against a rubric of points a strong answer makes. Structure helps: a direct answer first, then reasons, a concrete example and a trade-off. Aim for one solid paragraph, not an essay.

## Integrity modes and what they record

| Mode | What happens | What is recorded |
|---|---|---|
| **Standard** | Nothing is blocked | Tab switches with time away, pastes from outside the test |
| **Secure** | Full screen is enforced with a prompt to return; pasting from outside into the code editor is blocked | Full-screen exits, tab switches, time away, blocked pastes |
| **Proctored** | Secure mode plus webcam checks and a single-monitor check | Everything above, plus webcam flags such as no face or several faces |

Platforms increasingly add **code playback** (a replay of how your code was typed) and flags for **sudden large pastes** or **code that is deleted and replaced in one go**. The practical advice is the same everywhere: close other apps, use one monitor, turn off notifications, and don't copy code in from outside. If you must step away, it will show; it's better to have a reason than to be unaware.

## Time management

- **Skim everything first** (one or two minutes) so nothing surprises you at the end.
- **Multiple choice:** about a minute or two each, longer only for code-reading questions. Don't get stuck: answer, flag, come back.
- **Coding:** start with the question you're most confident about. Get a correct brute force, Save & Proceed, then optimize.
- **Check the clock** at the halfway point and again with five minutes left.
- **Last five minutes:** save every coding answer, answer every remaining multiple-choice question, and don't start a risky refactor.

## Checklists

**Before the test**

- [ ] Take the sample test, or a practice test here, to learn the buttons.
- [ ] Pick your language and know its input and output idioms by heart.
- [ ] One monitor, notifications off, other apps closed, charger plugged in.
- [ ] Water nearby; plan not to leave the tab.

**In the last five minutes**

- [ ] Every coding question has a Save & Proceed (or at least a recent Run Tests).
- [ ] Every multiple-choice question has an answer.
- [ ] No half-finished edit is left in the editor of a saved question.
- [ ] Submit with a minute to spare, rather than relying on the automatic time-out.
