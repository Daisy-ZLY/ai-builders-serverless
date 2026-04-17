import { decideReviewStatus } from './publish-policy.js';

function timestamp() {
  return new Date().toISOString();
}

function historyEntry(type, extra = {}) {
  return {
    at: timestamp(),
    type,
    ...extra
  };
}

export function createReviewState({
  reviewId,
  date,
  publishConfig,
  requestedPublishPolicy = publishConfig.publishPolicy,
  qualityPassed,
  qualityIssueCount = 0,
  review,
  initialStatus = decideReviewStatus({
    config: publishConfig,
    qualityPassed,
    review
  }),
  artifacts,
  rewriteRound = 1
}) {
  return {
    reviewId,
    date,
    status: initialStatus,
    publishPolicy: publishConfig.publishPolicy,
    requestedPublishPolicy,
    qualityPassed,
    qualityIssueCount,
    rewriteRound,
    artifacts,
    review,
    humanDecision: null,
    history: [
      historyEntry('draft_generated'),
      historyEntry('ai_review_completed')
    ]
  };
}

export function applyHumanDecision(state, {
  decision,
  actor = 'local-review'
}) {
  const nextStatusByDecision = {
    approve: 'approved_for_publish',
    rewrite: 'rewrite_requested',
    save_only: 'draft_saved_only'
  };

  const historyTypeByDecision = {
    approve: 'human_approved',
    rewrite: 'human_requested_rewrite',
    save_only: 'human_saved_draft_only'
  };

  if (!Object.hasOwn(nextStatusByDecision, decision)) {
    throw new Error(`Unsupported human decision: ${decision}`);
  }

  return {
    ...state,
    status: nextStatusByDecision[decision],
    humanDecision: {
      decision,
      actor
    },
    history: [
      ...(state.history || []),
      historyEntry(historyTypeByDecision[decision], { actor })
    ]
  };
}
