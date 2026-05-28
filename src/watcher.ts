import { existsSync, watch, type FSWatcher } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { logger } from './logger.js';
import { InvocationManager } from './invoke.js';
import type { Agent, TeamConfig } from './types.js';
const debounceMs = 250;
const pollMs = 5000;
export class InboxWatcher {
  private watcher?: FSWatcher;
  private debounce?: NodeJS.Timeout;
  private poll?: NodeJS.Timeout;
  private busy = false;
  private checking = false;
  private stopped = false;

  constructor(private agent: Agent, private config: TeamConfig, private invocations: InvocationManager) {}
  start(): void {
    if (!existsSync(this.agent.inboxDir)) {
      logger.warn(this.agent.name, 'inbox missing; watcher not started');
      return;
    }
    this.startFsWatch();
    this.poll = setInterval(() => void this.check(), pollMs);
    logger.info(this.agent.name, 'watching inbox');
    void this.check();
  }
  stop(): void {
    this.stopped = true;
    if (this.debounce) clearTimeout(this.debounce);
    if (this.poll) clearInterval(this.poll);
    this.watcher?.close();
  }
  private startFsWatch(): void {
    try {
      this.watcher = watch(this.agent.inboxDir, (_event, filename) => {
        if (this.stopped) return;
        const name = typeof filename === 'string' ? filename : '';
        if (name === '.processed') return;
        this.scheduleCheck();
      });
      this.watcher.on('error', (err) => {
        if (!this.stopped) logger.warn(this.agent.name, `fs.watch failed: ${message(err)}`);
      });
    } catch (err) {
      if (!this.stopped) {
        logger.warn(this.agent.name, `fs.watch unavailable; polling inbox (${message(err)})`);
      }
    }
  }
  private scheduleCheck(): void {
    if (this.stopped || this.busy) return;
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.check(), debounceMs);
  }
  private async check(): Promise<void> {
    if (this.stopped || this.busy || this.checking) return;
    this.checking = true;
    let hasItems = false;
    try {
      if (!existsSync(this.agent.dir)) {
        logger.warn(this.agent.name, 'agent directory removed; stopping inbox watcher');
        this.stop();
        return;
      }
      hasItems = await this.hasInboxItems();
      if (hasItems) this.busy = true;
    } finally {
      this.checking = false;
    }
    if (!hasItems) return;
    await this.invocations.enqueue({ agent: this.agent, config: this.config, kind: 'inbox', prompt: 'you have new tasks' });
    this.busy = false;
    setTimeout(() => void this.check(), 0);
  }
  private async hasInboxItems(): Promise<boolean> {
    try {
      const entries = await readdir(this.agent.inboxDir, { withFileTypes: true });
      return entries.some((entry) => entry.name !== '.processed' && entry.name !== '.gitkeep');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn(this.agent.name, 'inbox removed; stopping inbox watcher');
        this.stop();
      } else {
        logger.error(this.agent.name, `failed to read inbox: ${message(err)}`);
      }
      return false;
    }
  }
}
function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
