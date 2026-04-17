import fs from 'node:fs/promises';
import path from 'node:path';
import { reviewDigestWorkflow } from './review-digest-workflow.js';
import { runShell } from './process-runner.js';
import { uploadFileToCos, uploadDirectoryToCos } from './cos-uploader.js';

function buildDefaultWecomPushCommand(date) {
  return [
    'mkdir -p output',
    `node workflow/truncate-for-wecom.js --file "content/${date}.md" --role frontend > "output/${date}-wecom-v2.md"`,
    `node workflow/push-to-wecom.js --mode markdown --file "output/${date}-wecom-v2.md"`
  ].join(' && ');
}

async function ensureReviewFile(reviewFile) {
  try {
    await fs.access(reviewFile);
  } catch {
    throw new Error(`Review file not found: ${reviewFile}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function resolveSleepMs(sleepMs) {
  if (sleepMs === undefined || sleepMs === null) {
    return 180000;
  }

  const parsed = Number(sleepMs);
  return Number.isNaN(parsed) ? 180000 : parsed;
}

export async function publishReviewedDigestWorkflow({
  date,
  reviewFile,
  reviewDir,
  contentDir,
  generatedDir,
  archiveDir,
  sleepMs,
  wecomPushCmd = null
}) {
  const resolvedGeneratedDir = generatedDir || path.join(process.cwd(), 'generated');
  const resolvedReviewFile = reviewFile || path.join(resolvedGeneratedDir, date, 'review.json');

  await ensureReviewFile(resolvedReviewFile);

  const approveResult = await reviewDigestWorkflow({
    reviewFile: resolvedReviewFile,
    decision: 'approve',
    skipBuild: false,
    contentDir,
    generatedDir,
    archiveDir
  });
  
  if (approveResult.status !== 'published') {
    throw new Error(`Review approval did not publish digest (status=${approveResult.status || 'unknown'})`);
  }

  // Upload generated content to COS
  console.log('Uploading generated content to COS...');
  try {
    // Upload the markdown file
    await uploadFileToCos(`content/${date}.md`, `content/${date}.md`);
    // Upload the archive file
    await uploadFileToCos(`archive/${date}.md`, `archive/${date}.md`);
    // Upload the generated JSON and review files
    await uploadDirectoryToCos(`generated/${date}`, `generated/${date}`);
    // Upload the static site (docs directory)
    await uploadDirectoryToCos('docs', 'docs');
    console.log('COS upload completed successfully.');
  } catch (error) {
    console.error('Failed to upload to COS:', error);
    throw error;
  }

  await sleep(resolveSleepMs(sleepMs));
  await runShell(wecomPushCmd || buildDefaultWecomPushCommand(date));

  return {
    ...approveResult,
    cosUpload: 'success',
    wecomMarkdownPush: 'success'
  };
}
