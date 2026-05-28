import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { logger } from './logger.js';
import type { InvocationRequest, InvocationResult } from './types.js';
interface QueuedRequest extends InvocationRequest {
  resolve: (result: InvocationResult) => void;
}
const tailLimit = 4000;
let nextId = 1;
export class InvocationManager {
  private active = new Map<number, ChildProcess>();
  private queue: QueuedRequest[] = [];
  private waiters: Array<() => void> = [];
  private stopping = false;
  constructor(private limit: number) {}
  setLimit(limit: number): void {
    this.limit = limit;
    this.drain();
  }
  enqueue(request: InvocationRequest): Promise<InvocationResult> {
    return new Promise((resolve) => {
      if (this.stopping) {
        resolve(cancelledResult('harness is shutting down'));
        return;
      }
      this.queue.push({ ...request, resolve });
      if (this.active.size >= this.limit) {
        logger.debug(request.agent.name, `queued ${request.kind} pi invocation`);
      }
      this.drain();
    });
  }
  async shutdown(): Promise<void> {
    this.stopping = true;
    for (const request of this.queue.splice(0)) {
      request.resolve(cancelledResult('harness is shutting down'));
    }
    if (this.active.size === 0) return;

    logger.info(`stopping ${this.active.size} running pi process(es)`);
    this.active.forEach((proc) => killProcess(proc, 'SIGTERM'));
    const forceTimer = setTimeout(() => {
      if (this.active.size > 0) {
        logger.warn(`force killing ${this.active.size} pi process(es)`);
        this.active.forEach((proc) => killProcess(proc, 'SIGKILL'));
      }
    }, 5000);

    await Promise.race([this.waitForEmpty(), delay(10000)]);
    clearTimeout(forceTimer);
    if (this.active.size > 0) this.active.forEach((proc) => killProcess(proc, 'SIGKILL'));
  }
  private drain(): void {
    while (!this.stopping && this.active.size < this.limit && this.queue.length > 0) {
      this.start(this.queue.shift()!);
    }
  }
  private start(request: QueuedRequest): void {
    const id = nextId++;
    const { agent, config } = request;
    mkdirSync(agent.sessionDir, { recursive: true });
    mkdirSync(agent.logsDir, { recursive: true });
    const args = ['--session-dir', agent.sessionDir, '--continue'];
    if (config.defaults.model) args.push('--model', config.defaults.model);
    if (config.defaults.thinking) args.push('--thinking', config.defaults.thinking);
    args.push('-p', request.prompt);

    const logPath = join(agent.logsDir, `${logStamp()}-${request.kind}-${id}.log`);
    const logStream = createWriteStream(logPath, { flags: 'a' });
    const { bin, args: spawnArgs } = resolvePiSpawn(config.piBin, args);
    logger.info(agent.name, `starting ${request.kind} pi #${id}`);
    logStream.write(`[${new Date().toISOString()}] ${bin} ${spawnArgs.join(' ')}\n\n`);
    const proc = spawn(bin, spawnArgs, {
      cwd: agent.dir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.active.set(id, proc);
    let stdout = '';
    let stderr = '';
    let settled = false;

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout = cap(stdout, chunk);
      logStream.write(chunk);
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr = cap(stderr, chunk);
      logStream.write(chunk);
    });
    const finish = (code: number | null, signal: NodeJS.Signals | null, err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) stderr = cap(stderr, Buffer.from(err.message));
      logStream.end(`\n[${new Date().toISOString()}] exit code=${code} signal=${signal}\n`);
      this.active.delete(id);

      const ok = !err && code === 0;
      const exitText = signal ? `signal ${signal}` : `code ${code}`;
      if (ok) logger.info(agent.name, `${request.kind} pi #${id} exited with ${exitText}`);
      else logger.warn(agent.name, `${request.kind} pi #${id} exited with ${exitText}`);
      request.resolve({ ok, code, signal, stdout, stderr });
      this.notifyWaiters();
      this.drain();
    };
    proc.on('error', (err) => finish(null, null, err));
    proc.on('close', (code, signal) => finish(code, signal));
  }
  private waitForEmpty(): Promise<void> {
    if (this.active.size === 0) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }
  private notifyWaiters(): void {
    if (this.active.size > 0) return;
    for (const resolve of this.waiters.splice(0)) resolve();
  }
}
function resolvePiSpawn(piBin: string, args: string[]): { bin: string; args: string[] } {
  if (process.platform !== 'win32') return { bin: piBin, args };
  try {
    const shimPath = execSync(`where ${piBin}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split(/\r?\n/)
      .find((line) => line.trim().endsWith('.cmd'));
    if (!shimPath) return { bin: piBin, args };
    const content = readFileSync(shimPath.trim(), 'utf8');
    const jsMatch = content.match(/"([^"]+\.js)"/);
    if (jsMatch) {
      const jsPath = pathResolve(dirname(shimPath.trim()), jsMatch[1]);
      if (existsSync(jsPath)) return { bin: process.execPath, args: [jsPath, ...args] };
    }
  } catch {
    // Fall through to the configured binary.
  }
  return { bin: piBin, args };
}
function cap(current: string, chunk: Buffer): string {
  return (current + chunk.toString('utf8')).slice(-tailLimit);
}
function cancelledResult(stderr: string): InvocationResult {
  return { ok: false, code: null, signal: null, stdout: '', stderr };
}
function killProcess(proc: ChildProcess, signal: NodeJS.Signals): void {
  if (proc.killed) return;
  if (process.platform === 'win32') proc.kill();
  else proc.kill(signal);
}
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function logStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
