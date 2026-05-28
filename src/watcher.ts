import { existsSync, watch, type FSWatcher } from 'node:fs';
import { readdir } from 'node:fs/promises';
import type { TeamEmitter } from './events.js';
import { errorMessage, logger } from './logger.js';
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

  constructor(
    private agent: Agent,
    private config: TeamConfig,
    private invocations: InvocationManager,
    private events: TeamEmitter,
  ) {}

  isBusy(): boolean { return this.busy; }
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
        if (name.startsWith('.')) return;
        this.scheduleCheck();
      });
      this.watcher.on('error', (err) => {
        if (!this.stopped) logger.warn(this.agent.name, `fs.watch failed: ${errorMessage(err)}`);
      });
    } catch (err) {
      if (!this.stopped) {
        logger.warn(this.agent.name, `fs.watch unavailable; polling inbox (${errorMessage(err)})`);
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
      if (hasItems) {
        this.busy = true;
        this.events.emit('task:received', { agent: this.agent.name });
      }
    } finally {
      this.checking = false;
    }
    if (!hasItems) return;
    try {
      await this.invocations.enqueue({ agent: this.agent, config: this.config, kind: 'inbox', prompt: 'you have new tasks' });
    } finally {
      this.busy = false;
    }
    setTimeout(() => void this.check(), 0);
  }
  private async hasInboxItems(): Promise<boolean> {
    try {
      const entries = await readdir(this.agent.inboxDir, { withFileTypes: true });
      return entries.some((entry) => !entry.name.startsWith('.'));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn(this.agent.name, 'inbox removed; stopping inbox watcher');
        this.stop();
      } else {
        logger.error(this.agent.name, `failed to read inbox: ${errorMessage(err)}`);
      }
      return false;
    }
  }
}
