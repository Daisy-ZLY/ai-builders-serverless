import { parseCliArgs } from '../lib/cli-args.js';
import { parseJsonOutput, runNodeScript, runShell } from '../lib/process-runner.js';

export function parseArgs(argv, options = {}) {
  return parseCliArgs(argv, options);
}

export { parseJsonOutput, runNodeScript, runShell };

export function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
