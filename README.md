# PI Agent Team

A minimal convention for running autonomous AI agent teams. No framework, no platform — just directories and a handful of ideas.

---

## The Insight

This project started from a simple observation while building [pi-discord-gateway](https://github.com/crokily/pi-discord-gateway), a bridge between Discord and the PI coding agent:

> Each Discord channel could be mapped to its own directory — with its own AGENTS.md, skills, plugins, MCP servers, and working space. Each channel was, in effect, a fully capable, independent PI agent. Add scheduled tasks, and suddenly you have a team of agents that can work on their own.

The Discord part was incidental. The real idea was: **a directory is an agent, and a folder of directories is a team.**

This project extracts that idea into a standalone convention — no Discord, no database, no complex infrastructure. Just the thought itself, with enough structure to be useful.

---

## What Everyone Else Builds: a Smart Orchestrator

By 2026, "a team of AI agents" is a crowded field, not a thesis — and it's worth being honest about that field before claiming to do something different.

The dominant open-source shape is the **orchestrator**: a lead agent or control-plane that takes one goal, breaks it into tasks, and routes them across workers it spawns. [ClawTeam](https://github.com/HKUDS/ClawTeam) spawns workers into git worktrees and tmux panes; [Orloj](https://github.com/OrlojHQ/orloj) compiles declarative YAML into agent graphs with leased tasks; [OpenRig](https://github.com/mvschwarz/openrig) wires pods of agents with `delegates_to` edges; [agent-teams-ai](https://github.com/777genius/agent-teams-ai) has a "team lead" auto-fill a kanban board. A close cousin is the **auto-assembled role roster**, where a concierge interviews you and stands up a PM, some engineers, and a QA who report to a coordinator ([MASON](https://github.com/Mason-Teams/mason-teams), [Muster](https://github.com/sandhuka/muster-ai), [Collo](https://github.com/plusai-solutions/ai-scrum-master-template)).

The idea of an agent as a **persistent employee with standing duties** isn't new either. Lindy sells "AI employees," Cursor runs agents on cron jobs and git events, ChatGPT has scheduled Tasks, and [Artificial](https://github.com/AndreBaltazar8/artificial) even boots a "CEO" agent that hires and fires its own workers. "Show up and do your job without being asked" is a real, well-populated category — we're not inventing it.

What nearly all of these share is a **smart center**: a lead, a graph, a control-plane that plans, assigns, routes, and reconciles. The agents are the muscle; the coordinator is the brain.

pi-agent-team makes the opposite bet.

---

## The Opposite Bet: No Orchestrator

There is no lead agent here. No task graph, no router, no control-plane deciding who does what. The runtime only wakes agents up; everything else lives **inside each agent**.

That doesn't mean tasks disappear — they still arrive as files in an agent's `inbox/`, so in the small this convention *is* a task queue like any other. What's deliberately missing is the layer *above* the agents: nobody decomposes a goal and hands out the pieces. Each agent owns a **domain** and decides for itself what the day needs.

So the obvious question: why throw away the orchestrator, when a smart lead is exactly the part everyone else is building? Because that's the wrong place to put the intelligence.

- **It has to be smart about everything.** To route work well, an orchestrator must model every agent's domain — a god-object that understands the whole team. It's the hardest piece to write and the first to break.
- **It's a single point of failure for judgment.** One bad decomposition or routing decision degrades the entire team. A runtime that makes no decisions can make no bad ones.
- **It freezes intelligence in code while the models keep improving.** Hand-written orchestration logic bakes in today's assumptions, and every model upgrade has to squeeze through that fixed bottleneck. Push the intelligence into the agents — the model plus its directory — and a better model makes every agent better at once, with nothing in the middle gating it.
- **It couples the whole team to the center.** Adding, removing, or reworking an agent means editing the orchestrator. Here, `mkdir` hires a teammate and `rm` lets one go — nothing central to touch, and different agents can even run on different runtimes.
- **The leverage isn't in the dispatcher anyway.** What makes an agent good is its own role, skills, tools, and memory — its directory. That's the whole premise of [The Recruitment Problem](#the-recruitment-problem) below: the scaffolding around a fixed model dominates its quality. So invest intelligence *there*, one agent at a time, instead of concentrating it in a planner that sits above them all.

The result is a team that's never merely as good as its orchestrator — because there isn't one. It's as good as its agents, and each one improves on its own.

| | Coordinator-driven (most 2026 tools) | This convention |
|---|---|---|
| Where the intelligence lives | A lead agent / graph / control-plane | Each agent, in its AGENTS.md |
| How an agent starts | The coordinator spawns it for a sub-task | A schedule fires, or a file lands in its inbox |
| Lifespan | Spawned per goal, then gone | A persistent role-holder, across shifts |
| Coordination | The coordinator routes and reconciles | Plain files — inbox / outbox / memory |
| Infrastructure | Orchestrator, task graph, queues | A directory and a cron line |
| Metaphor | A build pipeline | An employee |

An agent's AGENTS.md doesn't say "you can do research." It says "you **are** the researcher — check for research requests daily, produce a digest on Mondays, and flag anything critical to the team." When the runtime wakes it at 9 AM, it isn't told what to do. It reads its responsibilities, checks its memory, looks at its inbox, and gets to work.

That's the difference between an agent that *executes tasks* and one that *holds a position*.

---

## The "Always On Duty" Model

The autonomous runtime is a long-running process — like an office that never closes. It watches each agent's inbox for new tasks and fires scheduled jobs via cron. When work appears, PI is spawned to handle it. When PI finishes, the runtime checks if there's more work. The agent is effectively always available.

```
New task in inbox/ → runtime detects it → spawns PI → PI reads AGENTS.md,
processes tasks, moves completed to .processed/ → PI exits → runtime
re-checks inbox/ → more tasks? spawn PI again → empty? wait for next task
```

The runtime doesn't inject any protocol. PI reads AGENTS.md automatically from the working directory — all workflow instructions (check inbox, update memory, move to .processed/) are written there. The runtime just sets `cwd` and says "you have new tasks."

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
- **Orchestration logic** — No DAGs, no workflows, no routing. The runtime wakes agents up. What they do is their business.
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
3. Iterate      → Adjust role, skills, tools, runtime based on eval results
4. Deploy       → Add schedule entries in team.yaml, let the agent go to work
5. Monitor      → Ongoing eval, continuous improvement
```

Most agent teams jump from step 1 to step 4. Steps 2 and 3 — the "recruitment" phase — are where quality comes from.

### What Makes an Agent "Qualified"?

Research (Stanford/MIT Meta-Harness, 2026) shows that changing just the scaffolding around a fixed model can produce a **6x performance gap**. Agent quality isn't just about the prompt — it's about the entire directory: the role definition, the skills, the tools, the memory strategy, the verification steps.

This means "iterating on an agent" isn't just prompt engineering. It's adjusting the whole structure:

| Layer | What to adjust | Effect |
|-------|---------------|--------|
| Role definition | AGENTS.md | How the agent understands its job |
| Skills | skills/ | What specialized abilities it has |
| Tools | mcp.json | What external capabilities it can use |
| Memory strategy | memory/ structure | How it maintains context across shifts |
| Runtime configuration | Convention setup | How the scaffolding supports the agent |

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

The runtime doesn't change. Only the agent's instructions change — because the agent is the one with the intelligence to adapt.

---

## The Runtime Is Minimal

The autonomous runtime — the long-running process that keeps agents working — is intentionally minimal. It does exactly two things:

1. Watches each agent's `inbox/` for new tasks — when one appears and the agent is idle, spawns PI
2. Reads schedule config from team.yaml and fires PI when cron expressions match

It doesn't understand what agents do. It doesn't manage state. It doesn't route messages. It doesn't inject prompts beyond "you have new tasks" or "execute scheduled task X."

**Intelligence lives in the agents, not the infrastructure.**

This means the runtime is a few hundred lines of code. It means the convention works even without it — you can manually `cd agents/researcher && pi -p "you have new tasks"` and everything works.

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

## Install

### Prerequisites

- **Node.js 22+**
- **The [pi](https://github.com/crokily/pi) CLI**, installed and configured with an API key

### Install from source

```bash
git clone https://github.com/crokily/pi-agent-team.git
cd pi-agent-team
npm install
npm run build
npm link          # makes the pi-team command available globally
```

pi-team is not yet published to npm.

---

## Getting Started

### With the CLI

```bash
pi-team init my-team
cd my-team
pi-team add researcher        # creates directory + template AGENTS.md
# edit agents/researcher/AGENTS.md to define the role
pi-team send researcher "Research the Flue Framework"
pi-team start                 # start the autonomous runtime — watches inboxes + fires crons
```

### By hand (the convention is just directories)

```bash
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

echo "name: my-team" > my-team/team.yaml

echo "Research the Flue Framework — focus on performance and production readiness." \
  > my-team/agents/researcher/inbox/1748422200_research-flue.md

# Run manually (or let the autonomous runtime do it)
cd my-team/agents/researcher
pi -p "you have new tasks"
```

For the full convention, see [CONVENTION.md](./CONVENTION.md).

---

## Project Structure

```
├── CONVENTION.md          # The full convention specification
├── README.md              # This file — the ideas behind the project
├── skill/                 # PI skill for managing teams from inside PI
│   └── SKILL.md
├── src/                   # The autonomous runtime — makes teams self-operating
│   ├── index.ts           # CLI entry point (pi-team command)
│   ├── runtime.ts         # Team engine: startTeam() → TeamHandle
│   ├── commands.ts        # Operations: init, add, send, status (returns data)
│   ├── events.ts          # Typed event emitter for runtime observability
│   ├── watcher.ts         # Per-agent inbox/ file watching
│   ├── cron.ts            # Cron scheduling from team.yaml
│   ├── invoke.ts          # Spawn pi subprocess with concurrency control
│   ├── config.ts          # Read team.yaml + discover agents
│   ├── logger.ts          # Console logger (subscribes to runtime events)
│   └── types.ts           # All types, event map, operation results
└── templates/
    ├── team.yaml          # Template for team config
    ├── agent/             # Template for a new agent directory
    └── hr-agent/          # Template for an HR agent (agent quality manager)
```

The project is designed for multiple control surfaces. The CLI (`pi-team`) is one; a website, Notion console, or PI skill can use the same operations layer:

```ts
// Operations — any control surface can use these
import { init, addAgent, sendTask } from 'pi-agent-team';

// Autonomous runtime — optional, adds self-running capability
import { startTeam } from 'pi-agent-team/runtime';

const handle = await startTeam('/path/to/team');
handle.sendTask('researcher', 'investigate Flue Framework');
handle.events.on('invocation:end', (e) => { /* push to dashboard */ });
```

---

## What This Is Not

- **Not a framework.** The convention is just directories and ideas. The autonomous runtime (`pi-team`) provides a CLI and programmatic API, but the convention works without it.
- **Not a product.** No hosted service, no pricing page. It's an idea with templates.
- **Not opinionated about tools.** Use Notion, Linear, Slack, custom MCPs — the convention doesn't care.
- **Not locked to PI.** The ideas apply to any agent that can read files and follow instructions. PI is the natural fit because of its directory-based configuration, but the convention is agent-runtime-agnostic.

## What This Is

A way of thinking about agent teams that mirrors how real teams work: hire good people (design roles, evaluate, iterate until qualified), give them a workspace (a directory), let them show up to work (scheduled shifts), and trust them to figure out the rest.

---

## License

MIT
