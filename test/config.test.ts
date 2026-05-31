import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverAgents, discoverTeam, readRuntimeConfig } from '../src/config.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pi-cfg-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('readRuntimeConfig', () => {
  it('parses valid team.yaml with defaults and agent schedules', () => {
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

    const cfg = readRuntimeConfig(tmp);
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
    assert.throws(() => readRuntimeConfig(tmp), /Missing team\.yaml/);
  });

  it('handles missing defaults gracefully', () => {
    writeFileSync(join(tmp, 'team.yaml'), 'name: bare\n');
    const cfg = readRuntimeConfig(tmp);
    assert.equal(cfg.defaults.model, undefined);
    assert.equal(cfg.defaults.thinking, undefined);
  });

});

describe('discoverTeam', () => {
  it('reads the team name and discovers convention agents', () => {
    writeFileSync(join(tmp, 'team.yaml'), 'name: acme\n');
    const agentsDir = join(tmp, 'agents');
    mkdirSync(join(agentsDir, 'planner'), { recursive: true });
    writeFileSync(join(agentsDir, 'planner', 'AGENTS.md'), '# planner');

    const team = discoverTeam(tmp);
    assert.equal(team.rootDir, tmp);
    assert.equal(team.name, 'acme');
    assert.deepEqual(team.agents.map((a) => a.name), ['planner']);
  });

  it('throws on missing name field', () => {
    writeFileSync(join(tmp, 'team.yaml'), 'defaults:\n  model: x\n');
    assert.throws(() => discoverTeam(tmp), /must define a non-empty name/);
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
  });

  it('returns empty array when agents/ does not exist', () => {
    assert.deepEqual(discoverAgents(tmp), []);
  });
});
