import { extractRoleSuggestions } from '../role-suggestions.js';
import { findBuilderProfileByName } from '../builder-profiles.js';

function extractFrontmatter(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { attrs: {}, body: md };

  const attrs = {};
  for (const line of match[1].split('\n')) {
    const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!fieldMatch) continue;
    attrs[fieldMatch[1]] = fieldMatch[2].trim();
  }
  return { attrs, body: md.slice(match[0].length) };
}

function extractSection(md, sectionHeader) {
  const headerMatch = md.match(sectionHeader);
  if (!headerMatch) return '';

  const startIdx = headerMatch.index;
  const rest = md.slice(startIdx + 1);
  const nextSection = rest.match(/^##\s+/m);
  const endIdx = nextSection ? startIdx + 1 + nextSection.index : md.length;
  return md.slice(startIdx, endIdx);
}

function extractAllFieldsJoin(body, fieldNames) {
  for (const fieldName of fieldNames) {
    const regex = new RegExp(`\\*\\*${fieldName}[：:]\\*\\*\\s*\\n?([\\s\\S]*?)(?=\\n\\*\\*|\\n\\[原文链接\\]|\\n\\[收听|\\nhttps?://|$)`, 'g');
    const matches = [...body.matchAll(regex)];
    if (matches.length > 0) {
      return matches.map(match => match[1].trim()).join('\n\n---\n\n');
    }
  }
  return '';
}

function extractField(body, fieldNames) {
  for (const fieldName of fieldNames) {
    const regex = new RegExp(`\\*\\*${fieldName}[：:]\\*\\*\\s*\\n?([\\s\\S]*?)(?=\\n\\*\\*|\\n\\[原文链接\\]|\\n\\[收听|\\nhttps?://|$)`);
    const match = body.match(regex);
    if (match) return match[1].trim();
  }
  return '';
}

function extractTagField(body, fieldNames, prefix) {
  const raw = extractField(body, fieldNames);
  if (!raw) return [];

  const prefixedRegex = new RegExp(`#${prefix}\\/([^\\s#]+)`, 'g');
  const prefixedTags = [...raw.matchAll(prefixedRegex)].map(match => match[1].trim()).filter(Boolean);
  if (prefixedTags.length > 0) return prefixedTags;

  return raw
    .split(/[\s,，、]+/)
    .map(tag => tag.replace(/^#?(?:人物|话题)\//, '').trim())
    .filter(Boolean);
}

function extractInlineRelevance(body) {
  const match = body.match(/\*\*和你有关[：:]\*\*\s*([\s\S]*?)(?=\nhttps?:\/\/|\n\*\*|\n### |\n## |$)/);
  return match ? match[1].trim() : '';
}

function normalizeSectionName(value) {
  return value.replace(/精选/g, '').trim();
}

function parseEntries(sectionText, sectionType) {
  const entryBlocks = [...sectionText.matchAll(/### (.+?)\n([\s\S]*?)(?=\n### |\n## |$)/g)];
  return entryBlocks.map(match => {
    const nameLine = match[1].trim();
    const body = match[2].trim();

    const [rawName, ...titleParts] = nameLine.split(/\s*—\s*/);
    let name = rawName.replace(/\*\*/g, '').trim();
    let title = titleParts.join(' — ');

    const explicitTags = [...nameLine.matchAll(/#([^\s]+)/g)].map(tagMatch => tagMatch[1]);
    name = name.replace(/#[^\s]+/g, '').trim();
    title = title.replace(/#[^\s]+/g, '').trim();

    let profileBio = extractField(body, ['人物简介']);
    let personTags = extractTagField(body, ['人物标签'], '人物');
    
    // 尝试从本地档案中补全简介或标签
    const profile = findBuilderProfileByName(name);
    if (profile) {
      if (sectionType === 'builders' && !title) title = profile.title;
      if (!profileBio) profileBio = profile.bio;
      if (!personTags || personTags.length === 0) personTags = profile.personTags;
    }

    const topicTags = extractTagField(body, ['内容标签'], '话题');
    const originalText = extractAllFieldsJoin(body, ['原文', '原文引用']);
    const chineseInterpretation = extractAllFieldsJoin(body, ['中文解读', '详细解读', '原文要点', '核心摘要', '深度摘要']);
    const tldr = extractAllFieldsJoin(body, ['大白话']);
    const proViews = [...body.matchAll(/🟢\s*(?:\*\*[^*]+\*\*\s*)?(.*?)(?=\n🔴|\n🎯|\n\*\*|\n(?:https|\[|---)|$)/gs)].map(m => m[1].trim());
    const conViews = [...body.matchAll(/🔴\s*(?:\*\*[^*]+\*\*\s*)?(.*?)(?=\n🎯|\n\*\*|\n(?:https|\[|---)|$)/gs)].map(m => m[1].trim());
    const clues = [...body.matchAll(/🎯\s*(?:\*\*[^*]+\*\*\s*)?(.*?)(?=\n\*\*|\n(?:https|\[|---)|$)/gs)].map(m => m[1].trim());
    const links = [...body.matchAll(/https?:\/\/[^\s)]+/g)].map(link => link[0]);

    return {
      type: sectionType,
      name,
      title,
      profileBio,
      personTags,
      topicTags,
      explicitTags,
      originalText,
      chineseInterpretation,
      tldr,
      relevance: extractInlineRelevance(body),
      proView: proViews.join('\n\n---\n\n'),
      conView: conViews.join('\n\n---\n\n'),
      clue: clues.join('\n\n---\n\n'),
      links
    };
  });
}

function deriveDate(frontmatter, md) {
  if (frontmatter.date) return frontmatter.date;

  const isoMatch = md.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})/);
  if (!isoMatch) return '';

  return [
    isoMatch[1],
    isoMatch[2].padStart(2, '0'),
    isoMatch[3].padStart(2, '0')
  ].join('-');
}

export function parseDigestDocument(md) {
  const { attrs, body } = extractFrontmatter(md);
  const titleMatch = body.match(/^#\s*(.+)$/m);
  const introMatch = body.match(/^>\s+(.+)$/m);
  const { groups: roleSuggestions } = extractRoleSuggestions(body);

  const builderSection = extractSection(body, /^##\s+X\s*\/\s*Twitter(?:\s+精选)?/m);
  const blogSection = extractSection(body, /^##\s+(?:官方博客|博客)(?:\s+精选)?/m);
  const podcastSection = extractSection(body, /^##\s+播客(?:\s+精选)?/m);

  return {
    frontmatter: attrs,
    date: deriveDate(attrs, body),
    title: titleMatch ? titleMatch[1].trim() : '',
    intro: introMatch ? introMatch[1].trim() : '',
    roleSuggestions,
    sections: {
      builders: parseEntries(builderSection, 'builders'),
      blogs: parseEntries(blogSection, 'blogs'),
      podcasts: parseEntries(podcastSection, 'podcasts')
    }
  };
}
