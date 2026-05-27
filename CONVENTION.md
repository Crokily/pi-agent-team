# PI Agent Team Convention

## Core Principle

**A directory is an agent.**

Everything an agent needs to be autonomous — identity, responsibilities, skills, tools, memory, schedule, and workspace — lives in a single directory. The harness's only job is to wake the agent up on schedule and point PI at that directory.

This convention defines the minimal structure for a team of role-driven PI agents. It intentionally leaves out collaboration protocols, task management, and orchestration — those are concerns the user can layer on top, just as a real company chooses its own project management tools after hiring employees.

---

## Team Structure

```
my-team/
├── team.yaml                # Team-level defaults
├── shared/                  # Resources available to all agents
│   ├── skills/              # Shared skills
│   ├── plugins/             # Shared plugins
│   └── knowledge/           # Shared reference material
└── agents/
    ├── researcher/          # Each subdirectory = one agent
    ├── coder/
    └── reviewer/
```

### team.yaml

Minimal team-level configuration. Agents inherit these defaults but can override them.

```yaml
name: my-team

defaults:
  model: claude-sonnet-4-6
  thinking: medium

# Shared MCP servers available to all agents
shared_mcp:
  - ./shared/mcp.json
```

Only `name` is required. Everything else is optional.

---

## Agent Directory

```
agents/<name>/
├── AGENTS.md            # Identity & responsibilities (required)
├── schedule.yaml        # When to work (optional — no schedule = on-demand only)
├── inbox/               # Incoming messages/tasks from others
│   └── .processed/      # Processed inbox items are moved here
├── outbox/              # Produced results for others to consume
├── workspace/           # Working files, drafts, intermediate state
├── memory/              # Persistent memory across shifts
│   ├── log.md           # Running shift log
│   └── context.md       # Ongoing context and state
├── skills/              # Agent-specific PI skills
├── plugins/             # Agent-specific PI plugins
└── mcp.json             # Agent-specific MCP server config (optional)
```

### Required vs Optional

| Path | Required | Purpose |
|------|----------|---------|
| `AGENTS.md` | **Yes** | The agent's identity. Without this, it's not an agent. |
| `schedule.yaml` | No | Without it, the agent only runs when manually triggered. |
| `inbox/` | No | Create it when the agent needs to receive work from others. |
| `outbox/` | No | Create it when the agent produces results for others. |
| `workspace/` | No | Create it when the agent needs scratch space. |
| `memory/` | No | Create it when the agent needs to remember across shifts. |
| `skills/` | No | Standard PI skills directory. |
| `plugins/` | No | Standard PI plugins directory. |
| `mcp.json` | No | Standard PI MCP configuration. |

The only hard requirement is AGENTS.md. Everything else emerges as needed.

---

## AGENTS.md — Role, Not Capability

The most important design decision in this convention: **AGENTS.md describes responsibilities, not capabilities.** It reads like a job description, not a feature list.

### Structure

```markdown
# <Agent Name>

## Role
One paragraph: who you are, what you're responsible for.

## Responsibilities
Concrete, recurring duties. These are what the agent checks on each shift.

## Working Style
How the agent should approach work — tone, rigor, format preferences.

## Domain
What areas this agent has expertise in.
```

### Example

```markdown
# Researcher

## Role
You are the team's technical researcher. You investigate technologies,
analyze trends, and provide informed recommendations to the team.

## Responsibilities
- Check inbox/ daily for research requests from team members
- Produce a weekly industry digest every Monday → outbox/weekly-digest/
- When you discover critical information, write an alert → outbox/alerts/
- Maintain ongoing research threads in memory/context.md

## Working Style
- Always cite sources with links
- Prefer primary sources (official docs, blog posts) over secondary
- When uncertain, say so explicitly
- Keep reports concise — executive summary first, details after

## Domain
AI/ML frameworks, cloud infrastructure, developer tools
```

### Why Role-Driven?

Task-driven agents need a human to say "do X." Role-driven agents know what X is because their AGENTS.md tells them their responsibilities. When the harness wakes them up, they check their responsibilities, look at their inbox and memory, and decide what to do.

This is the difference between "an agent that executes tasks" and "an agent that holds a position."

---

## schedule.yaml — When To Work

```yaml
shifts:
  - name: daily-checkin
    cron: "0 9 * * *"
    # No prompt — uses the default clock-in protocol

  - name: weekly-digest
    cron: "0 9 * * 1"
    prompt: "It's Monday. Produce this week's industry digest."

  - name: inbox-check
    cron: "0 */4 * * *"
    prompt: "Quick check — process any new inbox items only."
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable identifier for the shift |
| `cron` | Yes | Standard 5-field cron expression |
| `prompt` | No | Override the default clock-in prompt. When omitted, the harness uses the full clock-in protocol. |
| `enabled` | No | `true` by default. Set `false` to pause a shift. |
| `once` | No | `true` for one-time runs. ISO 8601 datetime in `cron` field instead of cron expression. |

### One-Time Tasks

```yaml
shifts:
  - name: initial-setup
    once: true
    cron: "2026-05-28T09:00:00Z"
    prompt: "Set up your workspace and introduce yourself to the team."
    enabled: true
```

---

## The Clock-In Protocol

When the harness wakes an agent (either on schedule or manually), it invokes PI with the agent's directory as `cwd` and injects the **clock-in prompt**:

```
You are starting a work shift.

1. Read your AGENTS.md to understand your role and responsibilities.
2. Read memory/ to recall context from previous shifts.
3. Check inbox/ for new messages or requests.
4. Do your work according to your responsibilities and any inbox items.
5. Before finishing:
   - Put results in outbox/ with descriptive filenames
   - Update memory/log.md with what you did this shift
   - Update memory/context.md with any ongoing context
   - Move processed inbox items to inbox/.processed/
```

When a shift has a custom `prompt`, it replaces step 4 only. Steps 1-3 and 5 always run.

**Why a protocol instead of just a prompt?** Because the protocol ensures the agent always grounds itself (reads AGENTS.md), recalls context (reads memory/), checks for new work (reads inbox/), and persists state (writes memory/). This is what makes it a "shift" instead of a one-off invocation.

### How PI Loads Agent Configuration

Because PI runs with `cwd` set to the agent directory:
- `AGENTS.md` is loaded as the project's agent instructions (PI standard behavior)
- `skills/` is discovered as the skills directory (PI standard behavior)
- `plugins/` is discovered as the plugins directory (PI standard behavior)
- `mcp.json` is loaded as MCP configuration (PI standard behavior)

The convention doesn't require any special PI integration. It works because it aligns with how PI already discovers configuration from the working directory.

---

## inbox/ — Receiving Work

Files placed here by humans or other agents. The agent checks this directory on each shift.

### File Naming Convention

```
inbox/YYYY-MM-DD_<from>_<subject>.md
```

Examples:
```
inbox/2026-05-27_human_research-flue-framework.md
inbox/2026-05-27_coder_need-api-review.md
```

### Processing

- Agent reads the file, does the work
- Moves processed file to `inbox/.processed/`
- If the work produces output, puts it in `outbox/`

### Sending to Another Agent

To send work to the `coder` agent from the `researcher` agent:

```bash
# The harness or a human simply writes a file:
echo "Please review the API design in outbox/api-design.md" \
  > ../coder/inbox/2026-05-27_researcher_review-api.md
```

Or PI does it naturally during a shift: "Write a message to the coder asking them to review..."

---

## outbox/ — Producing Results

Results the agent produces for others to consume.

### Structure

```
outbox/
├── weekly-digest/
│   ├── 2026-05-19.md
│   └── 2026-05-26.md
├── alerts/
│   └── 2026-05-27_critical-security-vuln.md
└── 2026-05-27_flue-framework-analysis.md
```

The agent organizes its outbox however makes sense. Subdirectories for recurring outputs, flat files for one-offs.

**Rule: the producing agent never deletes from outbox/.** Consumers (humans or other agents) are responsible for what they do with the results.

---

## memory/ — Persistent Context

How agents maintain continuity across shifts.

### Default Files

**memory/log.md** — A running log of shifts:

```markdown
## 2026-05-27 09:00 — Daily Checkin
- Processed 2 inbox requests
- Updated Flue Framework research thread
- Produced alert about new MCP standard update

## 2026-05-26 09:00 — Daily Checkin
- Began Flue Framework deep dive
- No inbox items
```

**memory/context.md** — Ongoing state and threads:

```markdown
## Active Research Threads
- Flue Framework evaluation (started 2026-05-26, ~60% complete)
- A2A protocol feasibility study (pending, requested by coder)

## Key Findings to Remember
- Flue requires Node.js >= 22.18
- MCP donated to Linux Foundation Dec 2025

## Waiting On
- Coder's feedback on API design proposal (sent 2026-05-25)
```

### Memory Is Agent-Written

The harness never writes to memory/. The agent itself decides what to remember. The clock-in protocol tells it to read memory/ at the start and update it at the end, but the content and structure are up to the agent.

---

## Minimal Example

The smallest possible agent team:

```
my-team/
├── team.yaml
└── agents/
    └── assistant/
        └── AGENTS.md
```

**team.yaml:**
```yaml
name: my-team
```

**agents/assistant/AGENTS.md:**
```markdown
# Assistant

## Role
General-purpose assistant. You help with whatever is needed.

## Responsibilities
- Check inbox/ for requests
- Complete requests and put results in outbox/
```

That's it. No schedule (manual trigger only), no memory, no skills. Add complexity only when needed.

---

## Design Principles

1. **A directory is an agent.** No database, no registry. If the directory exists under `agents/`, it's an agent.

2. **Role-driven, not task-driven.** AGENTS.md defines responsibilities, not one-off instructions. The agent decides what to do on each shift.

3. **File system is the API.** Inbox, outbox, memory — all just files. No message bus, no protocol, no serialization format. PI already knows how to read and write files.

4. **PI-native.** The convention aligns with how PI already works — AGENTS.md, skills/, plugins/, MCP. No special integration needed.

5. **Additive complexity.** Start with just AGENTS.md. Add schedule when you want automation. Add memory when you want continuity. Add inbox/outbox when you want collaboration. Nothing is required upfront.

6. **The harness is dumb.** It reads schedule.yaml, invokes PI at the right time, in the right directory. It doesn't understand agents, tasks, or collaboration. Intelligence lives in the agents, not the infrastructure.

7. **Everything is replaceable.** The file-based directories (inbox/, outbox/, memory/) are zero-dependency defaults, not mandates. They represent *concepts* — receiving work, producing results, persisting context — not implementations. Users can replace any of them with external tools (Notion, Linear, a memory MCP server, etc.) by installing the appropriate MCP/plugin and updating the agent's AGENTS.md. The clock-in protocol doesn't change; only the agent's instructions about *where* to check change.

---

## Replaceability Examples

The file-based defaults exist so agents work immediately with no setup. But every piece is a swappable implementation of a concept:

| Concept | Default (files) | Could become... |
|---------|-----------------|-----------------|
| Memory | `memory/*.md` | Memory MCP server, vector DB, Notion database |
| Inbox | `inbox/*.md` | Notion task list, Linear issues, Slack channel, email |
| Outbox | `outbox/*.md` | Notion pages, GitHub issues, email, Slack posts |
| Skills | `skills/` directory | Remote skill registry, shared skill packages |
| MCP tools | `mcp.json` | Dynamic MCP discovery, team-managed MCP hub |

To replace a default:
1. Install the MCP server or plugin on the agent
2. Update AGENTS.md responsibilities ("check the Notion inbox" instead of "check inbox/")
3. The file-based directory is no longer needed

The convention never locks you into files. Files are just the starting point that requires nothing.
