const DEFAULT_PUBLISH_CONFIG = {
  publishPolicy: 'manual_review',
  requireQualityPass: true,
  autoPublishRiskThreshold: 'low',
  allowHumanOverride: true,
  maxRewriteRounds: 2,
  notifyOnDraftReady: true,
  notifyOnPublished: true,
  notifyChannel: 'stdout'
};

const RISK_ORDER = {
  low: 0,
  medium: 1,
  high: 2
};

import { resolveFinalPublishPolicy, normalizeRequestedPolicy } from './production-policy.js';

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return fallback;
}

function normalizeRiskLevel(value, fallback = 'low') {
  return Object.hasOwn(RISK_ORDER, value) ? value : fallback;
}

function normalizePolicy(value, fallback = 'manual_review') {
  return normalizeRequestedPolicy(value, fallback);
}

export function resolvePublishConfig({
  fileConfig = {},
  env = process.env,
  cliOptions = {}
} = {}) {
  const merged = {
    ...DEFAULT_PUBLISH_CONFIG,
    ...fileConfig
  };

  if (env.AI_BUILDERS_PUBLISH_POLICY) {
    merged.publishPolicy = env.AI_BUILDERS_PUBLISH_POLICY;
  }
  if (env.AI_BUILDERS_AUTO_PUBLISH_RISK_THRESHOLD) {
    merged.autoPublishRiskThreshold = env.AI_BUILDERS_AUTO_PUBLISH_RISK_THRESHOLD;
  }
  if (env.AI_BUILDERS_REQUIRE_QUALITY_PASS) {
    merged.requireQualityPass = env.AI_BUILDERS_REQUIRE_QUALITY_PASS;
  }
  if (env.AI_BUILDERS_REVIEW_NOTIFY_CHANNEL) {
    merged.notifyChannel = env.AI_BUILDERS_REVIEW_NOTIFY_CHANNEL;
  }

  if (cliOptions.publishPolicy) {
    merged.publishPolicy = cliOptions.publishPolicy;
  }
  if (cliOptions.riskThreshold) {
    merged.autoPublishRiskThreshold = cliOptions.riskThreshold;
  }
  if (Object.hasOwn(cliOptions, 'requireQualityPass')) {
    merged.requireQualityPass = cliOptions.requireQualityPass;
  }

  return {
    ...merged,
    publishPolicy: normalizePolicy(merged.publishPolicy),
    autoPublishRiskThreshold: normalizeRiskLevel(merged.autoPublishRiskThreshold),
    requireQualityPass: normalizeBoolean(merged.requireQualityPass, DEFAULT_PUBLISH_CONFIG.requireQualityPass)
  };
}

function canAutoPublish({ config, qualityPassed, review }) {
  return resolveFinalPublishPolicy({
    requestedPolicy: config.publishPolicy,
    qualityPassed,
    review,
    requireQualityPass: config.requireQualityPass,
    riskThreshold: config.autoPublishRiskThreshold
  }).shouldPublish;
}

export function decideReviewStatus({
  config,
  qualityPassed,
  review
}) {
  const resolvedConfig = resolvePublishConfig({ fileConfig: config });

  if (resolvedConfig.publishPolicy === 'manual_review') {
    return 'awaiting_human_review';
  }

  if (canAutoPublish({ config: resolvedConfig, qualityPassed, review })) {
    return 'approved_for_publish';
  }

  return 'awaiting_human_review';
}
