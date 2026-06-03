---
description: Session wrap-up — syncs CLAUDE.md stats, updates memory files, then suggests /compact. Run at the end of every session where code was changed.
allowed-tools: Read, Edit, Write, Bash, Glob
model: sonnet
argument-hint: "(no arguments needed)"
---

# Session Wrap-up

You are wrapping up a Claude Code session. Run the full MD sync rule from CLAUDE.md, then suggest /compact.

---

## Step 1 — Get current file line counts

```bash
wc -l index.html dorm-db.js modules/*.html 2>/dev/null
```

---

## Step 2 — Compare against CLAUDE.md stats table

Read the File Stats table in CLAUDE.md and identify any files whose line counts differ from the recorded values.

---

## Step 3 — Update CLAUDE.md

For every file where the line count changed:
- Update the Lines column in the File Stats table
- Move completed items from Pending to Completed improvements (use today's date)
- Add any new pending items discovered this session
- Update the function list if functions were added or removed

---

## Step 4 — Update memory files

For each module touched this session, update its `memory/module_<name>.md` file:
- Add new functions
- Update DormDB calls
- Note any modal or data model changes

Update `memory/project_state.md`:
- What was completed this session
- What remains pending
- Any architectural decisions made

---

## Step 5 — Output wrap summary

```
## Wrap Summary

### CLAUDE.md updated
[list of changes made — "no changes needed" if all counts matched]

### Memory files updated
[list of memory files touched]

### Suggest
Run /compact now to compress context before your next task.
```

Keep the summary under 15 lines.
