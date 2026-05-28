import { existsSync } from 'node:fs';
import { Cron } from 'croner';
import { InvocationManager } from './invoke.js';
import { logger } from './logger.js';
import type { Agent, RegisteredCron, TeamConfig } from './types.js';

export function registerScheduledTasks(
  agents: Agent[],
  config: TeamConfig,
  invocations: InvocationManager,
): RegisteredCron[] {
  const tasks: RegisteredCron[] = [];
  const agentMap = new Map(agents.map((a) => [a.name, a]));

  for (const [agentName, entries] of config.agentSchedules) {
    const agent = agentMap.get(agentName);
    if (!agent) {
      logger.warn(agentName, `schedule defined in team.yaml but agent directory not found`);
      continue;
    }

    for (const entry of entries) {
      if (entry.cron.split(/\s+/).filter(Boolean).length !== 5) {
        logger.error(agent.name, `invalid cron for ${entry.name}: expected 5 fields`);
        continue;
      }

      try {
        const prompt = entry.prompt ?? 'start your shift';
        const job = new Cron(entry.cron, () => {
          if (!existsSync(agent.dir)) {
            logger.warn(agent.name, `agent directory removed; stopping cron ${entry.name}`);
            job.stop();
            return;
          }
          logger.info(agent.name, `cron fired: ${entry.name}`);
          void invocations.enqueue({ agent, config, kind: 'scheduled', taskName: entry.name, prompt });
        });
        tasks.push({ key: `${agent.name}/${entry.name}`, stop: () => job.stop() });
        logger.info(agent.name, `registered cron ${entry.name}: ${entry.cron}`);
      } catch (err) {
        logger.error(agent.name, `invalid cron for ${entry.name}: ${message(err)}`);
      }
    }
  }
  return tasks;
}

export function stopScheduledTasks(tasks: RegisteredCron[]): void {
  for (const task of tasks) task.stop();
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
