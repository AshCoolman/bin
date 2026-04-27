---
name: commit-plan
description: Stage the most sensible next commit from the current diff, biased toward the current task, and suggest a conventional commit for what is staged.
---

# Skill: commit-plan

## Purpose

Unstage current staged files.



From the current git diff:
1. identify each **sensible commit**
2. bias toward the **recent task/context/work**
3. suggest a **conventional commit** for each
4. IMPORTANT: Create `./commit-plan/<YYYY-MM-DD-HHmm-ss>.md` in the exact format consumed by `commit-plan-execute`. Run `commit-plan-execute --help` once if you are unsure of the format — it is the source of truth. In short: one commit per line, no prose, each line `git add <files> && git cm -m "<conventional message>"`.

Default to **doing the staging** of the first commit

---

## Use when

Use when:
- the diff is mixed
- the next commit boundary is unclear
- the user wants help staging or naming the next commit

Do not use when:
- the user already specified exactly what to stage
- there is no diff
- the task is history rewriting

---

## Core rules

- Prefer **one concern per commit**
- Be wary of files that should not be committed i.e. sensitive
- Bias toward the **current task**, not the cleanest unrelated side-commit
- Use **hunk-level staging** when needed
- Do **not** stage everything by default
- The commit messages must describe **only what is staged** for comit
- Mention remaining unstaged work **only if substantial**
- If the diff is too entangled to split safely, say so plainly and handover work to the user.

---

## Commit selection order

Choose in this order:
1. matches the recent task/context
2. coherent
3. reviewable
4. honest to describe

Do not prioritise:
- unrelated cleanup
- opportunistic formatting
- side docs/config churn

…over the obvious current task.

---

## Split rules

Keep separate where practical:
- behaviour vs formatting
- feature vs refactor
- broad test cleanup vs implementation
- rename/move vs unrelated logic
- semantic change vs mechanical churn

If separation would be artificial or unsafe, keep the least-bad coherent unit together.


---

## Commit types

Use the narrowest accurate conventional commit type:

- `feat`
- `fix`
- `refactor`
- `perf`
- `test`
- `docs`
- `build`
- `ci`
- `chore`
- `style`

Add a scope only when it genuinely helps.

Examples:
- `fix(search): preserve filter state when query changes`
- `feat(editor): resolve pasted URIs into entity links`
- `refactor(graph): extract route projection helpers`

---

## Decision test per file/hunk

Ask:
1. What kind of change is this?
2. Is it part of the current task?
3. Does it share one clear intent with the staged set?
4. Would including it make review worse?
5. Would the commit message still be honest?

If not, leave it unstaged.

---

## Output

Return:

### Staged for next commit
- files staged fully
- files staged partially, with brief hunk description if needed

### Suggested commit
- one primary conventional commit
- optional alternate only if genuinely ambiguous

### Remaining unstaged work
Only if substantial:
- brief note on what remains
- whether it looks like the next commit

### Rationale
2 to 4 bullets max
