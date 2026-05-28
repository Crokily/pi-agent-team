#!/usr/bin/env node
import { startTeam } from './runtime.js';
import { init, addAgent, sendTask, status } from './commands.js';
import { errorMessage } from './logger.js';

const [cmd, ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  switch (cmd) {
    case undefined:
    case 'start': {
      const handle = await startTeam(process.cwd());
      process.on('SIGHUP', () => {
        void handle.reload().catch((err) => console.error(`reload failed: ${errorMessage(err)}`));
      });
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.on(signal, () => {
          console.log(`received ${signal}, shutting down`);
          void handle.stop().then(() => process.exit(0), () => process.exit(1));
        });
      }
      break;
    }
    case 'init': {
      const result = init(args[0]);
      console.log(`Initialized team in ${result.rootDir}`);
      console.log(`  team.yaml created`);
      console.log(`  agents/ ready`);
      console.log(`\nNext: pi-team add <agent-name>`);
      break;
    }
    case 'add': {
      const result = addAgent(args[0]);
      console.log(`Created agent: ${result.name}`);
      console.log(`  ${result.dir}/`);
      console.log(`\nNext: edit agents/${result.name}/AGENTS.md to define the role`);
      break;
    }
    case 'send': {
      const result = sendTask(args[0], args.slice(1).join(' '));
      console.log(`Sent to ${result.agent}: ${result.filename}`);
      break;
    }
    case 'status': {
      const st = status();
      console.log(`Team: ${st.name}`);
      console.log(`Agents: ${st.agents.length}`);
      if (st.agents.length === 0) {
        console.log(`\nNo agents found. Run pi-team add <name> to create one.`);
        break;
      }
      console.log();
      for (const agent of st.agents) {
        console.log(`  ${agent.name}`);
        console.log(`    inbox: ${agent.pending} pending`);
        for (const s of agent.schedules) {
          console.log(`    cron:  ${s.name} (${s.cron})${s.prompt ? ` → "${s.prompt}"` : ''}`);
        }
      }
      break;
    }
    default:
      if (cmd === '--help' || cmd === '-h') {
        printHelp();
        break;
      }
      console.error(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`Usage: pi-team [command]

Commands:
  start              Start the harness (default)
  init [dir]         Initialize a new team
  add <name>         Add a new agent
  send <agent> <msg> Send a task to an agent's inbox
  status             Show team overview

Options:
  -h, --help         Show this help`);
}

main().catch((err) => {
  console.error(errorMessage(err));
  process.exit(1);
});
