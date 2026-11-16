# AI-assisted assessments and interviews

More and more companies let you use an AI assistant during online assessments and live interviews. That doesn't make the round easier. The reviewer isn't checking whether you can get a model to produce an answer; they're watching how you frame the problem, how much of the thinking you keep for yourself, and whether you check what the AI gives you. Every prompt you send is usually part of the record.

This guide covers the rules to confirm, a routine for the first minutes, a working loop, a timing plan for a 60-minute round, the red flags reviewers look for, and drills to practise with.

## 1. Know the rules before you start

Assessment platforms usually offer three AI levels, and this app uses the same ones:

| Level | What the assistant does | What it won't do |
|---|---|---|
| **None** | Nothing: no chat, no inline suggestions | — |
| **Guarded** | Explains concepts and syntax, points at bugs, gives hints and short snippets | Write a complete solution or a whole function body |
| **Unguarded** | Everything a normal coding assistant does, often with agent mode and inline completions | — |

In repo-style tasks you may also get modes: **Ask** (answers questions and reads files), **Plan** (investigates and proposes steps without editing) and **Agent** (edits files and runs commands, each change waiting for your approval).

What is usually recorded:

- the full chat transcript, often shown to the reviewer next to your code;
- pastes into the editor, and whether they came from inside the test;
- tab switches, time away from the window and leaving full screen;
- in proctored rounds, webcam snapshots and screen checks.

**Checklist before you start**

- [ ] Which AI level, which modes, and are inline suggestions on?
- [ ] Is the transcript part of the evaluation? Assume yes.
- [ ] Which integrity mode: standard, secure (full screen) or proctored (webcam)?
- [ ] Are there hidden tests, and can you run them before submitting?
- [ ] Is any other tool allowed? Assume outside AI tools and second devices are not.

## 2. The first five minutes

Spend them on understanding, not on prompting.

1. **Read the whole task**, including constraints and examples. In multi-part tasks, read every part you can see.
2. **Restate the contract** in your own words: inputs, outputs, edge cases, performance limits. In a live interview, say it out loud and check it with the interviewer.
3. **Get familiar with the environment**: find the editor, the run and test buttons, the AI panel and the terminal. Send one small, harmless prompt, such as "summarize what `parse_orders` does", to see how the assistant answers and how fast it is.
4. **In a repository**, open the README and the tests before your first prompt, and skim the module you'll change. Reviewers notice when the first prompt arrives before any file was opened.
5. **Write down edge cases** you'll need to test later.

## 3. The working loop: think, plan, prompt small, verify

**Think.** Decide the approach yourself first, even roughly. The AI is a fast pair of hands, not the person who decides.

**Plan.** List the steps. If you have a Plan mode, ask it to critique your plan or find gaps, rather than asking it to invent one.

**Prompt in small, specific pieces.** Name files, functions, inputs, outputs and constraints, and give one task per prompt.

- Weak: "Solve this problem."
- Better: "In `scheduler.py`, `next_slot()` ignores the buffer minutes between bookings. Suggest a change to `next_slot` only, keep its signature, and list the edge cases it should handle."
- Weak: "Fix the tests."
- Better: "`test_refund_window` fails with an off-by-one at exactly 30 days. Explain which comparison causes it before changing anything."

**Verify everything.** Read each diff line by line. Run the tests after every change, add a test for the edge case you were worried about, and reject changes that alter interfaces or edit tests just to make them pass. If you don't understand a piece of generated code, ask the AI to explain it, then check the explanation against the code.

**When something fails**, debug like you would without AI: reproduce it, isolate it, form a hypothesis, fix it, verify. Re-prompting until something passes looks like guessing, and it usually is.

## 4. Communicate while you work

In live rounds, narrate your decisions: why you prompted a certain way, why you accepted or rejected a suggestion, what you'll test next. When you turn down AI output, say what was wrong with it; catching the AI's mistakes is one of the strongest signals you can give. Silence reads as being stuck. If the interviewer asks "why did you ask it that?", have a reason.

## 5. Timing a 60-minute round

| Minutes | Focus |
|---|---|
| 0–8 | Read, restate the contract, explore the environment, list edge cases |
| 8–15 | Plan; get the AI to critique the plan; agree on the approach |
| 15–45 | Build in small steps, running the tests after each change |
| 45–55 | Edge cases, cleanup, a final full test run |
| 55–60 | Summarize what works, what's left and what you'd do next |

For tasks in phases (fix a bug, build a feature, optimize), keep moving. A polished phase 1 and an untouched phase 3 score worse than three working phases with rough edges.

## 6. Red flags reviewers look for

- Pasting the whole task into the AI as the first prompt.
- Accepting large changes without reading them or running anything.
- Code you can't explain when asked, or duplicated helpers the AI added twice.
- Editing provided tests to make them pass.
- Long silences, or ignoring failing output.
- Trying to talk a guarded assistant out of its rules. It's logged, it rarely works, and it says something about judgement.

## 7. Drills

- **Three ways:** solve a task by hand, then with the AI, then again after changing one requirement. Compare how long each took and where the AI helped.
- **Prompt budget:** finish a guided problem in eight prompts or fewer. It forces you to make each one specific.
- **Review drill:** ask the AI for a full solution in a practice setting, then find its bugs before you run it.
- **Work log:** after each session, write four lines: what you asked, what you accepted, what you rejected and why, and what broke.
- **Keep the classic skills sharp:** once a week, do two timed problems without any AI.

## Before you press Submit

- [ ] The full test suite passes, and you've run it since your last change.
- [ ] You can explain every line the AI wrote.
- [ ] No provided tests or interfaces were changed without a reason.
- [ ] Edge cases from your list are covered by tests.
- [ ] Your summary says what works, what's missing and what you'd do next.
