import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildPreparedDigest,
  fetchFeedBundle,
  loadFollowBuildersEditorialAssets
} from './editorial-prepare.js';
import {
  completeWithCommand,
  generateGuardedDigestDraft
} from './editorial-generation.js';
import { buildFallbackReview, reviewDigestDraft } from './editorial-review.js';
import { resolvePublishConfig } from './publish-policy.js';
import { createReviewState } from './review-state.js';
import { publishDigestArtifacts } from './digest-publisher.js';
import { notifyPublished, notifyReviewReady } from './review-notifier.js';
import { formatReviewSummary } from './review-summary.js';
import { writeModelResponseErrorArtifacts } from './model-response-artifacts.js';
import { resolveFinalPublishPolicy } from './production-policy.js';
import { runNodeScript } from './process-runner.js';

function resolveDigestDate(prepared, digest) {
  return digest.date || prepared.stats?.snapshotDate || new Date().toISOString().slice(0, 10);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function loadFeedBundle(options) {
  if (options.bundle) {
    return JSON.parse(await fs.readFile(options.bundle, 'utf-8'));
  }
  return fetchFeedBundle();
}

async function loadPublishPolicyConfig(cwd) {
  const configPath = path.join(cwd, 'editorial', 'follow-builders', 'publish-policy.json');
  try {
    return JSON.parse(await fs.readFile(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

async function writeDraftArtifacts({
  date,
  result,
  prepared,
  draftDir,
  generatedDir,
  publishConfig,
  requestedPublishPolicy,
  reviewStatus
}) {
  const dateDraftDir = path.join(draftDir, date);
  await Promise.all([ensureDir(dateDraftDir)]);

  const draftMarkdownPath = path.join(dateDraftDir, `${date}.md`);
  const draftDigestJsonPath = path.join(dateDraftDir, `${date}.digest.json`);
  const draftPreparedJsonPath = path.join(dateDraftDir, `${date}.prepared.json`);
  const dateGeneratedDir = path.join(generatedDir, date);
  await ensureDir(dateGeneratedDir);
  const reviewStatePath = path.join(dateGeneratedDir, 'review.json');
  const reviewSummaryPath = path.join(dateGeneratedDir, 'review.txt');

  await fs.writeFile(draftMarkdownPath, `${result.markdown}\n`, 'utf-8');
  await fs.writeFile(draftDigestJsonPath, `${JSON.stringify(result.digest, null, 2)}\n`, 'utf-8');
  await fs.writeFile(draftPreparedJsonPath, `${JSON.stringify(prepared, null, 2)}\n`, 'utf-8');

  const reviewState = createReviewState({
    reviewId: `${date}T${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}`,
    date,
    publishConfig,
    requestedPublishPolicy,
    initialStatus: reviewStatus,
    qualityPassed: result.quality?.passed ?? false,
    qualityIssueCount: result.quality?.issues?.length ?? 0,
    review: result.review,
    artifacts: {
      draftMarkdownPath,
      draftDigestJsonPath,
      preparedJsonPath: draftPreparedJsonPath
    }
  });

  await fs.writeFile(reviewStatePath, `${JSON.stringify(reviewState, null, 2)}\n`, 'utf-8');
  await fs.writeFile(reviewSummaryPath, `${formatReviewSummary(reviewState)}\n`, 'utf-8');
  return { reviewState, reviewStatePath, reviewSummaryPath };
}

function resolveFailureArtifactBase({ prepared, generatedDir }) {
  const date = prepared.stats?.snapshotDate || new Date().toISOString().slice(0, 10);
  return path.join(generatedDir, date);
}

export async function runLocalDigestWorkflow(options) {
  const {
    generatorCmd,
    reviewCmd,
    reviewResponseFile,
    bundle,
    contentDir,
    generatedDir,
    draftDir,
    archiveDir,
    maxRounds,
    skipBuild,
    publishCmd,
    publishPolicy,
    riskThreshold,
    env = process.env,
    cwd = process.cwd()
  } = options;

  if (!generatorCmd) {
    throw new Error('Missing --generator-cmd. Provide a local WorkBuddy/Cursor generation command.');
  }

  const [assets, feedBundle] = await Promise.all([
    loadFollowBuildersEditorialAssets(),
    loadFeedBundle({ bundle })
  ]);

  const prepared = buildPreparedDigest({ assets, feedBundle });
  const publishConfig = resolvePublishConfig({
    fileConfig: await loadPublishPolicyConfig(cwd),
    env,
    cliOptions: {
      publishPolicy,
      riskThreshold
    }
  });

  let result;
  try {
    result = await generateGuardedDigestDraft(prepared, {
      maxRounds,
      complete: ({ messages, prepared: preparedInput }) => completeWithCommand({
        prepared: preparedInput,
        messages,
        command: ['sh', '-c', generatorCmd],
        env
      })
    });
  } catch (error) {
    if (error?.rawResponse) {
      const artifacts = await writeModelResponseErrorArtifacts({
        basePath: resolveFailureArtifactBase({
          prepared,
          generatedDir
        }),
        error
      });
      error.message = `${error.message}\nSaved raw response to ${artifacts.rawPath}\nSaved error details to ${artifacts.errorPath}`;
    }
    throw error;
  }

  if (reviewResponseFile || reviewCmd) {
    const reviewComplete = reviewResponseFile
      ? async () => ({ text: await fs.readFile(reviewResponseFile, 'utf-8') })
      : ({ messages, prepared: preparedInput }) => completeWithCommand({
          prepared: preparedInput,
          messages,
          command: ['sh', '-c', reviewCmd],
          env
        });

    try {
      result.review = await reviewDigestDraft({
        prepared,
        digest: result.digest,
        complete: reviewComplete
      });
    } catch (error) {
      result.review = {
        ...buildFallbackReview({ quality: result.quality }),
        summary: `AI 审稿解析失败，已回退为人工审核：${error.message}`
      };
    }
  } else {
    result.review = buildFallbackReview({ quality: result.quality });
  }

  const date = resolveDigestDate(prepared, result.digest);
  const policyDecision = resolveFinalPublishPolicy({
    requestedPolicy: publishConfig.publishPolicy,
    qualityPassed: result.quality?.passed ?? false,
    review: result.review,
    requireQualityPass: publishConfig.requireQualityPass,
    riskThreshold: publishConfig.autoPublishRiskThreshold
  });
  const nextStatus = policyDecision.shouldPublish ? 'approved_for_publish' : 'awaiting_human_review';

  const { reviewState, reviewStatePath, reviewSummaryPath } = await writeDraftArtifacts({
    date,
    result,
    prepared,
    draftDir,
    generatedDir,
    publishConfig: {
      ...publishConfig,
      publishPolicy: policyDecision.finalPolicy
    },
    requestedPublishPolicy: policyDecision.requestedPolicy,
    reviewStatus: nextStatus
  });

  let publishResult = {
    markdownPath: null,
    archiveMarkdownPath: null,
    digestJsonPath: null,
    preparedJsonPath: null,
    built: false,
    published: false
  };

  if (nextStatus === 'approved_for_publish') {
    publishResult = await publishDigestArtifacts({
      date,
      markdown: result.markdown,
      digest: result.digest,
      prepared,
      contentDir,
      generatedDir,
      archiveDir,
      skipBuild,
      publishCmd,
      cwd
    });

    const publishedReviewState = {
      ...reviewState,
      status: 'published',
      history: [
        ...reviewState.history,
        { at: new Date().toISOString(), type: 'published' }
      ]
    };
    await ensureParentDir(reviewStatePath);
    await fs.writeFile(reviewStatePath, `${JSON.stringify(publishedReviewState, null, 2)}\n`, 'utf-8');
    await fs.writeFile(reviewSummaryPath, `${formatReviewSummary(publishedReviewState)}\n`, 'utf-8');

    if (publishConfig.notifyOnPublished) {
      await notifyPublished({
        date,
        channel: publishConfig.notifyChannel
      });
    }
  } else if (publishConfig.notifyOnDraftReady) {
    await notifyReviewReady({
      reviewState,
      channel: publishConfig.notifyChannel
    });
  }

  const finalStatus = nextStatus === 'approved_for_publish' ? 'published' : nextStatus;
  return {
    status: finalStatus,
    date,
    reviewStatePath,
    reviewSummaryPath,
    draftMarkdownPath: reviewState.artifacts.draftMarkdownPath,
    draftDigestJsonPath: reviewState.artifacts.draftDigestJsonPath,
    draftPreparedJsonPath: reviewState.artifacts.preparedJsonPath,
    markdownPath: publishResult.markdownPath,
    archiveMarkdownPath: publishResult.archiveMarkdownPath,
    digestJsonPath: publishResult.digestJsonPath,
    preparedJsonPath: publishResult.preparedJsonPath,
    built: publishResult.built,
    published: publishResult.published,
    publishPolicy: policyDecision.finalPolicy,
    requestedPolicy: policyDecision.requestedPolicy,
    finalPolicy: policyDecision.finalPolicy,
    forcedManualReasons: policyDecision.forcedManualReasons,
    reviewStatus: finalStatus,
    reviewRiskLevel: result.review?.riskLevel || 'high',
    qualityPassed: result.quality?.passed ?? false,
    qualityIssueCount: result.quality?.issues?.length ?? 0,
    rounds: result.rounds
  };
}
