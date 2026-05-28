export interface ScheduleEntry {
  name: string;
  cron: string;
  prompt?: string;
}
export interface TeamConfig {
  rootDir: string;
  name: string;
  defaults: { model?: string; thinking?: string };
  maxConcurrentPi: number;
  piBin: string;
  agentSchedules: Map<string, ScheduleEntry[]>;
}
export interface Agent {
  name: string;
  dir: string;
  inboxDir: string;
  sessionDir: string;
  logsDir: string;
}
export type InvocationKind = 'inbox' | 'scheduled';
export interface InvocationRequest {
  agent: Agent;
  config: TeamConfig;
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

// --- Operation results (consumed by any control surface) ---

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
  busy: boolean;
  schedules: ScheduleEntry[];
}

export interface TeamStatus {
  name: string;
  agents: AgentStatus[];
}

// --- Events (emitted by runtime, consumed by any surface) ---

export interface TeamEventMap {
  'invocation:start': { agent: string; kind: InvocationKind; id: number };
  'invocation:end': { agent: string; kind: InvocationKind; id: number; ok: boolean; code: number | null; signal: NodeJS.Signals | null };
  'cron:fired': { agent: string; task: string };
  'task:received': { agent: string };
  'reload': { added: string[]; removed: string[] };
  'error': { agent?: string; message: string };
}
