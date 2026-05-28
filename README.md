# PI Agent Team

A minimal convention for running autonomous AI agent teams. No framework, no platform — just directories and a handful of ideas.

---

## The Insight

This project started from a simple observation while building [pi-discord-gateway](https://github.com/crokily/pi-discord-gateway), a bridge between Discord and the PI coding agent:

> Each Discord channel could be mapped to its own directory — with its own AGENTS.md, skills, plugins, MCP servers, and working space. Each channel was, in effect, a fully capable, independent PI agent. Add scheduled tasks, and suddenly you have a team of agents that can work on their own.

The Discord part was incidental. The real idea was: **a directory is an agent, and a folder of directories is a team.**

This project extracts that idea into a standalone convention — no Discord, no database, no complex infrastructure. Just the thought itself, with enough structure to be useful.

---

## The Problem with Current Agent Teams

Every multi-agent product in 2026 — Claude Code Agent Teams, CrewAI, AutoGen, AgentManager — follows the same pattern:

```
Human creates task → assigns to agent → agent executes → returns result
```

This is **task-driven**. It works, but it misses something fundamental about how real teams operate.

In a real company, employees don't wait for someone to hand them a task for every action they take. They have **ongoing responsibilities**. They show up to work, check what needs attention, make judgment calls, and get things done. The manager doesn't micromanage every action — they hire good people, define their roles clearly, and trust them to figure out the day-to-day.

Current agent teams simulate a task queue. We want to simulate a **workplace**.

---

## Role-Driven, Not Task-Driven

The core design decision: agents have **roles**, not just **tasks**.

| | Task-Driven (current tools) | Role-Driven (this convention) |
|---|---|---|
| Trigger | Human assigns a specific task | Agent "goes to work" on schedule |
| Instructions | "Do X" | "You are responsible for X, Y, Z" |
| Initiative | None — waits for input | Checks its domain, decides what to do |
| Memory | Stateless per invocation | Remembers across shifts |
| Metaphor | A function call | An employee |

An agent's AGENTS.md doesn't say "you can do research." It says "you **are** the researcher. Your job is to check for research requests daily, produce a weekly digest on Mondays, and alert the team when you find something critical."

When the harness wakes the agent up at 9 AM, it doesn't need to be told what to do. It reads its responsibilities, checks its memory for context, looks at its inbox for new requests, and gets to work.

---

## The "Always On Duty" Model

The harness is a long-running process — like an office that never closes. It watches each agent's inbox for new tasks and fires scheduled jobs via cron. When work appears, PI is spawned to handle it. When PI finishes, the harness checks if there's more work. The agent is effectively always available.

```
New task in inbox/ → harness detects it → spawns PI → PI reads AGENTS.md,
processes tasks, moves completed to .processed/ → PI exits → harness
re-checks inbox/ → more tasks? spawn PI again → empty? wait for next task
```

The harness doesn't inject any protocol. PI reads AGENTS.md automatically from the working directory — all workflow instructions (check inbox, update memory, move to .processed/) are written there. The harness just sets `cwd` and says "you have new tasks."

Session continuity comes from PI's `--session-dir` and `--continue` flags. The agent remembers what it did in previous invocations without any external state management.

---

## A Directory Is an Agent

```
agents/researcher/
├── AGENTS.md          # Who you are, what you're responsible for
├── inbox/             # Work others send you
│   └── .processed/    # Completed tasks
├── outbox/            # Results you produce
├── memory/            # What you remember across shifts
├── eval/              # How your quality is measured and improved
├── workspace/         # Your scratch space
├── skills/            # Your specialized abilities
├── plugins/           # Your extensions
└── mcp.json           # Your tool connections
```

No database entry. No registration API. No config file somewhere else referencing this agent. **If the directory exists, the agent exists.** Delete the directory, the agent is gone.

This works because PI already discovers configuration from the working directory — AGENTS.md, skills/, plugins/, MCP config. The convention doesn't fight PI's design; it *is* PI's design, applied to teams.

---

## Primitive-Level Design

This project is deliberately **not** a framework. It's a convention — a set of ideas about how to organize directories so that PI agents can work autonomously as a team.

We intentionally leave out:

- **Complex collaboration protocols** — In a real company, when you want collaboration tools, you install Jira or Slack. Same here. Need agents to coordinate? Add a shared Notion database, a task board, an MCP message bus. That's your choice, not ours.
- **Orchestration logic** — No DAGs, no workflows, no routing. The harness wakes agents up. What they do is their business.
- **Management dashboards** — The filesystem *is* the dashboard. `ls agents/` shows your team. `cat agents/researcher/memory/log.md` shows what the researcher did.

Why? Because **the value is in the ideas, not the infrastructure.** A convention that requires a 500-dependency framework to use has failed. A convention that works with just `mkdir` and a cron job has succeeded.

---

## The Recruitment Problem

There's a blind spot in every agent team product today: **nobody systematically ensures individual agents are actually good at their jobs.**

The typical workflow: write a prompt, add some plugins, deploy. If the agent underperforms, tweak the prompt. If it still doesn't work, give up on agent teams entirely. This is the equivalent of hiring someone off the street with no interview, no onboarding, no evaluation — and then blaming "hiring" when they fail.

Real companies invest heavily in recruitment: job descriptions, interviews, trial periods, performance reviews, training. Agent teams need the same discipline, but adapted to what agents actually are.

### The Agent Lifecycle

Creating an agent isn't a single step. It's a lifecycle:

```
1. Design       → Write AGENTS.md, choose skills and tools
2. Evaluate     → Run test scenarios, measure quality
3. Iterate      → Adjust role, skills, tools, harness based on eval results
4. Deploy       → Add schedule entries in team.yaml, let the agent go to work
5. Monitor      → Ongoing eval, continuous improvement
```

Most agent teams jump from step 1 to step 4. Steps 2 and 3 — the "recruitment" phase — are where quality comes from.

### What Makes an Agent "Qualified"?

Research (Stanford/MIT Meta-Harness, 2026) shows that changing just the harness around a fixed model can produce a **6x performance gap**. Agent quality isn't just about the prompt — it's about the entire directory: the role definition, the skills, the tools, the memory strategy, the verification steps.

This means "iterating on an agent" isn't just prompt engineering. It's adjusting the whole structure:

| Layer | What to adjust | Effect |
|-------|---------------|--------|
| Role definition | AGENTS.md | How the agent understands its job |
| Skills | skills/ | What specialized abilities it has |
| Tools | mcp.json | What external capabilities it can use |
| Memory strategy | memory/ structure | How it maintains context across shifts |
| Harness configuration | Convention setup | How the scaffolding supports the agent |

### Eval as a Primitive

The convention includes `eval/` as an optional directory — on the same level as `memory/` or `inbox/`. It provides:

- **Scenarios** (`eval/scenarios/*.md`) — test situations written in natural language
- **Results** (`eval/results/*.md`) — evaluation outcomes
- **Eval shifts** — isolated test runs that don't affect production state

These are primitives, not a framework. They give the eval-iterate loop a place to live within the agent directory. What you use them for — manual review, automated testing, RL-based optimization — is up to you.

### The HR Agent

Here's where it gets interesting: because everything in this convention is files and directories, an agent can manage other agents. An "HR agent" is just a regular agent whose job is recruitment:

```
HR Agent's responsibilities:
1. Create new agent directories from templates
2. Write eval scenarios based on the role requirements
3. Run eval shifts and analyze results
4. Identify which layer needs improvement (role? skills? tools?)
5. Make adjustments and re-evaluate
6. Repeat until the agent meets quality standards
```

No special API. No meta-framework. The HR agent reads and writes the same files a human would. This is the power of primitive-level design — sophisticated behavior emerges from simple building blocks.

### Automated Iteration Is Real

This isn't just theory. In 2026, multiple research projects have demonstrated automated agent improvement:

- **AutoAgent** — a meta-agent that autonomously improves other agents' prompts, tools, and orchestration. Hit #1 on SpreadsheetBench (96.5%) in a 24-hour automated run.
- **Meta HyperAgents** (Meta) — agents that can modify their own improvement code. Left to self-improve, they independently evolved persistent memory, performance tracking, and verification pipelines.
- **SkillRL** — automatic skill discovery and recursive skill-library evolution via reinforcement learning.
- **Polar** (NVIDIA) — RL training of models within black-box harnesses, achieving significant gains across Codex, Claude Code, and PI.

The eval primitives in this convention are designed to be consumed by these tools. Standard scenarios and results can feed into automated optimization — the convention provides the interface, external tools provide the intelligence.

---

## Everything Is Replaceable

The file-based defaults (inbox/, outbox/, memory/) are **concepts with a zero-dependency default implementation**, not mandates.

| Concept | Default (files) | Could become... |
|---------|-----------------|-----------------|
| Memory | `memory/*.md` | Memory MCP server, vector database, Notion |
| Inbox | `inbox/*.md` | Notion tasks, Linear issues, Slack, email |
| Outbox | `outbox/*.md` | Notion pages, GitHub issues, API calls |
| Eval | `eval/*.md` | Braintrust, LangSmith, programmatic test suites, RL pipelines |

To swap an implementation:
1. Give the agent the right MCP server or plugin
2. Update AGENTS.md: "check Notion for new tasks" instead of "check inbox/"
3. Done. The file-based directory isn't needed anymore.

The harness doesn't change. Only the agent's instructions change — because the agent is the one with the intelligence to adapt.

---

## The Harness Is Dumb

The harness — the long-running process that keeps agents working — is intentionally minimal. It does exactly two things:

1. Watches each agent's `inbox/` for new tasks — when one appears and the agent is idle, spawns PI
2. Reads schedule config from team.yaml and fires PI when cron expressions match

It doesn't understand what agents do. It doesn't manage state. It doesn't route messages. It doesn't inject prompts beyond "you have new tasks" or "execute scheduled task X."

**Intelligence lives in the agents, not the infrastructure.**

This means the harness is a few hundred lines of code. It means the convention works even without it — you can manually `cd agents/researcher && pi -p "you have new tasks"` and everything works.

---

## Additive Complexity

The smallest possible agent:

```
agents/assistant/
└── AGENTS.md
```

That's it. One file. No schedule (trigger manually), no memory (stateless), no inbox (no collaboration). It's a fully valid agent.

Then, as needs emerge:
- Want to receive tasks? Add `inbox/`
- Want recurring tasks? Add schedule entries in team.yaml
- Want continuity? Add `memory/`
- Want to share results? Add `outbox/`
- Want quality assurance? Add `eval/`
- Want specialized abilities? Add `skills/`
- Want external tools? Add `mcp.json`

Nothing is required upfront. Complexity is earned, not imposed.

---

## Getting Started

```bash
# Create a team
mkdir -p my-team/agents

# Create team config
echo "name: my-team" > my-team/team.yaml

# Create your first agent
mkdir -p my-team/agents/researcher/inbox
cat > my-team/agents/researcher/AGENTS.md << 'EOF'
# Researcher

## Role
You are the team's technical researcher.

## Task Processing
- On startup, check inbox/ for pending tasks (ignore .processed/)
- Each top-level entry in inbox/ is one task — process them in order
- After completing a task, move it to inbox/.processed/

## Responsibilities
- Investigate technologies and produce analysis reports
- Put findings in outbox/

## Working Style
- Cite sources with links
- Executive summary first, details after

## Domain
AI/ML, developer tools, cloud infrastructure
EOF

# Send a task
echo "Research the Flue Framework — focus on performance and production readiness." \
  > my-team/agents/researcher/inbox/1748422200_research-flue.md

# Run manually (or let the harness do it)
cd my-team/agents/researcher
pi -p "you have new tasks"

# Or start the harness to run all agents continuously
cd my-team/
pi-team
```

For the full convention, see [CONVENTION.md](./CONVENTION.md).

---

## Project Structure

```
├── CONVENTION.md          # The full convention specification
├── README.md              # This file — the ideas behind the project
├── src/                   # The harness — runtime that makes teams work
│   ├── index.ts           # Entry point: scan agents, start watchers + crons
│   ├── watcher.ts         # Per-agent inbox/ file watching
│   ├── cron.ts            # Schedule config from team.yaml, cron registration
│   ├── invoke.ts          # Spawn pi subprocess
│   ├── config.ts          # Read team.yaml
│   └── types.ts           # Type definitions
└── templates/
    ├── team.yaml          # Template for team config
    ├── agent/             # Template for a new agent directory
    │   ├── AGENTS.md
    │   ├── inbox/
    │   ├── outbox/
    │   ├── workspace/
    │   ├── memory/
    │   └── eval/
    └── hr-agent/          # Template for an HR agent (agent quality manager)
        └── AGENTS.md
```

---

## What This Is Not

- **Not a framework.** No `npm install`, no API, no SDK. It's a convention.
- **Not a product.** No hosted service, no pricing page. It's an idea with templates.
- **Not opinionated about tools.** Use Notion, Linear, Slack, custom MCPs — the convention doesn't care.
- **Not locked to PI.** The ideas apply to any agent that can read files and follow instructions. PI is the natural fit because of its directory-based configuration, but the convention is agent-runtime-agnostic.

## What This Is

A way of thinking about agent teams that mirrors how real teams work: hire good people (design roles, evaluate, iterate until qualified), give them a workspace (a directory), let them show up to work (scheduled shifts), and trust them to figure out the rest.

---

## License

MIT
