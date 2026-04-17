#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractRoleSuggestions } from './role-suggestions.js';
import { parseDigestDocument } from './lib/digest-document.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractField(body, fieldName) {
  const regex = new RegExp(`\\*\\*${fieldName}[：:]\\*\\*\\s*\\n?([\\s\\S]*?)(?=\\n\\*\\*|\\n\\[原文链接\\]|\\n\\[收听|\\nhttps?://|$)`, 'g');
  const match = regex.exec(body);
  return match ? match[1].trim() : '';
}

function pruneGenericTopicTags(tags = []) {
  if (!tags || tags.length <= 1) return tags || [];
  const genericTags = new Set(['ai', '人工智能', 'llm', '模型']);
  const filtered = tags.filter(tag => !genericTags.has(String(tag).toLowerCase()));
  return filtered.length > 0 ? filtered : tags;
}

const TAG_KEYWORDS = [
  { tag: 'Agent架构',    keywords: ['agent架构', 'scaffold', '脚手架', 'agent 的', 'ai agent', 'box agent'] },
  { tag: '知识管理',     keywords: ['知识库', 'wiki', 'knowledge base', 'obsidian', '知识编译'] },
  { tag: 'LLM工作流',   keywords: ['llm 构建', 'llm 即', '工作流', '知识编译器', '图书管理员'] },
  { tag: '开发工具',     keywords: ['cursor', 'ide', '编码工具', '编程工具', '编辑器', 'vibe check'] },
  { tag: '设计理念',     keywords: ['设计宣言', 'design', 'glass vs', '透明玻璃', 'ui 的'] },
  { tag: '产品工程',     keywords: ['企业级', '工程成本', 'box agent', '模型变强'] },
  { tag: '开源安全',     keywords: ['安全漏洞', 'security', '漏洞报告', 'vulnerability', '开源项目'] },
  { tag: 'AI影响',       keywords: ['双刃剑', '维护者', '撑不住', '淹没'] },
  { tag: '产品评测',     keywords: ['评测', 'vibe check', '深度评测', '一周体验'] },
  { tag: 'UX设计',       keywords: ['新界面', '简洁方向', '满屏按钮', '对话框才是', 'discoverability'] },
  { tag: '桌面AI',       keywords: ['computer use', '桌面', 'desktop', '操控桌面'] },
  { tag: '产品发布',     keywords: ['正式发布', '宣布', '现已支持', '扩展到'] },
  { tag: 'AI产品',       keywords: ['perplexity', 'quite special'] },
  { tag: '搜索引擎',     keywords: ['perplexity', '搜索引擎'] },
  { tag: '生物科技',     keywords: ['bioworks', 'ginkgo', '蛋白质', '生物技术'] },
  { tag: 'AI科研',       keywords: ['autonomous lab', '自主实验室', 'ai 科学家', '机器人实验室'] },
];

function inferTags(builder) {
  const matched = [];
  
  if (builder.topicTags && builder.topicTags.length > 0) {
    matched.push(...builder.topicTags);
  } else if (builder.explicitTags && builder.explicitTags.length > 0) {
    matched.push(...builder.explicitTags);
  }

  if (matched.length < 2) {
    const text = `${builder.name} ${builder.title} ${builder.tldr} ${builder.summary} ${builder.analysis}`.toLowerCase();
    for (const { tag, keywords } of TAG_KEYWORDS) {
      if (keywords.some(kw => text.includes(kw.toLowerCase())) && !matched.includes(tag)) {
        matched.push(tag);
      }
    }
  }
  
  return pruneGenericTopicTags(matched).slice(0, 2);
}

function parseMD(md) {
  const digest = parseDigestDocument(md);
  const { intro: relevanceIntro, groups: roleSuggestions, isRoleSpecific } = extractRoleSuggestions(md);

  // Apply inferTags to all entries
  const processEntries = (entries) => {
    return (entries || []).map(entry => ({
      ...entry,
      topicTags: inferTags(entry)
    }));
  };

  return {
    dateStr: digest.title || digest.date,
    twitterBuilders: processEntries(digest.sections.builders),
    blogs: processEntries(digest.sections.blogs),
    podcasts: processEntries(digest.sections.podcasts),
    relevanceIntro,
    roleSuggestions,
    isRoleSpecific
  };
}

function main() {
  const contentDir = 'content';
  const outDir = 'docs/api';
  
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const mdFiles = fs.readdirSync(contentDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();

  if (mdFiles.length === 0) {
    console.error('❌ content/ 下没有找到日报文件');
    process.exit(1);
  }

  const indexEntries = [];
  const searchEntries = [];

  for (const file of mdFiles) {
    const md = fs.readFileSync(path.join(contentDir, file), 'utf-8');
    const data = parseMD(md);
    const basename = file.replace('.md', '');
    
    // Write individual date JSON
    const outPath = path.join(outDir, `${basename}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ 已生成: ${outPath}`);

    // Copy raw markdown file
    const mdOutDir = path.join('docs', 'md');
    if (!fs.existsSync(mdOutDir)) {
      fs.mkdirSync(mdOutDir, { recursive: true });
    }
    const mdOutPath = path.join(mdOutDir, `${basename}.md`);
    fs.copyFileSync(path.join(contentDir, file), mdOutPath);
    console.log(`✅ 已复制 Markdown: ${mdOutPath}`);

    // Add to index
    const allBuilders = [...data.twitterBuilders, ...data.blogs, ...data.podcasts];
    
    // Extract top tags for the title if needed
    const allTags = [];
    allBuilders.forEach(b => allTags.push(...(b.topicTags || [])));
    const tagCounts = {};
    allTags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);
      
    let mainTitle = topTags.length > 0 ? topTags.join(' · ') : '今日 AI 构建';
    if (data.dateStr.includes('—')) {
      const parts = data.dateStr.split('—');
      if (parts.length > 1 && parts[1].trim()) {
        mainTitle = parts[1].trim();
      }
    }

    indexEntries.push({
      date: basename,
      title: mainTitle,
      stats: {
        builders: data.twitterBuilders.length,
        tweets: data.twitterBuilders.reduce((sum, b) => sum + (b.links?.length || 0), 0),
        blogs: data.blogs.length,
        podcasts: data.podcasts.length
      }
    });

    const allEntries = [
      ...(data.twitterBuilders || []),
      ...(data.blogs || []),
      ...(data.podcasts || [])
    ];

    allEntries.forEach((entry, index) => {
      searchEntries.push({
        date: basename,
        index: index + 1,
        name: entry.name,
        title: entry.title || '',
        tags: entry.topicTags || [],
        tldr: entry.tldr || '',
        summary: entry.chineseInterpretation || '',
        links: entry.links || []
      });
    });
  }

  // Write index.json
  const indexPath = path.join(outDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalEntries: indexEntries.length,
    entries: indexEntries
  }, null, 2), 'utf-8');
  console.log(`✅ 已生成全局索引: ${indexPath}`);

  const searchIndexPath = path.join(outDir, 'search-index.json');
  fs.writeFileSync(searchIndexPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalEntries: searchEntries.length,
    entries: searchEntries
  }, null, 2), 'utf-8');
  console.log(`✅ 已生成搜索索引: ${searchIndexPath}`);
}

main();
