const RISK_ORDER = {
  low: 0,
  medium: 1,
  high: 2
};

export function normalizeRequestedPolicy(value, fallback = 'manual_review') {
  if (value === 'auto_publish_with_fallback') {
    return 'auto_publish';
  }

  return ['manual_review', 'auto_publish'].includes(value) ? value : fallback;
}

function normalizeRiskLevel(value, fallback = 'low') {
  return Object.hasOwn(RISK_ORDER, value) ? value : fallback;
}

export function resolveFinalPublishPolicy({
  requestedPolicy = 'manual_review',
  qualityPassed,
  review,
  requireQualityPass = true,
  riskThreshold = 'low'
} = {}) {
  const normalizedRequestedPolicy = normalizeRequestedPolicy(requestedPolicy);
  const forcedManualReasons = [];

  if (normalizedRequestedPolicy === 'manual_review') {
    return {
      requestedPolicy: normalizedRequestedPolicy,
      finalPolicy: 'manual_review',
      shouldPublish: false,
      forcedManualReasons
    };
  }

  if (requireQualityPass && !qualityPassed) {
    forcedManualReasons.push('quality_gate_failed');
  }

  if (!review?.publishable) {
    forcedManualReasons.push('review_blocked_publish');
  }

  const reviewRisk = normalizeRiskLevel(review?.riskLevel, 'high');
  const maxAllowedRisk = normalizeRiskLevel(riskThreshold, 'low');
  if (RISK_ORDER[reviewRisk] > RISK_ORDER[maxAllowedRisk]) {
    forcedManualReasons.push('review_risk_too_high');
  }

  return {
    requestedPolicy: normalizedRequestedPolicy,
    finalPolicy: forcedManualReasons.length ? 'manual_review' : 'auto_publish',
    shouldPublish: forcedManualReasons.length === 0,
    forcedManualReasons
  };
}
