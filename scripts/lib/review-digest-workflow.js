import fs from 'node:fs/promises';
import { applyHumanDecision } from './review-state.js';
import { publishDigestArtifacts } from './digest-publisher.js';
import { listPendingReviews, formatReviewSummary } from './review-summary.js';

export async function reviewDigestWorkflow(options) {
  const {
    reviewFile,
    decision,
    reviewDir,
    contentDir,
    generatedDir,
    archiveDir,
    skipBuild,
    publishCmd,
    printSummary,
    listPending,
    cwd = process.cwd()
  } = options;

  if (listPending) {
    return { pending: await listPendingReviews(generatedDir) };
  }

  if (!reviewFile) {
    throw new Error('Usage: node workflow/review-digest.js --review-file state.json [--print-summary | --decision approve|rewrite|save_only] [--skip-build]');
  }

  const reviewState = JSON.parse(await fs.readFile(reviewFile, 'utf-8'));
  if (printSummary) {
    return formatReviewSummary(reviewState);
  }

  if (!decision) {
    throw new Error('Missing --decision. Use --print-summary to inspect or pass approve|rewrite|save_only.');
  }

  if (decision === 'approve' && reviewState.status === 'published') {
    return {
      status: 'published',
      reviewFile,
      message: 'Review already published; skipping duplicate publish.'
    };
  }

  const nextState = applyHumanDecision(reviewState, {
    decision,
    actor: 'local-review'
  });

  if (decision === 'approve') {
    const markdown = await fs.readFile(reviewState.artifacts.draftMarkdownPath, 'utf-8');
    const digest = JSON.parse(await fs.readFile(reviewState.artifacts.draftDigestJsonPath, 'utf-8'));
    const prepared = JSON.parse(await fs.readFile(reviewState.artifacts.preparedJsonPath, 'utf-8'));

    const publishResult = await publishDigestArtifacts({
      date: reviewState.date,
      markdown: markdown.trimEnd(),
      digest,
      prepared,
      contentDir,
      generatedDir,
      archiveDir,
      skipBuild,
      publishCmd,
      cwd
    });

    const publishedState = {
      ...nextState,
      status: 'published',
      history: [
        ...nextState.history,
        { at: new Date().toISOString(), type: 'published' }
      ]
    };
    await fs.writeFile(reviewFile, `${JSON.stringify(publishedState, null, 2)}\n`, 'utf-8');
    return {
      status: 'published',
      reviewFile,
      ...publishResult
    };
  }

  await fs.writeFile(reviewFile, `${JSON.stringify(nextState, null, 2)}\n`, 'utf-8');
  return {
    status: nextState.status,
    reviewFile
  };
}
