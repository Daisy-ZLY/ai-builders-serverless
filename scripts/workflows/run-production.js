#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from './utils.js';
import { runProductionWorkflow } from '../lib/production-workflow.js';

async function main() {
  const options = parseArgs(process.argv, {
    defaults: {
      bundle: null,
      reviewResponseFile: null,
      reviewCmd: null,
      reviewFile: null,
      reviewDir: path.join(process.cwd(), 'generated', 'review'),
      contentDir: path.join(process.cwd(), 'content'),
      generatedDir: path.join(process.cwd(), 'generated'),
      archiveDir: path.join(process.cwd(), 'archive'),
      draftDir: path.join(process.cwd(), 'drafts'),
      sleepMs: null,
      gitPushCmd: null,
      wecomPushCmd: null,
      maxRounds: 2,
      publishPolicy: 'manual_review'
    },
    number: ['sleepMs', 'maxRounds']
  });
  const generatorCmd = options.generatorCmd || process.env.AI_BUILDERS_FORMAL_GENERATOR_CMD;

  if (!generatorCmd) {
    throw new Error('Missing generator command. Use --generator-cmd or AI_BUILDERS_FORMAL_GENERATOR_CMD.');
  }

  const result = await runProductionWorkflow({
    ...options,
    generatorCmd
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
