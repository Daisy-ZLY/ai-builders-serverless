import fs from 'node:fs/promises';
import path from 'node:path';

function formatIssues(issues = []) {
  if (!issues.length) {
    return ['- 无结构化风险问题'];
  }

  return issues.map(issue => `- [${issue.severity || 'unknown'}] ${issue.code} @ ${issue.path}: ${issue.message}`);
}

function formatHighlights(highlights = []) {
  if (!highlights.length) {
    return ['- 无重点条目'];
  }

  return highlights.map(item => `- ${item.entryName}: ${item.reason}`);
}

export function formatReviewSummary(reviewState) {
  const lines = [
    `Review ID: ${reviewState.reviewId}`,
    `Date: ${reviewState.date}`,
    `Status: ${reviewState.status}`,
    `Policy: ${reviewState.publishPolicy}`,
    `Quality: ${reviewState.qualityPassed ? 'pass' : 'fail'} (${reviewState.qualityIssueCount} issues)`,
    `Risk: ${reviewState.review?.riskLevel || 'unknown'}`,
    `Recommended action: ${reviewState.review?.recommendedAction || 'manual_check'}`,
    '',
    'Summary:',
    reviewState.review?.summary || '无摘要',
    '',
    'Highlights:',
    ...formatHighlights(reviewState.review?.highlights || []),
    '',
    'Issues:',
    ...formatIssues(reviewState.review?.issues || []),
    '',
    'Artifacts:',
    `- Markdown: ${reviewState.artifacts?.draftMarkdownPath || ''}`,
    `- Digest JSON: ${reviewState.artifacts?.draftDigestJsonPath || ''}`,
    `- Prepared JSON: ${reviewState.artifacts?.preparedJsonPath || ''}`,
    '',
    'Actions:',
    'approve | rewrite | save_only'
  ];

  return lines.join('\n');
}

export async function listPendingReviews(generatedDir) {
  const entries = await fs.readdir(generatedDir, { withFileTypes: true });
  const pending = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dateDir = entry.name;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) continue;

    const fullPath = require('node:path').join(generatedDir, dateDir, 'review.json');
    try {
      const reviewState = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
      if (!['awaiting_human_review', 'rewrite_requested'].includes(reviewState.status)) {
        continue;
      }

      pending.push({
        path: fullPath,
        reviewId: reviewState.reviewId,
        date: reviewState.date,
        status: reviewState.status,
        riskLevel: reviewState.review?.riskLevel || 'unknown',
        summary: reviewState.review?.summary || ''
      });
    } catch (err) {
      // Ignore
    }
  }

  pending.sort((left, right) => right.date.localeCompare(left.date));
  return pending;
}
