import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Agent, RuntimeConfig, ScheduleEntry, Team } from './types.js';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as { load: (input: string) => unknown };

export function discoverTeam(rootDir = process.cwd()): Team {
  const data = readTeamYaml(rootDir);
  const name = optionalString(data.name);
  if (!name) throw new Error('team.yaml must define a non-empty name');
  return { rootDir, name, agents: discoverAgents(rootDir) };
}

export function readRuntimeConfig(rootDir = process.cwd()): RuntimeConfig {
  const data = readTeamYaml(rootDir);
  const defaults = record(data.defaults ?? {}, 'team.yaml defaults must be an object');
  return {
    defaults: { model: optionalString(defaults.model), thinking: optionalString(defaults.thinking) },
    maxConcurrentPi: positiveInt(data.maxConcurrentPi) ?? positiveInt(process.env.PI_TEAM_MAX_CONCURRENT) ?? 5,
    piBin: optionalString(data.piBin) ?? process.env.PI_BIN ?? 'pi',
    agentSchedules: parseAgentSchedules(data.agents),
  };
}

function parseAgentSchedules(agents: unknown): Map<string, ScheduleEntry[]> {
  const result = new Map<string, ScheduleEntry[]>();
  if (!agents || typeof agents !== 'object' || Array.isArray(agents)) return result;
  for (const [agentName, agentConfig] of Object.entries(agents as Record<string, unknown>)) {
    const cfg = agentConfig && typeof agentConfig === 'object' && !Array.isArray(agentConfig)
      ? agentConfig as Record<string, unknown> : null;
    if (!cfg?.schedule || !Array.isArray(cfg.schedule)) continue;
    const entries: ScheduleEntry[] = [];
    for (const item of cfg.schedule) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const entry = item as Record<string, unknown>;
      const entryName = optionalString(entry.name);
      const cron = optionalString(entry.cron);
      if (!entryName || !cron) continue;
      entries.push({ name: entryName, cron, prompt: optionalString(entry.prompt) });
    }
    if (entries.length > 0) result.set(agentName, entries);
  }
  return result;
}
export function discoverAgents(rootDir: string): Agent[] {
  const agentsDir = join(rootDir, 'agents');
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(agentsDir, entry.name);
      return {
        name: entry.name,
        dir,
      };
    })
    .filter((agent) => existsSync(join(agent.dir, 'AGENTS.md')))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readTeamYaml(rootDir: string): Record<string, unknown> {
  const configPath = join(rootDir, 'team.yaml');
  if (!existsSync(configPath)) throw new Error(`Missing team.yaml in ${rootDir}`);
  const raw = yaml.load(readFileSync(configPath, 'utf8'));
  return record(raw, 'team.yaml must contain a YAML object');
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(message);
}
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function positiveInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
