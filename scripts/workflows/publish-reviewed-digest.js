#!/usr/bin/env node

import path from 'node:path';
import { parseArgs, todayDateString } from './utils.js';
import { publishReviewedDigestWorkflow } from '../lib/publish-reviewed-workflow.js';

async function main() {
  const options = parseArgs(process.argv, {
    defaults: {
      date: null,
      reviewFile: null,
      reviewDir: path.join(process.cwd(), 'generated', 'review'),
      contentDir: path.join(process.cwd(), 'content'),
      generatedDir: path.join(process.cwd(), 'generated'),
      archiveDir: path.join(process.cwd(), 'archive'),
      sleepMs: 180000,
      wecomPushCmd: null
    },
    number: ['sleepMs']
  });
  const date = options.date || todayDateString();
  const generatedDir = options.generatedDir || path.join(process.cwd(), 'generated');
  const dateGeneratedDir = path.join(generatedDir, date);
  const reviewFile = options.reviewFile || path.join(dateGeneratedDir, 'review.json');
  const contentDir = options.contentDir || path.join(process.cwd(), 'content');
  const archiveDir = options.archiveDir || path.join(process.cwd(), 'archive');
  const result = await publishReviewedDigestWorkflow({
    date,
    reviewFile,
    contentDir,
    generatedDir,
    archiveDir,
    sleepMs: options.sleepMs,
    wecomPushCmd: options.wecomPushCmd
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
