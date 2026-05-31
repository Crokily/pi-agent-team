import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverAgents, readTeamConfig } from './config.js';
import type { AddAgentResult, InitResult, SendTaskResult, TeamStatus } from './types.js';

export function init(dir?: string): InitResult {
  const root = resolve(dir ?? '.');
  if (existsSync(join(root, 'team.yaml'))) {
    throw new Error(`team.yaml already exists in ${root}`);
  }
  mkdirSync(join(root, 'agents'), { recursive: true });
  mkdirSync(join(root, 'shared', 'workspace'), { recursive: true });
  const tpl = templateDir();
  const teamYaml = readFileSync(join(tpl, 'team.yaml'), 'utf8')
    .replace('my-team', basename(root));
  writeFileSync(join(root, 'team.yaml'), teamYaml);
  return { rootDir: root, name: basename(root) };
}

export function addAgent(name: string, rootDir = process.cwd()): AddAgentResult {
  if (!name) throw new Error('Agent name is required');
  if (!existsSync(join(rootDir, 'team.yaml'))) {
    throw new Error(`No team.yaml found in ${rootDir}. Run pi-team init first.`);
  }
  const agentDir = join(rootDir, 'agents', name);
  if (existsSync(agentDir)) throw new Error(`Agent "${name}" already exists`);
  cpSync(join(templateDir(), 'agent'), agentDir, { recursive: true });
  const agentsPath = join(agentDir, 'AGENTS.md');
  const content = readFileSync(agentsPath, 'utf8').replace(/\{\{name\}\}/g, name);
  writeFileSync(agentsPath, content);
  return { name, dir: agentDir };
}

export function sendTask(agentName: string, message: string, rootDir = process.cwd()): SendTaskResult {
  if (!agentName) throw new Error('Agent name is required');
  if (!message) throw new Error('Message is required');
  const inboxDir = join(rootDir, 'agents', agentName, 'inbox');
  if (!existsSync(inboxDir)) {
    throw new Error(`Agent "${agentName}" inbox not found. Does the agent exist?`);
  }
  const ts = Date.now();
  const slug = message.slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'task';
  const filename = `${ts}_${slug}_${randomBytes(2).toString('hex')}.md`;
  const path = join(inboxDir, filename);
  writeFileSync(path, message + '\n');
  return { agent: agentName, filename, path };
}

export function status(rootDir = process.cwd()): TeamStatus {
  const config = readTeamConfig(rootDir);
  const agents = discoverAgents(rootDir);
  return {
    name: config.name,
    agents: agents.map((agent) => ({
      name: agent.name,
      pending: countInbox(agent.inboxDir),
      schedules: config.agentSchedules.get(agent.name) ?? [],
    })),
  };
}

export function countInbox(inboxDir: string): number {
  if (!existsSync(inboxDir)) return 0;
  return readdirSync(inboxDir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .length;
}

function templateDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', 'templates');
}
