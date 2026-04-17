#!/usr/bin/env node

import path from 'node:path';
import { parseCliArgs } from './lib/cli-args.js';
import { runLocalDigestWorkflow } from './lib/local-digest-workflow.js';

async function main() {
  const options = parseCliArgs(process.argv, {
    defaults: {
      bundle: null,
      generatorCmd: null,
      reviewCmd: null,
      reviewResponseFile: null,
      contentDir: path.join(process.cwd(), 'content'),
      generatedDir: path.join(process.cwd(), 'generated'),
      draftDir: path.join(process.cwd(), 'drafts'),
      reviewDir: path.join(process.cwd(), 'generated', 'review'),
      skipBuild: false,
      archiveDir: path.join(process.cwd(), 'archive'),
      maxRounds: 2,
      publishCmd: null,
      publishPolicy: null,
      riskThreshold: null
    },
    boolean: ['skipBuild'],
    number: ['maxRounds']
  });

  const result = await runLocalDigestWorkflow(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
