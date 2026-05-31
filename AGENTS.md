# pi-agent-team

## What This Project Is

pi-agent-team provides two things at two levels of commitment:

1. A **convention** for organizing AI agent teams using the file system. A directory with an AGENTS.md is an agent. A folder of agent directories is a team. Inbox, outbox, memory, eval -- all files. No framework, no database, no registration API. The convention is usable by anything that can read and write files.

2. An optional **autonomous runtime** that adds self-running capability to a team. It watches inboxes for new tasks and fires cron schedules. Without it, the team still exists and can be driven by any other runtime -- a human typing `pi -p "..."`, a Claude Code `/schedule`, a Notion webhook, a web dashboard. With the autonomous runtime, the team becomes self-operating.

The convention is the product. The autonomous runtime is one consumer of it.

---

## Architecture

```
agent team (convention: directories + files)
  |
  +-- driven by any runtime that can read/write files:
      |
      +-- pi -p "..."                     manual / one-shot
      +-- Claude Code /schedule            scheduled
      +-- Notion webhook -> inbox/         event-driven
      +-- autonomous runtime               self-running (inbox watch + cron)
      +-- web dashboard                    visual
      +-- anything else
```

The convention sits at the bottom. Runtimes sit above it. No runtime is privileged -- all interact with the team through the same interface: the file system. The autonomous runtime is not "the harness for the team." It is one of many possible drivers.

This matters because it determines what couples to what. The convention must never assume which runtime is driving it. The autonomous runtime must never require capabilities that only it can provide. If a feature only works when the autonomous runtime is running, it belongs in the autonomous runtime, not in the convention.

---

## Design Principles

### 1. The convention is pure structure

The convention defines what directories and files mean. It does not define how they are created, read, or acted upon. This separation is what makes the convention usable by any runtime.

Convention says: "a file in inbox/ is a pending task." It does not say how the file got there or who will process it. Convention says: "AGENTS.md defines the agent's identity." It does not say who reads it or when.

This is the same principle that makes Pi's directory-based configuration work across interactive TUI, print mode, JSON mode, RPC mode, and SDK embedding. Pi does not care how you invoke it. It discovers AGENTS.md, skills/, and mcp.json from the working directory regardless of whether a human started it or a daemon spawned it. The convention inherits this property: it works regardless of what reads it.

**Do:** Define file and directory semantics. Define naming conventions. Define the minimal valid structure.

**Do not:** Embed runtime assumptions in the convention. Do not require a process to be running for the convention to be valid. Do not add convention elements that only make sense with a specific runtime.

### 2. A directory is an agent, fully and completely

Everything an agent needs -- identity, responsibilities, skills, tools, memory, workspace, evaluation criteria -- lives inside its directory. Nothing about the agent is defined elsewhere. No database entry, no registry, no configuration file in a parent directory that must reference it.

This is a direct application of Pi's filesystem-as-configuration principle. Pi discovers all configuration by walking the filesystem from cwd upward. An agent directory is a valid Pi workspace: set cwd to the directory and Pi loads AGENTS.md, skills/, mcp.json, and everything else automatically. The convention does not fight Pi's design; it is Pi's design applied to teams.

Consequences:

- `mkdir agents/researcher && echo "# Researcher" > agents/researcher/AGENTS.md` creates an agent. No other step is required.
- `rm -rf agents/researcher` removes an agent. No cleanup, no dangling references.
- Moving an agent directory to a different team is `mv`. Copying is `cp -r`.
- An agent directory is self-contained enough to be version-controlled, templated, shared, or archived independently.

**Do:** Keep all agent state inside the agent directory. Use the agent directory as the working directory when invoking Pi.

**Do not:** Store agent configuration in team.yaml except for runtime-specific concerns (schedules, model overrides). Do not create cross-references that would break if an agent directory is moved or renamed.

### 3. Schedule is a runtime concern, not an agent concern

An agent's AGENTS.md says what the agent is responsible for. It does not say when the agent runs. When to wake an agent is the runtime's decision -- it might be a cron line in team.yaml, a Claude Code `/schedule`, a Notion automation, or a human at a keyboard.

This separation matters because different runtimes express scheduling differently. The autonomous runtime uses cron expressions in team.yaml. Claude Code uses its own scheduling system. A web dashboard might use a calendar UI. If schedule were baked into AGENTS.md, every runtime would have to parse and reconcile it.

The current design places schedules in `team.yaml` under `agents.<name>.schedule`. This is correct: team.yaml is runtime configuration, not agent identity. The autonomous runtime reads it. Other runtimes ignore it and use their own scheduling.

**Do:** Keep scheduling in runtime-specific configuration (team.yaml for the autonomous runtime). Let agents describe their responsibilities without reference to when they execute.

**Do not:** Add schedule information to AGENTS.md. Do not require agents to know which runtime is driving them.

### 4. Coordination happens through the file system

When agents need to coordinate -- send tasks to each other, share results, maintain shared state -- they do it through files. Agent A writes to Agent B's inbox/. Agent A puts results in its outbox/ for anyone to read. Shared state goes in shared/workspace/.

There is no message bus, no API, no lock manager, no coordination protocol. Files are the protocol. This works because:

- Files are atomic at the level that matters (a file either exists or it does not).
- Files are observable (the autonomous runtime watches for changes; any runtime can poll).
- Files are inspectable (ls, cat, find -- the filesystem is the dashboard).
- Files are the one interface every runtime shares.

This is the same reasoning behind Pi's session-as-JSONL design: data stored as files is inspectable, exportable, post-processable, and forkable without any special tooling.

When multiple runtimes drive the same team simultaneously -- say, the autonomous runtime is watching inboxes while a human sends a task via CLI -- coordination is naturally serialized through the file system. The CLI writes a file to inbox/. The autonomous runtime's file watcher detects it. No API call, no lock, no race condition at the semantic level. The file system is the shared bus.

**Do:** Use inbox/, outbox/, and shared/workspace/ for inter-agent and inter-runtime coordination. Design for the case where multiple runtimes are active simultaneously.

**Do not:** Add an API layer for coordination that only some runtimes can use. Do not add locking mechanisms that assume a single runtime. Do not build coordination features that bypass the file system.

### 5. Every convention element is a replaceable concept

inbox/, outbox/, memory/, eval/ are not implementations. They are concepts with a zero-dependency file-based default. Each can be replaced by a different implementation without changing the convention or any other agent.

- inbox/ (receiving work) can become a Notion task list, Linear issues, or a Slack channel.
- outbox/ (producing results) can become GitHub issues, email, or an API call.
- memory/ (persistent context) can become a vector database or a memory MCP server.
- eval/ (quality measurement) can become Braintrust, LangSmith, or a programmatic test suite.

To replace a default: install the appropriate MCP server or plugin on the agent, and update AGENTS.md to reference the new source ("check the Notion inbox" instead of "check inbox/"). The directory is no longer needed. Nothing else changes.

This is the same principle behind Pi's deliberate omission of MCP from core: by not baking in a specific tool protocol, Pi leaves integrators free to choose their own. By not baking in a specific inbox implementation, the convention leaves teams free to use whatever task source fits their workflow.

**Do:** Treat convention directories as concepts, not sacred paths. Design features so they work with any implementation of the concept, not just the file-based default.

**Do not:** Hard-code inbox/ or outbox/ paths in ways that prevent replacement. Do not add features that only work with the file-based defaults.

### 6. Additive complexity only

The smallest valid agent is a directory containing AGENTS.md. Everything else -- inbox/, memory/, outbox/, eval/, skills/, mcp.json -- is added only when needed. No directory is required upfront. No feature imposes cost until the moment it provides value.

This mirrors Pi's design exactly. The smallest valid Pi workspace is a single AGENTS.md file. Capabilities are added incrementally by creating directories and files: skills/, .pi/extensions/, .pi/prompts/. Nothing is required upfront.

The progression:
- AGENTS.md alone: a stateless agent invoked manually.
- Add inbox/: the agent can receive work from others.
- Add schedule entries in team.yaml: the agent runs on a schedule (via the autonomous runtime).
- Add memory/: the agent remembers across invocations.
- Add outbox/: the agent publishes results.
- Add eval/: the agent's quality can be measured and improved.
- Add skills/: the agent gains specialized capabilities.
- Add mcp.json: the agent connects to external tools.

Each addition is independent. An agent can have memory/ without inbox/, or eval/ without outbox/. Capabilities compose; they do not depend on each other.

**Do:** Make every feature optional and independently addable. Test that features work in isolation, not just when the full directory structure is present.

**Do not:** Add features that require other features as prerequisites. Do not create a "minimum viable agent" beyond AGENTS.md alone.

### 7. Intelligence lives in agents, not infrastructure

The autonomous runtime does not understand what agents do. It does not manage agent state. It does not route messages. It does not inject prompts beyond "you have new tasks" or "start your shift." It watches for files and fires crons. That is all.

This is the core argument against orchestrators: a smart center must model every agent's domain and becomes a single point of failure for judgment. A runtime that makes no decisions can make no bad decisions. More importantly, a runtime that makes no decisions does not become a bottleneck when models improve. Push intelligence into the agents -- the model plus its directory -- and a better model makes every agent better at once, with nothing in the middle gating it.

The same principle applies to all runtimes, not just the autonomous one. The CLI does not interpret tasks. The PI skill does not route work. The web dashboard does not decide which agent should handle a request. Every runtime is a trigger mechanism, not a brain.

**Do:** Keep runtimes minimal. Limit them to detecting triggers (file changes, cron matches, user input) and invoking Pi with the agent's working directory.

**Do not:** Add task routing, decomposition, or interpretation to any runtime. Do not make the autonomous runtime smarter than other runtimes. Do not create features that require runtime intelligence.

---

## Naming and Concepts

The project contains three distinct concepts that must be named clearly to avoid confusion:

**Convention** -- the directory structure and file semantics that define what an agent team is. Pure specification. No code required.

**Operations** -- the functions that manipulate teams: init, add agent, send task, query status. These are runtime-independent. They read and write files according to the convention. They are usable by any control surface: CLI, skill, web dashboard, programmatic API. Currently in `src/commands.ts`.

**Autonomous runtime** -- the long-running process that makes a team self-operating. Watches inboxes, fires crons, spawns Pi. This is one specific runtime among many possible runtimes. Currently in `src/runtime.ts`, `src/watcher.ts`, `src/cron.ts`, `src/invoke.ts`.

The word "harness" should be avoided when referring to the autonomous runtime. "Harness" implies the team must be harnessed to run, but the team exists independently of any runtime. The autonomous runtime is an extension that adds self-running capability, not a harness that the team requires. Use "autonomous runtime" or just "runtime" when referring to this component.

The CLI (`pi-team`) is a control surface, not a runtime. It provides a human-friendly interface to operations (init, add, send, status) and can start the autonomous runtime (`pi-team start`), but it is not the runtime itself.

---

## Separation of Concerns

### What belongs in the convention (CONVENTION.md)

- Directory structure semantics (what agents/, inbox/, outbox/, memory/, eval/ mean)
- File naming conventions (timestamp_slug format for inbox items)
- AGENTS.md structure and purpose
- The concept of replaceable defaults
- Additive complexity rules

### What belongs in runtime-specific configuration (team.yaml)

- Schedule entries (cron expressions, prompts)
- Model and thinking level defaults
- Concurrency limits
- Pi binary path

### What belongs in the autonomous runtime (src/runtime.ts and related)

- Inbox file watching
- Cron scheduling and firing
- Pi process spawning and lifecycle management
- Invocation queuing and concurrency control
- Event emission for observability

### What belongs in operations (src/commands.ts)

- Team initialization (creating directory structure)
- Agent creation (copying templates, setting up directories)
- Task sending (writing files to inbox/)
- Status querying (reading directory state)

### What does NOT belong anywhere in this project

- Task routing or decomposition (that is the agent's job, via its AGENTS.md)
- Collaboration protocols (users choose their own: Notion, Slack, shared files)
- Agent quality logic (the HR agent pattern uses the same primitives as any agent)
- Dashboard UI (any runtime can build its own; the file system is the universal dashboard)

---

## Coupling Audit

The following coupling points in the current implementation should be monitored:

**team.yaml as a coupling point.** team.yaml currently serves two purposes: team identity (name) and autonomous runtime configuration (schedules, model defaults, concurrency). This is acceptable because team.yaml is explicitly runtime configuration. But if convention-level information starts accumulating in team.yaml -- agent metadata, relationships, capabilities -- that would violate the principle that agent identity lives entirely in the agent directory.

**inbox/ path hard-coded in the autonomous runtime.** The watcher watches inbox/ specifically. This is fine as long as the autonomous runtime is understood as the file-based-inbox runtime. An agent that replaces inbox/ with a Notion task list would not use the autonomous runtime's watcher -- it would use a different trigger mechanism (Notion webhook, polling MCP server). The autonomous runtime does not need to support every inbox implementation; it supports the file-based default.

**"you have new tasks" prompt.** The autonomous runtime sends this fixed prompt when inbox items are detected. This prompt becomes part of the implicit contract between the runtime and the agent's AGENTS.md (which must include task processing instructions that respond to this prompt). This is acceptable minimal coupling -- the prompt is short, stable, and self-explanatory. But it should not grow. The runtime should not inject complex prompts, context, or instructions.

**Session directory inside the agent directory.** The autonomous runtime creates .session/ inside the agent directory for Pi session persistence. This is correct: session state is agent state and belongs in the agent directory. Other runtimes that want session continuity would use the same location.

---

## Development Guidelines

When adding features to this project, apply these tests:

1. **Convention or runtime?** If the feature defines what something means, it belongs in the convention. If it defines when or how something happens, it belongs in a runtime. If it is unclear, it probably belongs in neither -- it might belong in the agent's AGENTS.md.

2. **Does it work without the autonomous runtime?** Every convention feature must be usable by a human with nothing but `mkdir`, `echo`, and `pi -p`. If it requires the autonomous runtime to be running, it is a runtime feature, not a convention feature.

3. **Does it work without Pi?** The convention should be agent-runtime-agnostic. Pi is the natural fit, but the directory structure and file semantics should make sense to any agent that can read files and follow instructions. Do not add convention elements that depend on Pi-specific features.

4. **Is it additive?** Can an existing agent ignore this feature entirely and continue working? If adding a feature requires modifying existing agents, it is not additive.

5. **Is it replaceable?** If the feature provides a default implementation of a concept, can the default be swapped out without changing the convention or other agents? If not, the feature is too tightly coupled to its implementation.

6. **Does it keep intelligence out of infrastructure?** If the feature requires the runtime to understand what agents do, it violates the core principle. Runtimes trigger. Agents think.
