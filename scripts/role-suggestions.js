import { DEFAULT_ROLE_ID, ROLE_CONFIGS, getRoleConfig, normalizeRoleId } from './roles.js';

export const DEFAULT_RELEVANCE_INTRO = '根据今日内容，值得你关注/尝试/警惕的：';

function normalizeActions(actions = []) {
  if (!Array.isArray(actions)) return [];

  return actions
    .map(action => String(action || '').trim())
    .filter(Boolean);
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map(item => ({
      title: String(item?.title || '').trim(),
      summary: String(item?.summary || item?.understanding || item?.description || item?.detail || '').trim(),
      implication: String(item?.implication || item?.meaning || '').trim(),
      sourceUrl: String(item?.sourceUrl || item?.url || item?.source || '').trim()
    }))
    .filter(item => item.title && (item.summary || item.implication || item.sourceUrl));
}

function extractItemsFromText(text = '') {
  const items = [];
  // 匹配 "- **标题**：内容" 或者 "1. **标题**：内容" 格式，支持空行和结束符
  const regex = /(?:^|\n)(?:-|\d+\.)\s+\*\*(.+?)\*\*[：:]\s*([\s\S]+?)(?=\n+(?:-|\d+\.)\s+\*\*|\n+###\s+|\n+##\s+|\n+---|$)/gs;

  let hasMatches = false;
  for (const match of text.matchAll(regex)) {
    hasMatches = true;
    items.push({
      title: match[1].trim(),
      summary: match[2].trim().replace(/\n/g, ' ')
    });
  }

  // 如果没有匹配到加粗标题格式，尝试匹配普通列表格式
  if (!hasMatches) {
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/^(?:-|\d+\.)\s+(.+)$/);
      if (match) {
        items.push({
          title: String(items.length + 1), // 简单的数字作为标题
          summary: match[1].trim()
        });
      }
    }
  }

  return normalizeItems(items);
}

function extractRichItemsFromRoleSection(sectionText = '') {
  const headingMatches = [...sectionText.matchAll(/^####\s+(.+)$/gm)];
  const summaryPattern = /(?:-|\*)\s*\**一句话理解\**[：:]\s*(.+)/;
  const implicationPattern = /(?:-|\*)\s*\**对你意味着什么\**[：:]\s*(.+)/;
  const sourcePattern = /(?:-|\*)\s*\**原文链接\**[：:]\s*(.+)/;
  
  // 如果没有 #### 标题，说明可能是直接在 ### 角色下写的内容（如 4月9日格式）
  if (!headingMatches.length) {
    const summary = sectionText.match(summaryPattern)?.[1]?.trim() || '';
    const implication = sectionText.match(implicationPattern)?.[1]?.trim() || '';
    const sourceLine = sectionText.match(sourcePattern)?.[1]?.trim() || '';
    const sourceUrl = sourceLine.match(/\((https?:\/\/[^)\s]+)\)/)?.[1]
      || sourceLine.match(/https?:\/\/[^\s)]+/)?.[0]
      || '';
      
    if (summary || implication) {
      return normalizeItems([{
        title: "建议",
        summary,
        implication,
        sourceUrl
      }]);
    }
    return [];
  }

  const items = [];
  for (let i = 0; i < headingMatches.length; i++) {
    const current = headingMatches[i];
    const next = headingMatches[i + 1];
    const start = current.index + current[0].length;
    const actionsMarker = sectionText.search(/^(?:#####\s+可执行动作|可执行动作：?|\*?\*?行动建议\*?\*?：?)\s*$/m);
    const legacyActionsMarker = sectionText.indexOf('**可执行动作**', start);
    const firstActionsMarker = actionsMarker !== -1 ? actionsMarker : legacyActionsMarker;
    const hardEnd = next ? next.index : sectionText.length;
    const end = firstActionsMarker !== -1 && firstActionsMarker < hardEnd ? firstActionsMarker : hardEnd;
    const block = sectionText.slice(start, end).trim();

    const summary = block.match(summaryPattern)?.[1]?.trim() || '';
    const implication = block.match(implicationPattern)?.[1]?.trim() || '';
    const sourceLine = block.match(sourcePattern)?.[1]?.trim() || '';
    const sourceUrl = sourceLine.match(/\((https?:\/\/[^)\s]+)\)/)?.[1]
      || sourceLine.match(/https?:\/\/[^\s)]+/)?.[0]
      || '';

    items.push({
      title: current[1].trim(),
      summary,
      implication,
      sourceUrl
    });
  }

  return normalizeItems(items);
}

function extractActions(sectionText = '') {
  const actionsMatch = sectionText.match(/(?:#####\s+可执行动作|可执行动作：?|\*\*可执行动作\*\*|\*\*行动建议\*\*：?)\s*([\s\S]*)$/);
  if (!actionsMatch) return [];

  const actions = [];
  for (const match of actionsMatch[1].matchAll(/- \[ \]\s+(?:\*\*.+?\*\*[：:]\s*)?(.+)/g)) {
    actions.push(match[1].trim());
  }
  return normalizeActions(actions);
}

function detectRoleIdFromHeading(heading = '') {
  const normalized = heading.toLowerCase();
  for (const role of ROLE_CONFIGS) {
    const candidates = [
      role.id,
      role.label,
      ...role.aliases,
      ...role.labels
    ].map(c => c.toLowerCase());
    
    if (candidates.some(c => normalized.includes(c))) {
      return role.id;
    }
  }
  return DEFAULT_ROLE_ID;
}

function collectRoleSuggestionsFromObject(object) {
  const groups = [];

  for (const role of ROLE_CONFIGS) {
    const candidateKeys = [
      role.key,
      role.id,
      ...role.aliases
    ];

    let rolePayload = null;
    for (const key of candidateKeys) {
      if (object?.[key]) {
        rolePayload = object[key];
        break;
      }
    }

    const items = normalizeItems(Array.isArray(rolePayload) ? rolePayload : rolePayload?.items);
    const actions = normalizeActions(rolePayload?.actions);
    if (items.length > 0 || actions.length > 0) {
      groups.push({
        roleId: role.id,
        roleLabel: role.label,
        items,
        actions
      });
    }
  }

  return groups;
}

export function normalizeRoleSuggestionsPayload(payload) {
  if (!payload || typeof payload !== 'object') return [];

  if (Array.isArray(payload.roles)) {
    return payload.roles
      .map(roleGroup => {
        const roleConfig = getRoleConfig(roleGroup?.roleId || roleGroup?.role || roleGroup?.label);
        const items = normalizeItems(roleGroup?.items);
        const actions = normalizeActions(roleGroup?.actions);
        if (items.length === 0 && actions.length === 0) return null;
        return {
          roleId: roleConfig.id,
          roleLabel: roleConfig.label,
          items,
          actions
        };
      })
      .filter(Boolean);
  }

  if (payload.roleSuggestions && typeof payload.roleSuggestions === 'object') {
    return collectRoleSuggestionsFromObject(payload.roleSuggestions);
  }

  if (Array.isArray(payload.items)) {
    const items = normalizeItems(payload.items);
    if (items.length === 0) return [];
    const roleConfig = getRoleConfig(DEFAULT_ROLE_ID);
    return [{
      roleId: roleConfig.id,
      roleLabel: roleConfig.label,
      items
    }];
  }

  return [];
}

export function renderRoleSuggestionsMarkdown(groupsInput, intro = DEFAULT_RELEVANCE_INTRO) {
  const groups = Array.isArray(groupsInput)
    ? groupsInput
    : normalizeRoleSuggestionsPayload(groupsInput);

  if (!groups.length) return '';

  let markdown = '## 🎯 和你有关\n';
  markdown += `${intro}\n\n`;

  for (const group of groups) {
    const roleConfig = getRoleConfig(group.roleId);
    markdown += `### ${group.roleLabel || roleConfig.label}\n`;
    for (const item of group.items) {
      markdown += `\n#### ${item.title}\n`;
      if (item.summary) markdown += `- 一句话理解：${item.summary}\n`;
      if (item.implication) markdown += `- 对你意味着什么：${item.implication}\n`;
      if (item.sourceUrl) markdown += `- 原文链接：[查看原文](${item.sourceUrl})\n`;
    }
    if (group.actions?.length) {
      markdown += `\n可执行动作：\n\n`;
      for (const action of group.actions) {
        markdown += `- [ ] ${action}\n`;
      }
    }
    markdown += '\n';
  }

  return markdown;
}

export function extractRoleSuggestions(md) {
  const match = md.match(/##\s*🎯\s*(?:和你有关|落地建议|前端团队|本周可以做的)?\s*\n([\s\S]*?)(?=\n##\s+|$)/);
  if (!match) {
    return {
      intro: DEFAULT_RELEVANCE_INTRO,
      groups: [],
      isRoleSpecific: false
    };
  }

  const body = match[1].trim();
  const roleHeadingMatches = [...body.matchAll(/^###\s+(.+)$/gm)];

  if (roleHeadingMatches.length === 0) {
    const items = extractItemsFromText(body);
    if (!items.length) {
      return { intro: DEFAULT_RELEVANCE_INTRO, groups: [], isRoleSpecific: false };
    }

    const firstBulletMatch = body.match(/(?:^|\n)(?:-|\d+\.)\s+\*\*/);
    const intro = firstBulletMatch
      ? body.slice(0, firstBulletMatch.index).trim() || DEFAULT_RELEVANCE_INTRO
      : DEFAULT_RELEVANCE_INTRO;

    const roleConfig = getRoleConfig(DEFAULT_ROLE_ID);
    return {
      intro,
      groups: [{
        roleId: roleConfig.id,
        roleLabel: roleConfig.label,
          items,
          actions: []
      }],
      isRoleSpecific: false
    };
  }

  const introCandidate = body.split(/^###\s+/m)[0].trim();
  const intro = introCandidate || DEFAULT_RELEVANCE_INTRO;

  const groups = [];
  for (let i = 0; i < roleHeadingMatches.length; i++) {
    const current = roleHeadingMatches[i];
    const next = roleHeadingMatches[i + 1];
    const heading = current[1].trim();
    
    // 过滤掉私人版的建议（如“个人武器库”、“私人”）
    if (/个人|私人|武器库|private/i.test(heading)) {
      continue;
    }

    const start = current.index + current[0].length;
    const end = next ? next.index : body.length;
    const sectionBody = body.slice(start, end).trim();
    const items = extractRichItemsFromRoleSection(sectionBody);
    const fallbackItems = items.length > 0 ? items : extractItemsFromText(sectionBody);
    const actions = extractActions(sectionBody);

    if (!fallbackItems.length && !actions.length) continue;

    const roleId = detectRoleIdFromHeading(heading);
    const roleConfig = getRoleConfig(roleId);
    groups.push({
      roleId: roleConfig.id,
      roleLabel: heading,
      items: fallbackItems,
      actions
    });
  }

  return { intro, groups, isRoleSpecific: true };
}

export function getRoleSuggestionGroup(md, roleId) {
  const { intro, groups, isRoleSpecific } = extractRoleSuggestions(md);
  if (!groups.length) {
    return {
      intro,
      isRoleSpecific,
      roleId: normalizeRoleId(roleId),
      roleLabel: getRoleConfig(roleId).label,
      items: [],
      actions: []
    };
  }

  const normalizedRoleId = normalizeRoleId(roleId);
  const exact = groups.find(group => group.roleId === normalizedRoleId);
  if (exact) {
    return { intro, isRoleSpecific, ...exact };
  }

  return { intro, isRoleSpecific, ...groups[0] };
}
