#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  completeWithCommand,
  generateGuardedDigestDraft
} from './lib/editorial-generation.js';
import { parseCliArgs } from './lib/cli-args.js';
import { writeModelResponseErrorArtifacts } from './lib/model-response-artifacts.js';

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function resolveFailureArtifactBase(options) {
  const preferredOutput = options.outJson || options.outMd || options.prepared;
  const parsed = path.parse(preferredOutput);
  return parsed.dir;
}

async function main() {
  const options = parseCliArgs(process.argv, {
    defaults: {
      prepared: null,
      outJson: null,
      outMd: null,
      responseFile: null,
      generatorCmd: null,
      maxRounds: 2
    },
    number: ['maxRounds']
  });
  if (!options.prepared) {
    throw new Error('Usage: node workflow/generate-digest-draft.js --prepared prepared.json [--out-json file] [--out-md file] [--response-file file] [--generator-cmd "cmd ..."]');
  }

  const prepared = JSON.parse(await fs.readFile(options.prepared, 'utf-8'));
  const complete = options.responseFile
    ? async () => ({ text: await fs.readFile(options.responseFile, 'utf-8') })
    : options.generatorCmd
      ? ({ messages, prepared: preparedInput }) => completeWithCommand({
          prepared: preparedInput,
          messages,
          command: ['sh', '-c', options.generatorCmd]
        })
      : null;

  if (!complete) {
    throw new Error('No generator configured. Use --response-file for replay or --generator-cmd for local IDE/WorkBuddy generation.');
  }

  let result;
  try {
    result = await generateGuardedDigestDraft(prepared, { complete, maxRounds: options.maxRounds });
  } catch (error) {
    if (error?.rawResponse) {
      const artifacts = await writeModelResponseErrorArtifacts({
        basePath: resolveFailureArtifactBase(options),
        error
      });
      error.message = `${error.message}\nSaved raw response to ${artifacts.rawPath}\nSaved error details to ${artifacts.errorPath}`;
    }
    throw error;
  }

  if (options.outJson) {
    await ensureParentDir(options.outJson);
    await fs.writeFile(options.outJson, `${JSON.stringify(result.digest, null, 2)}\n`, 'utf-8');
  }

  if (options.outMd) {
    await ensureParentDir(options.outMd);
    await fs.writeFile(options.outMd, `${result.markdown}\n`, 'utf-8');
  }

  if (!options.outJson && !options.outMd) {
    process.stdout.write(`${result.markdown}\n`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
