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
