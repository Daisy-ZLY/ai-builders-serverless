#!/usr/bin/env node

/**
 * truncate-for-wecom.js  (v2)
 *
 * 企微摘要截断脚本 — markdown_v2 版
 *
 * 改动点（相对 v1）：
 *   - 输出格式改为 markdown_v2（支持 # 标题、链接、列表、分割线）
 *   - 分层结构：🔥 今日必看 → 📡 动态 → 🎙️ 播客/博客 → 🎯 落地建议
 *   - 每条：人名 + 一句话 + 链接独立成行
 *   - 提取角色标签（tags），按权重排序
 *   - 链接用 [🔗原文](url) 格式（emoji+中文，企微解析最稳定）
 *
 * 用法：
 *   cat 早报.md | node truncate-for-wecom.js
 *   node truncate-for-wecom.js --file 早报.md
 *   node truncate-for-wecom.js --file 早报.md --role backend-architect
 *   node truncate-for-wecom.js --json
 */

import fs from 'fs';
import 'dotenv/config';
import { buildRoleUrl, getRoleConfig, normalizeRoleId } from './roles.js';
import { getRoleSuggestionGroup } from './role-suggestions.js';
import { parseDigestDocument } from './lib/digest-document.js';

// ─── 常量 ─────────────────────────────────────────────
const WECOM_BYTE_LIMIT = 4096;

// 各模块的条目上限（优先保证单条完整度）
const MAX_HIGHLIGHTS = 3;    // 今日必看最多 3 条
const MAX_BUILDERS = 0;      // 动态最多 0 条（不含必看）
const MAX_PODCASTS = 0;      // 播客最多 0 条
const MAX_BLOGS = 0;         // 博客最多 0 条
const MAX_RELEVANCE = 0;     // 落地建议最多 0 条
const MAX_FULL_DISPLAY = 3;  // 完整展示（带大白话）的条目数，其余只显示一行标题

// ─── 解析参数 ─────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { json: false, file: null, role: 'frontend-tl' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') opts.json = true;
    if (args[i] === '--file' && args[i + 1]) opts.file = args[++i];
    if (args[i] === '--role' && args[i + 1]) opts.role = args[++i];
  }
  return opts;
}

// ─── 读取输入 ─────────────────────────────────────────
async function readInput(opts) {
  if (opts.file) {
    return fs.readFileSync(opts.file, 'utf-8');
  }
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => {
      if (!data) {
        console.error('Error: 没有输入。请通过 --file 指定文件或通过 stdin 管道传入。');
        process.exit(1);
      }
    }, 3000);
  });
}

// ─── 工具函数 ─────────────────────────────────────────
function byteLen(str) {
  return Buffer.byteLength(str, 'utf-8');
}

// 清理文本中可能干扰企微 markdown 链接解析的特殊字符
function sanitizeForWecom(text) {
  // 成对替换英文双引号为中文引号
  let result = text;
  let isOpen = true;
  result = result.replace(/"/g, () => {
    const q = isOpen ? '\u201C' : '\u201D';
    isOpen = !isOpen;
    return q;
  });
  return result;
}

// ─── 提取标题中的日期 ─────────────────────────────────
function extractDate(md) {
  const m = md.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) return { year: m[1], month: m[2], day: m[3], display: `${m[2]}月${m[3]}日` };
  const iso = md.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { year: iso[1], month: String(+iso[2]), day: String(+iso[3]), display: `${+iso[2]}月${+iso[3]}日` };
  const now = new Date();
  return { year: String(now.getFullYear()), month: String(now.getMonth() + 1), day: String(now.getDate()), display: `${now.getMonth() + 1}月${now.getDate()}日` };
}

// ─── 提取 Builder 段落 ───────────────────────────────
function extractBuilderSections(md) {
  const digest = parseDigestDocument(md);
  return digest.sections.builders.map(entry => ({
    name: entry.name,
    role: entry.title || '',
    tldr: entry.tldr ? entry.tldr.replace(/\n+/g, ' ').trim() : '',
    links: entry.links || [],
    tags: entry.topicTags?.length ? entry.topicTags : (entry.explicitTags || []).map(tag => tag.replace(/^话题\//, '')),
    highlight: false,
    type: 'builder'
  }));
}

// ─── 提取博客/播客 ───────────────────────────────────
function extractContentSections(md, sectionType) {
  const digest = parseDigestDocument(md);
  const entries = sectionType === 'blog' ? digest.sections.blogs : digest.sections.podcasts;

  return entries.map(entry => ({
    name: entry.title ? `${entry.name} — ${entry.title}` : entry.name,
    tldr: entry.tldr ? entry.tldr.replace(/\n+/g, ' ').trim() : (entry.chineseInterpretation || ''),
    links: entry.links || [],
    tags: entry.topicTags?.length ? entry.topicTags : (entry.explicitTags || []).map(tag => tag.replace(/^话题\//, '')),
    type: sectionType
  }));
}

// ─── 提取内容标签 ────────────────────────────────────
function extractTags(block) {
  const topicLineMatch = block.match(/\*\*内容标签[：:]\*\*\s*\n?([^\n]+)/);
  if (topicLineMatch) {
    const topicTags = [...topicLineMatch[1].matchAll(/#话题\/([^\s]+)/g)].map(match => match[1].trim()).filter(Boolean);
    if (topicTags.length > 0) return topicTags;
  }

  // 兼容旧结构：从标题行内 #话题/ 提取
  const legacyTags = [...block.matchAll(/#话题\/([^\s]+)/g)].map(match => match[1].trim()).filter(Boolean);
  if (legacyTags.length > 0) return legacyTags;

  // 兼容更早的 `标签` 文本格式
  const tagMatch = block.match(/(?:tags|标签)[：:]\s*(.+)/i);
  if (tagMatch) {
    return tagMatch[1].split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean);
  }

  const inlineTags = [];
  const inlineMatch = block.matchAll(/`(前端|后端|产品|通用|工具|架构|安全|知识管理|AI|设计|效率|团队)`/g);
  for (const m of inlineMatch) {
    inlineTags.push(m[1]);
  }
  if (inlineTags.length > 0) return inlineTags;

  // 默认返回通用
  return ['通用'];
}

// ─── 提取"和你有关" / 落地建议 ────────────────────────
function extractRelevance(md, roleId) {
  const group = getRoleSuggestionGroup(md, roleId);
  return group.items.map(item => ({
    title: item.title,
    detail: item.summary + " " + item.implication
  }));
}

// ─── 角色权重排序 ────────────────────────────────────
function sortByRoleRelevance(sections, role, relevance = []) {
  const roleConfig = getRoleConfig(role);
  const keywords = roleConfig.keywords || ['通用'];

  // 提取大模型推荐的标题和内容，用于加分
  const recommendedText = relevance.map(r => `${r.title} ${r.detail}`.toLowerCase());

  // 计算每条的角色相关度得分
  return sections.map(s => {
    let score = 0;
    
    // 1. 如果这条推文被大模型选中放进了“和你有关”，加 100 分！
    // 我们通过推文作者名字来匹配
    const builderName = s.name.toLowerCase().split(' ')[0]; // 取名字的第一个词，比如 "Zara"
    for (const recText of recommendedText) {
      if (recText.includes(builderName) || recText.includes(s.name.toLowerCase())) {
        score += 100;
        break;
      }
    }

    // 2. 原有的基础关键词匹配
    const allText = `${s.tldr} ${(s.tags || []).join(' ')} ${s.role || ''}`.toLowerCase();
    for (const kw of keywords) {
      if (allText.includes(kw.toLowerCase())) score += 2;
    }
    if (s.highlight) score += 10;
    if ((s.tags || []).includes('通用')) score += 1;
    
    return { ...s, _score: score };
  }).sort((a, b) => {
    // 如果分数相同，保持原有顺序
    return b._score - a._score;
  });
}

function oneLineSummary(tldr) {
  if (!tldr) return '';
  // 策略：取完整第一句话（到句号/感叹号/问号为止）
  const firstSentence = tldr.match(/^(.+?[。！？!?])/);
  if (firstSentence) {
    return firstSentence[1];
  }
  // 没有标点分隔，返回完整内容（truncateToFit 会在字节层面兜底）
  return tldr;
}

// ─── 全文链接基础 URL（本地开发 / 线上切换） ─────────
const customDomain = process.env.CUSTOM_DOMAIN;
if (!customDomain) {
  throw new Error('Missing CUSTOM_DOMAIN environment variable. Please add it to .env');
}
const FULL_PAGE_BASE_URL = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;

// ─── 拼装 markdown_v2 格式（分层展示版） ─────────────
function buildWecomV2(date, builders, blogs, podcasts, relevance, roleConfig) {
  const lines = [];

  // 标题
  lines.push(`# 📌 ${date.display} AI Builders 早报`);
  lines.push('');

  // ── 按优先级分层：前 N 条完整展示 ──
  const fullDisplay = builders.slice(0, MAX_FULL_DISPLAY);

  // 完整展示区（带大白话）
  if (fullDisplay.length > 0) {
    for (const b of fullDisplay) {
      lines.push(`**${b.name}**${b.role ? ' — ' + b.role : ''}`);
      const link = (b.links && b.links.length > 0) ? ` [🔗原文](${b.links[0]})` : '';
      lines.push(sanitizeForWecom(b.tldr) + link);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  // 🎙️ 播客（也用简洁模式，一行标题 + 大白话前两句）
  if (podcasts.length > 0) {
    lines.push('## 🎙️ 播客');
    lines.push('');
    for (const p of podcasts) {
      lines.push(`**${p.name}**`);
      // 播客保留完整大白话（通常只有 1 条）
      const link = (p.links && p.links.length > 0) ? ` [🔗原文](${p.links[0]})` : '';
      lines.push(sanitizeForWecom(p.tldr) + link);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  // 📝 博客
  if (blogs.length > 0) {
    lines.push('## 📝 博客');
    lines.push('');
    for (const b of blogs) {
      lines.push(`**${b.name}**`);
      const link = (b.links && b.links.length > 0) ? ` [🔗原文](${b.links[0]})` : '';
      lines.push(sanitizeForWecom(b.tldr) + link);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  // 🎯 落地建议
  if (relevance.length > 0) {
    lines.push('## 🎯 和你有关');
    lines.push(`当前视角：${roleConfig.label}`);
    lines.push('');
    for (let i = 0; i < relevance.length; i++) {
      lines.push(`${i + 1}. **${relevance[i].title}** — ${sanitizeForWecom(relevance[i].detail)}`);
    }
    lines.push('');
    lines.push('---');
  }

  // 全文链接
  const digestPath = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  const fullUrl = `${FULL_PAGE_BASE_URL}/${digestPath}`;
  lines.push(`> 📖 [查看完整版全文](${fullUrl})`);
  lines.push('');

  return lines.join('\n');
}

// ─── 智能截断：控数量，不截内容 ─────────────────────────
function truncateToFit(date, builders, blogs, podcasts, relevance, roleConfig) {
  // 先按总量上限裁剪（已按权重排好序，top N 自然是最相关的）
  const totalMax = MAX_FULL_DISPLAY + MAX_BUILDERS;
  let allBuilders = builders.slice(0, totalMax);
  const capPodcasts = podcasts.slice(0, MAX_PODCASTS);
  const capBlogs = blogs.slice(0, MAX_BLOGS);
  const capRelevance = relevance.slice(0, MAX_RELEVANCE);

  // 第一轮：完整版
  let summary = buildWecomV2(date, allBuilders, capBlogs, capPodcasts, capRelevance, roleConfig);
  if (byteLen(summary) <= WECOM_BYTE_LIMIT) {
    // 还有余量？尝试补回更多 builder（以一行标题模式，很省空间）
    const extras = builders.slice(totalMax);
    for (const extra of extras) {
      const tryBuilders = [...allBuilders, extra];
      const trySummary = buildWecomV2(date, tryBuilders, capBlogs, capPodcasts, capRelevance, roleConfig);
      if (byteLen(trySummary) <= WECOM_BYTE_LIMIT) {
        allBuilders = tryBuilders;
        summary = trySummary;
      } else {
        break;
      }
    }
    return { summary, truncated: builders.length > allBuilders.length, strategy: 'layered_full' };
  }

  // 第二轮：去掉落地建议
  summary = buildWecomV2(date, allBuilders, capBlogs, capPodcasts, [], roleConfig);
  if (byteLen(summary) <= WECOM_BYTE_LIMIT) {
    return { summary, truncated: true, strategy: 'layered_drop_relevance' };
  }

  // 第三轮：去掉播客和博客
  summary = buildWecomV2(date, allBuilders, [], [], [], roleConfig);
  if (byteLen(summary) <= WECOM_BYTE_LIMIT) {
    return { summary, truncated: true, strategy: 'layered_builders_only' };
  }

  // 第四轮：逐条减少一行标题区的 builder
  for (let n = allBuilders.length - 1; n >= MAX_FULL_DISPLAY; n--) {
    summary = buildWecomV2(date, allBuilders.slice(0, n), [], [], [], roleConfig);
    if (byteLen(summary) <= WECOM_BYTE_LIMIT) {
      return { summary, truncated: true, strategy: `layered_top_${n}` };
    }
  }

  // 第五轮：减少完整展示区的条目数
  for (let n = MAX_FULL_DISPLAY - 1; n >= 1; n--) {
    summary = buildWecomV2(date, allBuilders.slice(0, n), [], [], [], roleConfig);
    if (byteLen(summary) <= WECOM_BYTE_LIMIT) {
      return { summary, truncated: true, strategy: `minimal_${n}` };
    }
  }

  // 第六轮：截短大白话（极端情况兜底）
  const trimBuilders = allBuilders.slice(0, 3).map(b => ({
    ...b,
    tldr: b.tldr.length > 80 ? b.tldr.slice(0, 78) + '…' : b.tldr
  }));
  summary = buildWecomV2(date, trimBuilders, [], [], [], roleConfig);
  if (byteLen(summary) <= WECOM_BYTE_LIMIT) {
    return { summary, truncated: true, strategy: 'minimal_trimmed' };
  }

  // 硬截断兜底
  let result = summary;
  while (byteLen(result) > WECOM_BYTE_LIMIT - 100) {
    result = result.slice(0, result.length - 100);
  }
  result += '\n\n---\n*内容已截断*';
  return { summary: result, truncated: true, strategy: 'hard_truncate' };
}

// ─── 主逻辑 ───────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const md = await readInput(opts);

  // 1. 提取
  const date = extractDate(md);
  const roleId = normalizeRoleId(opts.role);
  const roleConfig = getRoleConfig(roleId);
  let builders = extractBuilderSections(md);
  const blogs = extractContentSections(md, 'blog');
  const podcasts = extractContentSections(md, 'podcast');
  const relevance = extractRelevance(md, roleId);

  // 2. 按角色排序
  builders = sortByRoleRelevance(builders, roleId, relevance);

  // 3. 截断
  const { summary, truncated, strategy } = truncateToFit(date, builders, blogs, podcasts, relevance, roleConfig);

  // 4. 输出
  if (opts.json) {
    const result = {
      date: date.display,
      role: roleId,
      roleLabel: roleConfig.label,
      stats: {
        totalBuilders: builders.length,
        builders: Math.min(builders.length, MAX_HIGHLIGHTS + MAX_BUILDERS),
        blogs: Math.min(blogs.length, MAX_BLOGS),
        podcasts: Math.min(podcasts.length, MAX_PODCASTS),
        relevance: relevance.length,
        highlights: Math.min(builders.filter(b => b._score >= 4).length, MAX_HIGHLIGHTS)
      },
      summary,
      summaryBytes: byteLen(summary),
      withinLimit: byteLen(summary) <= WECOM_BYTE_LIMIT,
      truncated,
      strategy,
      extracted: {
        builders: builders.map(b => ({ name: b.name, tags: b.tags, score: b._score, tldr: b.tldr })),
        blogs: blogs.map(b => ({ name: b.name, tldr: b.tldr })),
        podcasts: podcasts.map(p => ({ name: p.name, tldr: p.tldr })),
        relevance
      }
    };
    process.stdout.write(JSON.stringify(result, null, 2));
  } else {
    process.stdout.write(summary);
  }
}

// ─── 模块导出 ────────────────────────────────────────
export { truncateToFit, extractBuilderSections, extractContentSections, extractRelevance, byteLen, sortByRoleRelevance };

// ESM 入口：仅当直接运行时执行 main()
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
if (isMain) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
