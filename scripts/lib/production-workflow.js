import { runLocalDigestWorkflow } from './local-digest-workflow.js';
import { publishReviewedDigestWorkflow } from './publish-reviewed-workflow.js';
import { normalizeRequestedPolicy } from './production-policy.js';

export async function runProductionWorkflow(options) {
  const requestedPolicy = normalizeRequestedPolicy(options.publishPolicy || 'manual_review');
  const env = {
    ...(options.env || process.env),
    AI_BUILDERS_REVIEW_NOTIFY_CHANNEL: 'none'
  };
  const draftResult = await runLocalDigestWorkflow({
    ...options,
    publishPolicy: requestedPolicy,
    skipBuild: false, // ALWAYS build HTML during draft phase so reviewers can see the final output
    env
  });

  let finalResult = draftResult;
  if (draftResult.status === 'published') {
    finalResult = {
      ...draftResult,
      ...await publishReviewedDigestWorkflow({
        date: draftResult.date,
        reviewFile: options.reviewFile || draftResult.reviewStatePath,
        contentDir: options.contentDir,
        generatedDir: options.generatedDir,
        archiveDir: options.archiveDir,
        sleepMs: options.sleepMs,
        wecomPushCmd: options.wecomPushCmd
      })
    };
  }

  const published = finalResult.status === 'published';
  return {
    ...finalResult,
    requestedPolicy: finalResult.requestedPolicy || requestedPolicy,
    finalPolicy: finalResult.finalPolicy || requestedPolicy,
    forcedManualReasons: finalResult.forcedManualReasons || [],
    status: published ? 'published' : 'review_required',
    step: published ? 'publish' : 'review_gate',
    message: published
      ? 'Digest published successfully.'
      : 'Draft is ready and waiting at the review gate.'
  };
}
