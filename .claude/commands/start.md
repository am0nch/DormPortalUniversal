---
description: Session startup — reads project state, memory, git status, and pending items. Run this automatically at the start of every session.
allowed-tools: Read, Bash, Glob
model: sonnet
argument-hint: "(no arguments needed)"
---

# Session Start — Briefing

You are starting or resuming a Claude Code session. Run this startup checklist silently and output a concise session brief at the end.

---

## Step 1 — Read project context

Read the CLAUDE.md file in the current working directory:
```bash
cat CLAUDE.md 2>/dev/null | head -80 || cat ../CLAUDE.md 2>/dev/null | head -80 || echo "No CLAUDE.md found"
```

---

## Step 2 — Read memory files

```bash
cat ~/.claude/projects/-home-richmond-Documents-Dorm-Manager/memory/project_state.md 2>/dev/null || echo "No project_state.md found"
```

---

## Step 3 — Git status

```bash
git status --short 2>/dev/null || echo "Not a git repo"
git log --oneline -5 2>/dev/null || echo "No git log"
```

---

## Step 4 — File line counts (compare against CLAUDE.md stats)

```bash
wc -l index.html dorm-db.js modules/*.html 2>/dev/null || wc -l *.html *.js 2>/dev/null || echo "No HTML/JS files found"
```

---

## Step 5 — Pending items

Extract pending items from CLAUDE.md:
```bash
grep -n "^\- \[ \]" CLAUDE.md 2>/dev/null || echo "No pending items found"
```

---

## Step 6 — Output Session Brief

After running all steps above, output ONLY this summary (keep it tight — no walls of text):

```
## Session Brief

Project:    [dorm name from CLAUDE.md]
Branch:     [current git branch]
Modified:   [list of modified files from git status, or "none"]

### Pending items
[bullet list from CLAUDE.md pending section — max 5 items]

### File counts vs last recorded
[only list files where wc -l differs from CLAUDE.md stats — "all match" if none differ]

### Last completed work
[1–2 lines from memory/project_state.md about what was done last session]

### Ready
What would you like to work on?
```

Keep the entire brief under 25 lines. Do not explain what you did to gather this info — just output the brief.
