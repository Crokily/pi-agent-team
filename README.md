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

## The "Going to Work" Model

We call each scheduled agent invocation a **shift**. The shift follows a **clock-in protocol**:

```
1. Read AGENTS.md     → remember who you are and what you're responsible for
2. Read memory/       → recall what happened in previous shifts
3. Check inbox/       → see if anyone sent you new work
4. Do your work       → based on responsibilities + inbox + judgment
5. Before clocking out:
   - Results → outbox/
   - Update memory/
   - Processed inbox → inbox/.processed/
```

This protocol turns a one-off PI invocation into a **continuous work session with persistent context**. The agent isn't stateless anymore — it knows what it did yesterday, what it's waiting on, and what's on its plate.

---

## A Directory Is an Agent

```
agents/researcher/
├── AGENTS.md          # Who you are, what you're responsible for
├── schedule.yaml      # When you work (cron expressions)
├── inbox/             # Work others send you
├── outbox/            # Results you produce
├── memory/            # What you remember across shifts
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

## Everything Is Replaceable

The file-based defaults (inbox/, outbox/, memory/) are **concepts with a zero-dependency default implementation**, not mandates.

| Concept | Default (files) | Could become... |
|---------|-----------------|-----------------|
| Memory | `memory/*.md` | Memory MCP server, vector database, Notion |
| Inbox | `inbox/*.md` | Notion tasks, Linear issues, Slack, email |
| Outbox | `outbox/*.md` | Notion pages, GitHub issues, API calls |

To swap an implementation:
1. Give the agent the right MCP server or plugin
2. Update AGENTS.md: "check Notion for new tasks" instead of "check inbox/"
3. Done. The file-based directory isn't needed anymore.

The clock-in protocol doesn't change. The harness doesn't change. Only the agent's instructions change — because the agent is the one with the intelligence to adapt.

---

## The Harness Is Dumb

The harness — the thing that actually runs agents on schedule — is intentionally minimal. It does exactly three things:

1. Scans agent directories for `schedule.yaml`
2. Registers cron jobs
3. When a cron fires: invokes PI with `cwd` set to the agent's directory, injecting the clock-in prompt

It doesn't understand what agents do. It doesn't manage state. It doesn't route messages. It's a glorified cron daemon that knows how to call PI.

**Intelligence lives in the agents, not the infrastructure.**

This means the harness is ~300 lines of code. It means you could replace it with system cron and a shell script. It means the convention works even if the harness doesn't exist — you can manually `cd agents/researcher && pi -p "start your shift"` and everything works.

---

## Additive Complexity

The smallest possible agent:

```
agents/assistant/
└── AGENTS.md
```

That's it. One file. No schedule (trigger manually), no memory (stateless), no inbox (no collaboration). It's a fully valid agent.

Then, as needs emerge:
- Want automation? Add `schedule.yaml`
- Want continuity? Add `memory/`
- Want collaboration? Add `inbox/` and `outbox/`
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
mkdir -p my-team/agents/researcher
cat > my-team/agents/researcher/AGENTS.md << 'EOF'
# Researcher

## Role
You are the team's technical researcher.

## Responsibilities
- Investigate technologies and produce analysis reports
- Check inbox/ for research requests from team members
- Put findings in outbox/

## Working Style
- Cite sources with links
- Executive summary first, details after

## Domain
AI/ML, developer tools, cloud infrastructure
EOF

# Run a shift manually
cd my-team/agents/researcher
pi -p "You are starting a work shift. Read AGENTS.md for your role. Check if there's anything in inbox/ or memory/. Do your work, update memory/, put results in outbox/."
```

For automated scheduling, see the [Convention](./CONVENTION.md) for `schedule.yaml` format.

---

## Project Structure

```
├── CONVENTION.md          # The full convention specification
├── README.md              # This file — the ideas behind the project
└── templates/
    ├── team.yaml          # Template for team config
    └── agent/             # Template for a new agent directory
        ├── AGENTS.md
        ├── schedule.yaml
        ├── inbox/
        ├── outbox/
        ├── workspace/
        └── memory/
```

---

## What This Is Not

- **Not a framework.** No `npm install`, no API, no SDK. It's a convention.
- **Not a product.** No hosted service, no pricing page. It's an idea with templates.
- **Not opinionated about tools.** Use Notion, Linear, Slack, custom MCPs — the convention doesn't care.
- **Not locked to PI.** The ideas apply to any agent that can read files and follow instructions. PI is the natural fit because of its directory-based configuration, but the convention is agent-runtime-agnostic.

## What This Is

A way of thinking about agent teams that mirrors how real teams work: hire good people (define clear roles), give them a workspace (a directory), let them show up to work (scheduled shifts), and trust them to figure out the rest.

---

## License

MIT
