import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { discoverTeam, readRuntimeConfig } from './config.js';
import { sendTask as doSendTask, countInbox } from './commands.js';
import { registerScheduledTasks, stopScheduledTasks } from './cron.js';
import { TeamEmitter } from './events.js';
import { InvocationManager } from './invoke.js';
import { errorMessage, logger } from './logger.js';
import { InboxWatcher } from './watcher.js';
import type {
  Agent,
  RegisteredCron,
  RuntimeAgent,
  RuntimeAgentStatus,
  RuntimeConfig,
  RuntimeTeamStatus,
  SendTaskResult,
  Team,
} from './types.js';

export { TeamEmitter } from './events.js';

export interface TeamHandle {
  reload(): Promise<void>;
  stop(): Promise<void>;
  agents(): RuntimeAgent[];
  team(): Team;
  config(): RuntimeConfig;
  sendTask(agentName: string, message: string): SendTaskResult;
  agentStatus(agentName: string): RuntimeAgentStatus | undefined;
  status(): RuntimeTeamStatus;
  events: TeamEmitter;
}

export async function startTeam(rootDir: string): Promise<TeamHandle> {
  const events = new TeamEmitter();
  let team = discoverTeam(rootDir);
  let config = readRuntimeConfig(rootDir);
  const invocations = new InvocationManager(config.maxConcurrentPi, events);

  events.on('invocation:start', (e) => logger.info(e.agent, `starting ${e.kind} pi #${e.id}`));
  events.on('invocation:end', (e) => {
    const exit = e.signal ? `signal ${e.signal}` : `code ${e.code}`;
    if (e.ok) logger.info(e.agent, `${e.kind} pi #${e.id} exited with ${exit}`);
    else logger.warn(e.agent, `${e.kind} pi #${e.id} exited with ${exit}`);
  });
  events.on('cron:fired', (e) => logger.info(e.agent, `cron fired: ${e.task}`));
  events.on('task:received', (e) => logger.info(e.agent, `new tasks in inbox`));
  events.on('error', (e) => logger.error(e.agent ?? 'team', e.message));
  let agents: RuntimeAgent[] = [];
  let watchers = new Map<string, InboxWatcher>();
  let scheduled: RegisteredCron[] = [];
  let reloading = false;
  let stopped = false;

  const keepAlive = setInterval(() => {
    if (!stopped && agents.some((a) => !existsSync(a.dir))) {
      void doReload().catch((err) => {
        events.emit('error', { message: `reload failed: ${errorMessage(err)}` });
      });
    }
  }, 5000);

  async function doReload(initial = false): Promise<void> {
    if (reloading || stopped) return;
    reloading = true;
    try {
      const nextTeam = discoverTeam(rootDir);
      const nextConfig = readRuntimeConfig(rootDir);
      const nextAgents = nextTeam.agents.map(toRuntimeAgent);
      const oldAgents = new Set(watchers.keys());
      const oldTasks = new Set(scheduled.map((t) => t.key));
      stopAll();
      team = nextTeam;
      config = nextConfig;
      invocations.setLimit(config.maxConcurrentPi);
      agents = nextAgents;
      watchers = new Map();
      for (const agent of agents) {
        const watcher = new InboxWatcher(agent, config, invocations, events);
        watchers.set(agent.name, watcher);
        watcher.start();
      }
      scheduled = registerScheduledTasks(agents, config, invocations, events);
      const newAgentNames = new Set(watchers.keys());
      const newTaskKeys = new Set(scheduled.map((t) => t.key));
      const { added, removed } = setDiff(oldAgents, newAgentNames);
      if (!initial) {
        for (const a of added) logger.info(`added agent: ${a}`);
        for (const r of removed) logger.warn(`removed agent: ${r}`);
        const taskDiff = setDiff(oldTasks, newTaskKeys);
        for (const a of taskDiff.added) logger.info(`added scheduled task: ${a}`);
        for (const r of taskDiff.removed) logger.warn(`removed scheduled task: ${r}`);
      }
      logger.info(`Team ${team.name}: ${agents.length} agents, ${scheduled.length} scheduled tasks`);
      events.emit('reload', { added, removed });
    } finally {
      reloading = false;
    }
  }

  function stopAll(): void {
    for (const w of watchers.values()) w.stop();
    stopScheduledTasks(scheduled);
  }

  function buildAgentStatus(agent: RuntimeAgent): RuntimeAgentStatus {
    return {
      name: agent.name,
      pending: countInbox(agent.inboxDir),
      busy: invocations.isRunning(agent.name) || (watchers.get(agent.name)?.isBusy() ?? false),
      schedules: config.agentSchedules.get(agent.name) ?? [],
    };
  }

  await doReload(true);

  return {
    reload: () => doReload(),
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(keepAlive);
      stopAll();
      await invocations.shutdown();
    },
    agents: () => [...agents],
    team: () => team,
    config: () => config,
    sendTask(agentName: string, message: string): SendTaskResult {
      return doSendTask(agentName, message, team.rootDir);
    },
    agentStatus(agentName: string): RuntimeAgentStatus | undefined {
      const agent = agents.find((a) => a.name === agentName);
      if (!agent) return undefined;
      return buildAgentStatus(agent);
    },
    status(): RuntimeTeamStatus {
      return { name: team.name, agents: agents.map(buildAgentStatus) };
    },
    events,
  };
}

function toRuntimeAgent(agent: Agent): RuntimeAgent {
  return {
    ...agent,
    inboxDir: join(agent.dir, 'inbox'),
    sessionDir: join(agent.dir, '.session'),
    logsDir: join(agent.dir, '.logs'),
  };
}

function setDiff(before: Set<string>, after: Set<string>): { added: string[]; removed: string[] } {
  const added = [...after].filter((a) => !before.has(a));
  const removed = [...before].filter((a) => !after.has(a));
  return { added, removed };
}
