import { EventEmitter } from 'node:events';
import type { TeamEventMap } from './types.js';

type EventName = keyof TeamEventMap;

export class TeamEmitter {
  private ee = new EventEmitter();

  emit<K extends EventName>(event: K, data: TeamEventMap[K]): void {
    this.ee.emit(event, data);
  }

  on<K extends EventName>(event: K, fn: (data: TeamEventMap[K]) => void): this {
    this.ee.on(event, fn as (...args: unknown[]) => void);
    return this;
  }

  off<K extends EventName>(event: K, fn: (data: TeamEventMap[K]) => void): this {
    this.ee.off(event, fn as (...args: unknown[]) => void);
    return this;
  }
}
