export interface ScheduleEntry {
  name: string;
  cron: string;
  prompt?: string;
}

export interface Agent {
  name: string;
  dir: string;
}

export interface Team {
  rootDir: string;
  name: string;
  agents: Agent[];
}

export interface RuntimeAgent extends Agent {
  inboxDir: string;
  sessionDir: string;
  logsDir: string;
}

export interface RuntimeConfig {
  defaults: { model?: string; thinking?: string };
  maxConcurrentPi: number;
  piBin: string;
  agentSchedules: Map<string, ScheduleEntry[]>;
}

export type InvocationKind = 'inbox' | 'scheduled';
export interface InvocationRequest {
  agent: RuntimeAgent;
  config: RuntimeConfig;
  prompt: string;
  kind: InvocationKind;
  taskName?: string;
}
export interface InvocationResult {
  ok: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}
export interface RegisteredCron { key: string; stop: () => void }

export interface InitResult {
  rootDir: string;
  name: string;
}

export interface AddAgentResult {
  name: string;
  dir: string;
}

export interface SendTaskResult {
  agent: string;
  filename: string;
  path: string;
}

export interface AgentStatus {
  name: string;
  pending: number;
}

export interface RuntimeAgentStatus extends AgentStatus {
  busy: boolean;
  schedules: ScheduleEntry[];
}

export interface TeamStatus {
  name: string;
  agents: AgentStatus[];
}

export interface RuntimeTeamStatus {
  name: string;
  agents: RuntimeAgentStatus[];
}

export interface TeamEventMap {
  'invocation:start': { agent: string; kind: InvocationKind; id: number };
  'invocation:end': { agent: string; kind: InvocationKind; id: number; ok: boolean; code: number | null; signal: NodeJS.Signals | null };
  'cron:fired': { agent: string; task: string };
  'task:received': { agent: string };
  'reload': { added: string[]; removed: string[] };
  'error': { agent?: string; message: string };
}
