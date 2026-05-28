---
name: team
description: |
  Manage pi-agent-teams: initialize teams, create/remove agents, send tasks, 
  check status, configure schedules. Trigger on /team or when user mentions 
  agent team management, adding agents, assigning tasks, or team status.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
arguments:
  - name: action
    description: "init, add, send, status, schedule, remove, or natural language"
argument-hint: "init | add <name> | send <agent> <msg> | status | schedule <agent> <cron>"
---

# /team — Agent Team Management

Interpret `$ARGUMENTS` to determine the action. If ambiguous, ask the user.

## Principle

This skill is a **control surface** for pi-agent-team. Delegate to the `pi-team` CLI for all operations it supports. Only implement logic directly when the CLI doesn't cover the case (schedule editing, removal, complex sends with attachments).

## Actions

### `init [dir]`

Run:
```bash
pi-team init [dir]
```

### `add <name>`

1. Run:
   ```bash
   pi-team add <name>
   ```
2. Ask the user about the agent's role.
3. Edit `agents/<name>/AGENTS.md` with the role details — fill in:
   - Role, Task Processing, Responsibilities, Working Style, Domain sections.

### `send <agent> <message>`

**Simple text task** — delegate to CLI:
```bash
pi-team send <agent> "<message>"
```

**Complex task with files or attachments** — handle directly:
1. Verify `agents/<agent>/inbox/` exists.
2. Create a directory: `agents/<agent>/inbox/{timestamp}_{slug}/`
3. Write `task.md` with the message, copy/write attachments alongside it.

### `status`

Run:
```bash
pi-team status
```

### `schedule <agent> <cron> [prompt]`

The CLI does not support schedule editing yet. Handle directly:

1. Read `team.yaml`.
2. Add entry under `agents.<agent>.schedule` — auto-name from prompt or use "shift".
3. Default prompt: `"start your shift"`.
4. Cron must be 5-field standard format.
5. Write updated `team.yaml`.

### `remove <name>`

The CLI does not support removal yet. Handle directly:

1. **Confirm with user** — this deletes the agent directory.
2. Remove `agents/<name>/`.
3. Remove any schedule entries for this agent from `team.yaml`.

## Reference

### Directory structure

```
team-root/
├── team.yaml                # name, defaults, agent schedules
├── agents/
│   └── <name>/
│       ├── AGENTS.md        # Role definition (required — no AGENTS.md = ignored)
│       ├── inbox/           # Task queue (one top-level entry = one task)
│       │   └── .processed/  # Completed tasks moved here
│       ├── outbox/          # Agent output/results
│       ├── memory/          # Persistent across invocations
│       ├── workspace/       # Scratch space
│       ├── eval/            # Scenarios + results for quality
│       └── skills/          # Agent-specific skills
└── shared/
    └── workspace/           # Cross-agent collaboration space
```

### team.yaml

```yaml
name: my-team
defaults:
  model: claude-sonnet-4-6
  thinking: medium
agents:
  researcher:
    schedule:
      - name: daily-check
        cron: "0 9 * * *"
        prompt: "start your shift"
```

### AGENTS.md must include Task Processing

Every agent's AGENTS.md needs this section (adapt wording to the role):

```markdown
## Task Processing
- On startup, check inbox/ for pending tasks (ignore .processed/)
- Each top-level entry in inbox/ is one task — process them in order
- After completing a task, move it to inbox/.processed/
```

### Inbox naming

`{unix_timestamp}_{slug}.md` — e.g. `1748422200_research-flue.md`. Can be a file (simple text task) or directory (complex task with attachments, use `task.md` as entry point inside).

## Harness

The harness is a separate long-running process (`pi-team` or `pi-team start`) that:
- Watches each agent's `inbox/` — spawns PI when a task appears
- Fires cron jobs from `team.yaml` schedules

This skill manages the **structure**. The harness **runs** it. They are independent — the team works without the harness (invoke agents manually with `cd agents/<name> && pi -p "you have new tasks"`).
