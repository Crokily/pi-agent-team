import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init, addAgent, sendTask, countInbox } from '../src/commands.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pi-cmd-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('init', () => {
  it('creates team.yaml, agents/, and shared/workspace/', () => {
    const result = init(tmp);
    assert.equal(result.rootDir, tmp);
    assert.ok(existsSync(join(tmp, 'team.yaml')));
    assert.ok(existsSync(join(tmp, 'agents')));
    assert.ok(existsSync(join(tmp, 'shared', 'workspace')));
  });

  it('throws if team.yaml already exists', () => {
    writeFileSync(join(tmp, 'team.yaml'), 'name: x\n');
    assert.throws(() => init(tmp), /already exists/);
  });
});

describe('addAgent', () => {
  beforeEach(() => {
    init(tmp);
  });

  it('creates agent directory with AGENTS.md from template', () => {
    const result = addAgent('writer', tmp);
    assert.equal(result.name, 'writer');
    assert.ok(existsSync(join(result.dir, 'AGENTS.md')));
    assert.ok(existsSync(join(result.dir, 'inbox')));
  });

  it('throws for empty name', () => {
    assert.throws(() => addAgent('', tmp), /Agent name is required/);
  });

  it('throws for duplicate agent', () => {
    addAgent('dup', tmp);
    assert.throws(() => addAgent('dup', tmp), /already exists/);
  });
});

describe('sendTask', () => {
  beforeEach(() => {
    init(tmp);
    addAgent('bob', tmp);
  });

  it('creates file in inbox/ with correct naming pattern', () => {
    const result = sendTask('bob', 'hello world', tmp);
    assert.equal(result.agent, 'bob');
    assert.ok(existsSync(result.path));
    assert.match(result.filename, /^\d+_hello-world_[0-9a-f]{4}\.md$/);
  });

  it('produces different filenames for same-millisecond calls', () => {
    const a = sendTask('bob', 'same msg', tmp);
    const b = sendTask('bob', 'same msg', tmp);
    assert.notEqual(a.filename, b.filename);
  });
});

describe('countInbox', () => {
  it('counts non-hidden files', () => {
    const dir = join(tmp, 'inbox');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'task1.md'), 'a');
    writeFileSync(join(dir, 'task2.md'), 'b');
    writeFileSync(join(dir, '.hidden'), 'c');
    assert.equal(countInbox(dir), 2);
  });

  it('returns 0 for non-existent directory', () => {
    assert.equal(countInbox(join(tmp, 'nope')), 0);
  });
});
