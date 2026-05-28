#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { discoverAgents, readTeamConfig } from './config.js';
import { registerScheduledTasks, stopScheduledTasks } from './cron.js';
import { InvocationManager } from './invoke.js';
import { logger } from './logger.js';
import { InboxWatcher } from './watcher.js';
import type { Agent, RegisteredCron, TeamConfig } from './types.js';

const rootDir = process.cwd();
let config: TeamConfig;
let invocations: InvocationManager;
let agents: Agent[] = [];
let watchers = new Map<string, InboxWatcher>();
let scheduled: RegisteredCron[] = [];
let reloading = false;
let shuttingDown = false;
const keepAlive = setInterval(() => {
  if (!shuttingDown && agents.some((agent) => !existsSync(agent.dir))) void reload(false);
}, 5000);
async function main(): Promise<void> {
  config = readTeamConfig(rootDir);
  invocations = new InvocationManager(config.maxConcurrentPi);
  await reload(true);
  process.on('SIGHUP', () => {
    void reload(false).catch((err) => logger.error(`reload failed: ${message(err)}`));
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void shutdown(signal));
}
async function reload(initial: boolean): Promise<void> {
  if (reloading || shuttingDown) return;
  reloading = true;
  try {
    const nextConfig = readTeamConfig(rootDir);
    const nextAgents = discoverAgents(rootDir);
    const oldAgents = new Set(watchers.keys());
    const oldTasks = new Set(scheduled.map((task) => task.key));
    stopAll();
    config = nextConfig;
    invocations.setLimit(config.maxConcurrentPi);
    agents = nextAgents;
    watchers = new Map();
    for (const agent of agents) {
      const watcher = new InboxWatcher(agent, config, invocations);
      watchers.set(agent.name, watcher);
      watcher.start();
    }
    scheduled = registerScheduledTasks(agents, config, invocations);

    if (!initial) logDiff('agent', oldAgents, new Set(watchers.keys()));
    if (!initial) logDiff('scheduled task', oldTasks, new Set(scheduled.map((task) => task.key)));
    logger.info(`Team ${config.name}: ${agents.length} agents discovered, ${scheduled.length} scheduled tasks registered`);
  } finally {
    reloading = false;
  }
}
function stopAll(): void {
  for (const watcher of watchers.values()) watcher.stop();
  stopScheduledTasks(scheduled);
}
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`received ${signal}, shutting down`);
  clearInterval(keepAlive);
  stopAll();
  await invocations.shutdown();
  process.exit(0);
}
function logDiff(label: string, before: Set<string>, after: Set<string>): void {
  for (const item of after) if (!before.has(item)) logger.info(`added ${label}: ${item}`);
  for (const item of before) if (!after.has(item)) logger.warn(`removed ${label}: ${item}`);
}
function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
main().catch((err) => {
  logger.error(message(err));
  process.exit(1);
});
