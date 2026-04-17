import { stripJsonFences } from './editorial-generation.js';

function buildReviewSchemaDescription() {
  return `Return JSON only. Use this shape:
{
  "publishable": true,
  "riskLevel": "low|medium|high",
  "recommendedAction": "approve|rewrite|manual_check",
  "summary": "string",
  "highlights": [
    {
      "entryName": "string",
      "reason": "string"
    }
  ],
  "issues": [
    {
      "code": "string",
      "severity": "low|medium|high",
      "path": "string",
      "message": "string"
    }
  ]
}`;
}

export function buildReviewMessages({ prepared, digest }) {
  return [
    {
      role: 'system',
      content: [
        'You are the final editorial reviewer for AI Builders Daily.',
        'Check factual overreach, unsupported conclusions, link completeness, Chinese clarity, and publication risk.',
        'Return JSON only.',
        buildReviewSchemaDescription()
      ].join('\n\n')
    },
    {
      role: 'user',
      content: [
        '# Prepared Input',
        JSON.stringify({
          stats: prepared.stats,
          x: prepared.x,
          blogs: prepared.blogs,
          podcasts: prepared.podcasts
        }, null, 2),
        '# Draft Digest',
        JSON.stringify(digest, null, 2)
      ].join('\n\n')
    }
  ];
}

export function parseReviewResponse(text) {
  const parsed = JSON.parse(stripJsonFences(text));
  if (typeof parsed?.publishable !== 'boolean') {
    throw new Error('Review response missing boolean publishable');
  }
  if (!['low', 'medium', 'high'].includes(parsed?.riskLevel)) {
    throw new Error('Review response missing valid riskLevel');
  }
  if (!['approve', 'rewrite', 'manual_check'].includes(parsed?.recommendedAction)) {
    throw new Error('Review response missing valid recommendedAction');
  }
  return {
    summary: '',
    highlights: [],
    issues: [],
    ...parsed
  };
}

export function buildFallbackReview({ quality }) {
  const passed = quality?.passed ?? false;
  return {
    publishable: passed,
    riskLevel: passed ? 'low' : 'high',
    recommendedAction: passed ? 'approve' : 'manual_check',
    summary: passed
      ? '未配置独立 AI 审稿器，使用质量守门结果作为默认审稿结论。'
      : '质量守门未通过，已回退为人工审核。',
    highlights: [],
    issues: (quality?.issues || []).map(issue => ({
      code: issue.code,
      severity: 'high',
      path: issue.path,
      message: issue.message
    }))
  };
}

export async function reviewDigestDraft({
  prepared,
  digest,
  complete
}) {
  const messages = buildReviewMessages({ prepared, digest });
  const response = await complete({ messages, prepared, digest });
  return parseReviewResponse(response.text);
}
