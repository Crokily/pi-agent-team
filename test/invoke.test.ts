import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InvocationManager } from '../src/invoke.js';
import { TeamEmitter } from '../src/events.js';
import type { Agent, TeamConfig, InvocationRequest } from '../src/types.js';

let tmp: string;

function makeAgent(name: string): Agent {
  const dir = join(tmp, 'agents', name);
  mkdirSync(join(dir, 'inbox'), { recursive: true });
  return {
    name,
    dir,
    inboxDir: join(dir, 'inbox'),
    sessionDir: join(dir, '.session'),
    logsDir: join(dir, '.logs'),
  };
}

function makeConfig(sleepSec: number): TeamConfig {
  const bin = join(tmp, `stub-${sleepSec}.sh`);
  writeFileSync(bin, `#!/bin/sh\ntrap 'exit 0' TERM\nsleep ${sleepSec} &\nwait\n`);
  chmodSync(bin, 0o755);
  return {
    rootDir: tmp,
    name: 'test-team',
    defaults: {},
    maxConcurrentPi: 5,
    piBin: bin,
    agentSchedules: new Map(),
  };
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pi-inv-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('InvocationManager', () => {
  it('respects global concurrency limit', async () => {
    const events = new TeamEmitter();
    const config = makeConfig(0.3);
    const mgr = new InvocationManager(2, events);
    const a1 = makeAgent('a1');
    const a2 = makeAgent('a2');
    const a3 = makeAgent('a3');

    let peakActive = 0;
    let currentActive = 0;

    events.on('invocation:start', () => {
      currentActive++;
      if (currentActive > peakActive) peakActive = currentActive;
    });
    events.on('invocation:end', () => { currentActive--; });

    const req = (agent: Agent): InvocationRequest => ({
      agent,
      config,
      prompt: 'test',
      kind: 'inbox',
    });

    const results = await Promise.all([
      mgr.enqueue(req(a1)),
      mgr.enqueue(req(a2)),
      mgr.enqueue(req(a3)),
    ]);

    assert.equal(peakActive <= 2, true, `peak active was ${peakActive}, expected <= 2`);
    assert.equal(results.length, 3);
  });

  it('serializes per-agent: second request waits for first to finish', async () => {
    const events = new TeamEmitter();
    const config = makeConfig(0.3);
    const mgr = new InvocationManager(5, events);

    const alice = makeAgent('alice');
    const bob = makeAgent('bob');

    const timeline: string[] = [];

    events.on('invocation:start', (d) => { timeline.push(`start:${d.agent}:${d.id}`); });
    events.on('invocation:end', (d) => { timeline.push(`end:${d.agent}:${d.id}`); });

    const req = (agent: Agent): InvocationRequest => ({
      agent,
      config,
      prompt: 'test',
      kind: 'inbox',
    });

    const [r1, r2, r3] = await Promise.all([
      mgr.enqueue(req(alice)),
      mgr.enqueue(req(alice)),
      mgr.enqueue(req(bob)),
    ]);

    const aliceStarts = timeline.filter((e) => e.startsWith('start:alice:'));
    const aliceEnds = timeline.filter((e) => e.startsWith('end:alice:'));
    assert.equal(aliceStarts.length, 2);
    assert.equal(aliceEnds.length, 2);

    const firstAliceEndIdx = timeline.indexOf(aliceEnds[0]);
    const secondAliceStartIdx = timeline.indexOf(aliceStarts[1]);
    assert.ok(
      firstAliceEndIdx < secondAliceStartIdx,
      `alice's second invocation must start after the first ends. timeline: ${timeline.join(', ')}`,
    );

    const bobStart = timeline.find((e) => e.startsWith('start:bob:'));
    assert.ok(bobStart, 'bob should have started');
    const bobStartIdx = timeline.indexOf(bobStart!);
    const firstAliceStartIdx = timeline.indexOf(aliceStarts[0]);
    assert.ok(
      bobStartIdx <= firstAliceEndIdx,
      `bob should start concurrently with alice's first run. timeline: ${timeline.join(', ')}`,
    );
  });

  it('shutdown resolves queued requests as cancelled', async () => {
    const events = new TeamEmitter();
    const config = makeConfig(60);
    const mgr = new InvocationManager(1, events);
    const a1 = makeAgent('s1');
    const a2 = makeAgent('s2');

    let started = false;
    events.on('invocation:start', () => { started = true; });

    const req = (agent: Agent): InvocationRequest => ({
      agent,
      config,
      prompt: 'test',
      kind: 'inbox',
    });

    const p1 = mgr.enqueue(req(a1));
    const p2 = mgr.enqueue(req(a2));

    while (!started) await new Promise((r) => setTimeout(r, 10));
    await mgr.shutdown();

    const r2 = await p2;
    assert.equal(r2.ok, false);
    assert.ok(r2.stderr.includes('shutting down'));
  });
});
