function cjkCount(text = '') {
  const matches = String(text).match(/[\u4e00-\u9fff]/g);
  return matches ? matches.length : 0;
}

function latinWordCount(text = '') {
  const matches = String(text).match(/[A-Za-z]{3,}/g);
  return matches ? matches.length : 0;
}

function looksInsufficientlyChinese(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return true;
  return cjkCount(normalized) < 8 || (latinWordCount(normalized) >= 6 && cjkCount(normalized) < latinWordCount(normalized));
}

function pushIssue(issues, code, message, path) {
  issues.push({ code, message, path });
}

export function validateDigestQuality(digest, prepared = {}) {
  const issues = [];
  const builders = Array.isArray(digest?.builders) ? digest.builders : [];
  const blogs = Array.isArray(digest?.blogs) ? digest.blogs : [];
  const podcasts = Array.isArray(digest?.podcasts) ? digest.podcasts : [];
  const roleSuggestions = Array.isArray(digest?.roleSuggestions) ? digest.roleSuggestions : [];

  const availableBuilders = prepared?.x?.length || builders.length || 0;
  const minExpectedBuilders = availableBuilders > 0 ? Math.min(3, availableBuilders) : 0;

  if (builders.length < minExpectedBuilders) {
    pushIssue(issues, 'builder_count_too_low', `Expected at least ${minExpectedBuilders} builders, got ${builders.length}`, 'builders');
  }

  builders.forEach((builder, index) => {
    const path = `builders[${index}]`;
    if (!builder.originalText) pushIssue(issues, 'builder_missing_original', 'Builder is missing original text', `${path}.originalText`);
    if (!builder.chineseInterpretation) pushIssue(issues, 'builder_missing_interpretation', 'Builder is missing Chinese interpretation', `${path}.chineseInterpretation`);
    if (!builder.tldr) pushIssue(issues, 'builder_missing_tldr', 'Builder is missing tldr', `${path}.tldr`);
    if (!builder.links || builder.links.length === 0) pushIssue(issues, 'builder_missing_links', 'Builder is missing links', `${path}.links`);
    if (!builder.proView || !builder.conView || !builder.clue) {
      pushIssue(issues, 'builder_missing_dialectic', 'Builder is missing dialectic fields', path);
    }
    if (!builder.relevance) {
      pushIssue(issues, 'builder_missing_relevance', 'Builder is missing relevance guidance', `${path}.relevance`);
    }
    if (builder.tldr && looksInsufficientlyChinese(builder.tldr)) {
      pushIssue(issues, 'builder_non_chinese_tldr', 'Builder tldr is not Chinese enough', `${path}.tldr`);
    }
    if (builder.chineseInterpretation && looksInsufficientlyChinese(builder.chineseInterpretation)) {
      pushIssue(issues, 'builder_non_chinese_interpretation', 'Builder interpretation is not Chinese enough', `${path}.chineseInterpretation`);
    }
  });

  [...blogs, ...podcasts].forEach((entry, index) => {
    const section = index < blogs.length ? 'blogs' : 'podcasts';
    const path = `${section}[${section === 'blogs' ? index : index - blogs.length}]`;
    if (!entry.chineseInterpretation) pushIssue(issues, 'content_missing_interpretation', 'Content section missing Chinese interpretation', `${path}.chineseInterpretation`);
    if (!entry.tldr) pushIssue(issues, 'content_missing_tldr', 'Content section missing tldr', `${path}.tldr`);
    if (!entry.links || entry.links.length === 0) pushIssue(issues, 'content_missing_links', 'Content section missing links', `${path}.links`);
  });

  const requiredRoleIds = ['frontend', 'backend', 'product'];
  for (const roleId of requiredRoleIds) {
    const group = roleSuggestions.find(item => item.roleId === roleId);
    if (!group) {
      pushIssue(issues, 'missing_role_group', `Missing role suggestion group for ${roleId}`, `roleSuggestions.${roleId}`);
      continue;
    }
    if (!Array.isArray(group.items) || group.items.length === 0) {
      pushIssue(issues, 'empty_role_group', `Role suggestion group ${roleId} has no items`, `roleSuggestions.${roleId}.items`);
    }
    if (!Array.isArray(group.actions) || group.actions.length === 0) {
      pushIssue(issues, 'missing_role_actions', `Role suggestion group ${roleId} has no actions`, `roleSuggestions.${roleId}.actions`);
    }
  }

  return {
    passed: issues.length === 0,
    issues
  };
}

export function buildQualityFeedbackMessages(prepared, digest, qualityReport) {
  const issueLines = qualityReport.issues
    .map((issue, index) => `${index + 1}. [${issue.code}] ${issue.path} - ${issue.message}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: '你是 AI Builders 早报的审稿主编。你的任务是修复已有 digest JSON 中的质量问题，并返回完整、修复后的 JSON。不要输出解释。'
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
        '# Current Draft JSON',
        JSON.stringify(digest, null, 2),
        '# Quality Issues To Fix',
        issueLines
      ].join('\n\n')
    }
  ];
}
