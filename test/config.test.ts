import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readTeamConfig, discoverAgents } from '../src/config.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pi-cfg-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('readTeamConfig', () => {
  it('parses valid team.yaml with name, defaults, agent schedules', () => {
    writeFileSync(join(tmp, 'team.yaml'), [
      'name: acme',
      'defaults:',
      '  model: anthropic/claude-sonnet-4-6',
      '  thinking: high',
      'agents:',
      '  planner:',
      '    schedule:',
      '      - name: daily-plan',
      '        cron: "0 9 * * *"',
      '        prompt: plan the day',
    ].join('\n'));

    const cfg = readTeamConfig(tmp);
    assert.equal(cfg.name, 'acme');
    assert.equal(cfg.defaults.model, 'anthropic/claude-sonnet-4-6');
    assert.equal(cfg.defaults.thinking, 'high');
    const sched = cfg.agentSchedules.get('planner');
    assert.ok(sched);
    assert.equal(sched.length, 1);
    assert.equal(sched[0].name, 'daily-plan');
    assert.equal(sched[0].cron, '0 9 * * *');
    assert.equal(sched[0].prompt, 'plan the day');
  });

  it('throws on missing team.yaml', () => {
    assert.throws(() => readTeamConfig(tmp), /Missing team\.yaml/);
  });

  it('throws on missing name field', () => {
    writeFileSync(join(tmp, 'team.yaml'), 'defaults:\n  model: x\n');
    assert.throws(() => readTeamConfig(tmp), /must define a non-empty name/);
  });

  it('handles missing defaults gracefully', () => {
    writeFileSync(join(tmp, 'team.yaml'), 'name: bare\n');
    const cfg = readTeamConfig(tmp);
    assert.equal(cfg.name, 'bare');
    assert.equal(cfg.defaults.model, undefined);
    assert.equal(cfg.defaults.thinking, undefined);
  });

  it('ignores unknown keys silently', () => {
    writeFileSync(join(tmp, 'team.yaml'), 'name: ok\nfoo: bar\nbaz: 42\n');
    const cfg = readTeamConfig(tmp);
    assert.equal(cfg.name, 'ok');
  });
});

describe('discoverAgents', () => {
  it('finds agents with AGENTS.md, ignores dirs without it', () => {
    const agentsDir = join(tmp, 'agents');
    mkdirSync(join(agentsDir, 'alpha'), { recursive: true });
    mkdirSync(join(agentsDir, 'beta'), { recursive: true });
    mkdirSync(join(agentsDir, 'gamma'), { recursive: true });
    writeFileSync(join(agentsDir, 'alpha', 'AGENTS.md'), '# alpha');
    writeFileSync(join(agentsDir, 'gamma', 'AGENTS.md'), '# gamma');

    const agents = discoverAgents(tmp);
    const names = agents.map((a) => a.name);
    assert.deepEqual(names, ['alpha', 'gamma']);
    assert.equal(agents[0].dir, join(agentsDir, 'alpha'));
    assert.equal(agents[0].inboxDir, join(agentsDir, 'alpha', 'inbox'));
  });

  it('returns empty array when agents/ does not exist', () => {
    assert.deepEqual(discoverAgents(tmp), []);
  });
});
