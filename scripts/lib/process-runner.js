import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 10 * 1024 * 1024;

export async function runCommand(command, args = [], {
  cwd = process.cwd(),
  env = process.env
} = {}) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd,
    env,
    maxBuffer: MAX_BUFFER
  });

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim()
  };
}

export async function runNodeScript(scriptPath, scriptArgs = [], envOverrides = {}, options = {}) {
  return runCommand('node', [scriptPath, ...scriptArgs], {
    ...options,
    env: {
      ...process.env,
      ...envOverrides
    }
  });
}

export async function runShell(command, envOverrides = {}, options = {}) {
  return runCommand('sh', ['-c', command], {
    ...options,
    env: {
      ...process.env,
      ...envOverrides
    }
  });
}

export function parseJsonOutput(text) {
  return JSON.parse(String(text || '').trim());
}
