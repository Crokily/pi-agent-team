# PI Agent Team Convention

## Core Principle

**A directory is an agent.**

Everything an agent needs to be autonomous — identity, responsibilities, skills, tools, memory, and workspace — lives in a single directory. The harness's only job is to ensure that whenever an agent has work in its inbox, PI is running to process it.

This convention defines the minimal structure for a team of role-driven PI agents. It intentionally leaves out collaboration protocols, task management, and orchestration — those are concerns the user can layer on top, just as a real company chooses its own project management tools after hiring employees.

---

## Team Structure

```
my-team/
├── team.yaml                # Team-level defaults
├── shared/                  # Resources available to all agents
│   ├── skills/              # Shared skills
│   ├── plugins/             # Shared plugins
│   ├── knowledge/           # Shared reference material
│   └── workspace/           # Shared workspace for agent collaboration
└── agents/
    ├── researcher/          # Each subdirectory = one agent
    ├── coder/
    └── reviewer/
```

### team.yaml

Team-level configuration. The harness reads this file on startup.

```yaml
name: my-team

defaults:
  model: claude-sonnet-4-6
  thinking: medium

# Shared MCP servers available to all agents
shared_mcp:
  - ./shared/mcp.json

# Per-agent scheduling (harness concern)
agents:
  researcher:
    schedule:
      - name: daily-checkin
        cron: "0 9 * * *"
      - name: ceo-report
        cron: "30 8 * * 1"
        prompt: "generate the CEO weekly report using workspace/ceo-report-template/"
```

Only `name` is required. Everything else is optional.

### Scheduling

Scheduling is a **harness concern**, not an agent concern. Agents don't know or care when they're woken up — they just process whatever work is in front of them. The harness reads `agents.<name>.schedule` from team.yaml and fires PI at the right time.

Each schedule entry has:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable identifier |
| `cron` | Yes | Standard 5-field cron expression |
| `prompt` | No | What to tell PI. Defaults to `"start your shift"`. Can reference files in the agent's directory for complex tasks. |

If a scheduled task needs complex content (templates, attachments, data files), place those files in the agent's `workspace/` and reference the path in the prompt.

---

## Agent Directory

```
agents/<name>/
├── AGENTS.md            # Identity & responsibilities (required)
├── inbox/               # Incoming tasks
│   └── .processed/      # Completed tasks are moved here
├── outbox/              # Produced results for others to consume
├── workspace/           # Working files, drafts, intermediate state
├── memory/              # Persistent memory across shifts
│   ├── log.md           # Running shift log
│   └── context.md       # Ongoing context and state
├── eval/                # Quality evaluation (optional)
│   ├── scenarios/       # Test scenarios (markdown)
│   └── results/         # Evaluation results
├── skills/              # Agent-specific PI skills
├── plugins/             # Agent-specific PI plugins
└── mcp.json             # Agent-specific MCP server config (optional)
```

### Required vs Optional

| Path | Required | Purpose |
|------|----------|---------|
| `AGENTS.md` | **Yes** | The agent's identity. Without this, it's not an agent. |
| `inbox/` | No | Create it when the agent needs to receive work. The harness watches this directory. |
| `outbox/` | No | Create it when the agent produces results for others. |
| `workspace/` | No | Create it when the agent needs scratch space. |
| `memory/` | No | Create it when the agent needs to remember across shifts. |
| `eval/` | No | Create it when you want to systematically test and improve the agent. |
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
- Process research requests from inbox/
- When you discover critical information, write an alert → outbox/alerts/
- Maintain ongoing research threads in memory/context.md

## Task Processing
- On startup, check inbox/ for pending tasks (ignore .processed/)
- Each top-level entry in inbox/ is one task — process them in order
- After completing a task, move it to inbox/.processed/

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

## The Harness — Making Teams Run

The harness is a long-running process — the minimal infrastructure that keeps agents working. Without it, the convention is just directories. With it, agents respond to tasks and run on schedule.

### What the Harness Does

The harness does exactly two things:

1. **Watch inbox/** — when new tasks appear and the agent is idle, spawn PI to process them
2. **Fire crons** — read schedule config from team.yaml, spawn PI when cron expressions match

That's it. The harness doesn't understand task content, doesn't manage agent state, and doesn't touch agent directories beyond setting `cwd`. Intelligence lives in the agents (via AGENTS.md), not the infrastructure.

### How PI Is Invoked

All invocations follow the same pattern:

```bash
pi --session-dir <agent-dir>/.session --continue -p "<prompt>" --cwd <agent-dir>/
```

- `--session-dir` + `--continue` maintain conversation history across invocations (PI handles compaction internally)
- `--cwd` points PI at the agent's directory, where PI discovers AGENTS.md, skills/, plugins/, and mcp.json automatically

**Two types of invocation:**

| Trigger | Prompt | Concurrency |
|---------|--------|-------------|
| New inbox task | `"you have new tasks"` | Per-agent serial — one PI at a time, re-check inbox after exit |
| Cron fires | Custom prompt from team.yaml, or `"start your shift"` | Independent — can run alongside inbox processing |

### Inbox Processing Loop

```
inbox/ has unprocessed items + agent is idle
  → spawn pi -p "you have new tasks"
  → pi reads AGENTS.md, checks inbox/, processes tasks, moves done items to .processed/
  → pi exits
  → harness re-checks inbox/
  → still items remaining? → spawn pi again
  → inbox empty? → wait for next file change
```

The harness guarantees: **if inbox/ has unprocessed tasks, PI will be running.** There is never a state where tasks exist but no PI is processing them.

### How PI Loads Agent Configuration

Because PI runs with `cwd` set to the agent directory:
- `AGENTS.md` is loaded as the project's agent instructions (PI standard behavior)
- `skills/` is discovered as the skills directory (PI standard behavior)
- `plugins/` is discovered as the plugins directory (PI standard behavior)
- `mcp.json` is loaded as MCP configuration (PI standard behavior)

The convention doesn't require any special PI integration. It works because it aligns with how PI already discovers configuration from the working directory.

---

## inbox/ — Receiving Work

The inbox is the universal task queue. Every task — whether from a human, another agent, or a CLI command — enters as a file or directory in inbox/.

### Task Format

Each **top-level entry** in inbox/ is one task. A task can be any type:

```
inbox/
  1748422200_research-ai-trends.md          # Plain text task
  1748422500_review-logo.png                # Single file task
  1748423100_analyze-quarterly-data/         # Compound task (directory)
    task.md
    Q4-report.xlsx
    charts/
      revenue.png
```

**Rules:**
- Naming convention: `{timestamp}_{slug}` — timestamp determines processing order, slug is human-readable
- Type is unrestricted — `.md`, `.png`, `.pdf`, a directory with arbitrary content
- For compound tasks (directories), the internal structure is up to the sender — no enforced layout
- The agent is intelligent enough to read any entry and determine what to do

### Processing

- Agent reads each top-level entry, does the work
- Moves completed tasks to `inbox/.processed/`
- If the work produces output, puts it in `outbox/`

### Sending Tasks

Anyone can write to an agent's inbox:

```bash
# Human via CLI
pi-team send researcher "Research the Flue Framework"

# Another agent during its shift — writes directly or via shared/workspace/
echo "Please review the API design" > ../coder/inbox/1748422200_researcher_review-api.md

# Programmatically (e.g. from a web dashboard)
# import { startTeam } from 'pi-agent-team';
# handle.sendTask('researcher', 'Research the Flue Framework');
```

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

The harness never writes to memory/. The agent itself decides what to remember. AGENTS.md should instruct the agent to read memory/ at the start and update it at the end, but the content and structure are up to the agent.

---

## eval/ — Agent Quality

Most agent teams skip straight from "create agent" to "deploy agent." This convention treats quality as a first-class lifecycle stage — on the same level as memory or collaboration.

Eval is optional. Without it, the agent works on trust (and that's fine for many cases). Add it when you want to systematically verify and improve an agent before — or after — it goes to work.

### Structure

```
eval/
├── scenarios/                              # Test definitions
│   ├── handle-research-request.md
│   └── detect-critical-alert.md
└── results/                                # Evaluation outputs
    ├── 2026-05-28_handle-research-request.md
    └── 2026-05-28_detect-critical-alert.md
```

### Scenarios

A scenario is a markdown file that describes a test situation and how to evaluate the agent's response. It is written for the agent (or an evaluator agent) to read directly.

```markdown
# Scenario: Handle Research Request

## Setup
Place in inbox/:
- `2026-05-28_human_research-flue.md`:
  "Please research the Flue Framework — focus on performance
  benchmarks and production readiness."

Memory state: No prior research threads active. Fresh agent.

## Task
Run a normal work shift with this inbox item.

## Evaluation Criteria
- Output should appear in outbox/ with a descriptive filename
- Must cite at least 3 primary sources (official docs, papers, benchmarks)
- Should lead with an executive summary before detailed analysis
- Should explicitly state uncertainties rather than speculate
- Should complete within a single shift
```

**Why markdown?** Scenarios are instructions, not configuration. They describe situations in natural language with some structure — the same thing agents already excel at reading. YAML would force natural language into string values, making it harder to write, read, and maintain.

### Results

After an eval shift completes, the result is written to `eval/results/` with the date and scenario name:

```markdown
# Eval Result: Handle Research Request
**Date:** 2026-05-28
**Scenario:** eval/scenarios/handle-research-request.md

## Outcome
- ✓ Output produced in outbox/2026-05-28_flue-framework-analysis.md
- ✓ 4 primary sources cited
- ✓ Executive summary present
- ✗ Did not explicitly flag uncertainty about benchmark methodology
- ✓ Completed in single shift

## Score
4/5 criteria met.

## Notes
Agent performed well on research depth but needs stronger epistemic
hedging. Consider adding explicit guidance in AGENTS.md Working Style
about flagging methodology limitations.
```

Results can be written by the agent evaluating itself, by a separate evaluator agent, or by a human reviewing the output. The convention doesn't prescribe who writes them — only where they go.

### The Eval-Iterate Loop

Eval on its own is just measurement. The real value comes from the loop:

```
1. Define scenarios     → eval/scenarios/
2. Run eval shifts      → agent works in isolated environment
3. Collect results      → eval/results/
4. Analyze & improve    → adjust AGENTS.md, skills/, mcp.json, memory structure
5. Repeat
```

This loop can be run manually by a human, or automated by an HR agent (see below). Each iteration adjusts the agent at whatever layer needs it — role definition, skills, tools, or harness configuration. The eval/ directory provides the fitness function; the agent directory provides the levers.

### The HR Agent Pattern

Because everything in this convention is files and directories, an agent can create and improve other agents. An "HR agent" is just a regular agent whose responsibilities include:

- Creating new agent directories from templates
- Writing and running eval scenarios
- Analyzing eval results to identify which layer needs improvement
- Adjusting AGENTS.md, skills/, mcp.json accordingly
- Re-running evals until the agent meets quality standards

This requires no special infrastructure. The HR agent reads and writes the same files any human would. It's an application of the eval primitives, not a separate system.

```
agents/
├── hr/                    # The HR agent — itself just an agent
│   ├── AGENTS.md          # "You are responsible for agent quality..."
│   ├── inbox/
│   └── memory/
├── researcher/            # An agent the HR agent created and refined
│   ├── AGENTS.md          # ← written/iterated by HR agent
│   ├── eval/
│   │   ├── scenarios/     # ← written by HR agent
│   │   └── results/       # ← analyzed by HR agent
│   └── skills/            # ← configured by HR agent
└── coder/
```

### Eval Is Replaceable

Like every other convention primitive, the file-based eval is a zero-dependency default. It can be replaced:

| Default | Could become... |
|---------|-----------------|
| `eval/scenarios/*.md` | Programmatic test suites, benchmark harnesses |
| `eval/results/*.md` | Structured eval databases, Braintrust/LangSmith experiments |
| Manual iteration | GEPA, AutoAgent, SkillRL automated optimization |
| Self-evaluation | Dedicated evaluator agent, LLM-as-judge, human review |

The convention provides the concept and a file-based starting point. The tools evolve; the concept remains.

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

## Task Processing
- Check inbox/ for pending tasks (ignore .processed/)
- Process each task, then move it to inbox/.processed/
- Put results in outbox/

## Responsibilities
- Complete requests promptly and accurately
- Ask for clarification via outbox/ when a task is ambiguous
```

That's it. No memory, no skills, no scheduled tasks. Add complexity only when needed.

---

## Design Principles

1. **A directory is an agent.** No database, no registry. If the directory exists under `agents/` with an AGENTS.md, it's an agent.

2. **Role-driven, not task-driven.** AGENTS.md defines responsibilities, not one-off instructions. The agent decides what to do based on its role, its inbox, and its judgment.

3. **File system is the API.** Inbox, outbox, memory — all just files. No message bus, no protocol, no serialization format. PI already knows how to read and write files.

4. **PI-native.** The convention aligns with how PI already works — AGENTS.md, skills/, plugins/, MCP. No special integration needed. PI reads AGENTS.md automatically from the working directory; the harness just sets `cwd`.

5. **Additive complexity.** Start with just AGENTS.md. Add inbox when you want to receive tasks. Add memory when you want continuity. Add outbox when you want to produce results. Add eval when you want quality assurance. Add schedule entries in team.yaml when you want cron-triggered work. Nothing is required upfront.

6. **The harness is dumb.** It watches inbox/ for new files and fires crons from team.yaml. It doesn't understand agents, tasks, or collaboration. Intelligence lives in the agents, not the infrastructure.

7. **Everything is replaceable.** The file-based directories (inbox/, outbox/, memory/, eval/) are zero-dependency defaults, not mandates. They represent *concepts* — receiving work, producing results, persisting context, measuring quality — not implementations. Users can replace any of them with external tools (Notion, Linear, a memory MCP server, Braintrust, etc.) by installing the appropriate MCP/plugin and updating the agent's AGENTS.md.

8. **Quality is a lifecycle stage.** Creating an agent (writing AGENTS.md) is only the first step. Systematically evaluating, iterating, and improving agents is how teams go from "wrote a prompt" to "deployed a reliable worker." The convention provides eval primitives so this process has a home — but doesn't prescribe how to judge quality, because that's role-specific.

---

## Replaceability Examples

The file-based defaults exist so agents work immediately with no setup. But every piece is a swappable implementation of a concept:

| Concept | Default (files) | Could become... |
|---------|-----------------|-----------------|
| Memory | `memory/*.md` | Memory MCP server, vector DB, Notion database |
| Inbox | `inbox/*.md` | Notion task list, Linear issues, Slack channel, email |
| Outbox | `outbox/*.md` | Notion pages, GitHub issues, email, Slack posts |
| Eval | `eval/*.md` | Braintrust experiments, LangSmith, programmatic test suites |
| Skills | `skills/` directory | Remote skill registry, shared skill packages |
| MCP tools | `mcp.json` | Dynamic MCP discovery, team-managed MCP hub |

To replace a default:
1. Install the MCP server or plugin on the agent
2. Update AGENTS.md responsibilities ("check the Notion inbox" instead of "check inbox/")
3. The file-based directory is no longer needed

The convention never locks you into files. Files are just the starting point that requires nothing.
