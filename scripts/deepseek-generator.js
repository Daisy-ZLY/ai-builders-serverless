#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs/promises';

const preparedPath = process.env.AI_BUILDERS_PREPARED_PATH;
if (!preparedPath) {
  console.error('Missing AI_BUILDERS_PREPARED_PATH');
  process.exit(1);
}

const prepared = JSON.parse(await fs.readFile(preparedPath, 'utf-8'));
const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  console.error('Missing DEEPSEEK_API_KEY environment variable. Please add it to .env');
  process.exit(1);
}

const snapshotDate = prepared.stats?.snapshotDate || new Date().toISOString().slice(0, 10);

// Helper to call DeepSeek
async function callDeepSeek(messages, temperature = 0.3) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content.trim();
  if (content.startsWith('```json')) {
    content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/^```\n/, '').replace(/\n```$/, '');
  }
  return JSON.parse(content);
}

// Concurrency helper
async function pMap(items, mapper, concurrency = 5) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array(concurrency).fill(null).map(async () => {
    while (i < items.length) {
      const index = i++;
      try {
        results[index] = await mapper(items[index], index);
      } catch (err) {
        console.error(`Error mapping item ${index}:`, err.message);
        results[index] = null;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// 1. Map: Process Builders
async function processBuilder(builder) {
  const systemPrompt = `你是一个资深的 AI 行业观察者和前端工程专家。
请对以下推文进行深度解读。
如果推文是闲聊、生活照等没有实质内容的水推，请返回 {"isWater": true}。
如果是有价值的推文（技术洞察、产品发布、行业观点），请严格按照以下 JSON Schema 输出：
{
  "isWater": false,
  "name": "string",
  "title": "string",
  "originalText": "string (保留最有价值的推文原文，合并多条)",
  "chineseInterpretation": "string (2-4 句话的专业解读。用自然的中文，像懂行的朋友在聊天。技术术语保留英文如 AI, LLM, agent, MCP 等。人名保留英文。)",
  "tldr": "string (大白话：1-2 句话，用最通俗、接地气的语言重新说一遍核心意思，让完全不懂技术的人也能秒懂，可以使用比喻。)",
  "proView": "string (如果他说得对：推演这个观点成立后的影响。仅在原文有明确观点、预测时添加，否则留空。注意：不要包含 emoji)",
  "conView": "string (但另一面是：提出合理的反驳、例外或历史翻车案例。仅在原文有明确观点、预测时添加，否则留空。注意：不要包含 emoji)",
  "clue": "string (判断线索：帮读者自己判断的关键证据或指标。仅在原文有明确观点、预测时添加，否则留空。注意：不要包含 emoji)",
  "relevance": "string (高/中/低)",
  "links": ["https://..."],
  "topicTags": ["string (必须使用中文，但专有名词如Gemini、Claude保持英文原名)"],
  "personTags": ["string (必须使用中文，例如：创业者、研究员)"]
}`;

  const userPrompt = `推文作者：${builder.name} (${builder.title})
推文内容：
${JSON.stringify(builder.tweets, null, 2)}`;

  const res = await callDeepSeek([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]);
  return res.isWater ? null : res;
}

// 2. Map: Process Blogs
async function processBlog(blog) {
  const systemPrompt = `你是一个资深的 AI 行业观察者。请对以下博客进行深度解读，返回 JSON：
{
  "name": "string",
  "title": "string",
  "chineseInterpretation": "string (2-4 句话的专业解读)",
  "tldr": "string (大白话：1-2 句话)",
  "links": ["https://..."],
  "topicTags": ["string (必须使用中文，但专有名词如Gemini、Claude保持英文原名)"]
}`;
  const res = await callDeepSeek([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify(blog, null, 2) }
  ]);
  return res;
}

// 3. Map: Process Podcasts
async function processPodcast(podcast) {
  const systemPrompt = `你是一个资深的 AI 行业观察者。请对以下播客进行深度解读，返回 JSON：
{
  "name": "string",
  "title": "string",
  "chineseInterpretation": "string (核心摘要：2-4 句话)",
  "tldr": "string (大白话：1-2 句话)",
  "links": ["https://..."],
  "topicTags": ["string (必须使用中文，但专有名词如Gemini、Claude保持英文原名)"]
}`;
  const res = await callDeepSeek([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify(podcast, null, 2) }
  ]);
  return res;
}

async function main() {
  // Map phase
  const builders = (await pMap(prepared.x || [], processBuilder, 5)).filter(Boolean);
  const blogs = (await pMap(prepared.blogs || [], processBlog, 3)).filter(Boolean);
  const podcasts = (await pMap(prepared.podcasts || [], processPodcast, 3)).filter(Boolean);

  // Reduce phase
  const reduceSystemPrompt = `你是一个资深的 AI 行业观察者和前端工程专家。
以下是今天精编后的 AI 早报内容。
请为这份早报生成全局的导语（intro）以及针对前端 TL、服务端架构师、高级产品经理的行动建议（roleSuggestions）。
严格按照以下 JSON Schema 输出：
{
  "title": "string (AI早报：...)",
  "intro": "string (今日焦点：...)",
  "roleSuggestions": [
    {
      "roleId": "frontend|backend|product",
      "roleLabel": "前端 TL 视角|服务端架构师视角|高级产品经理视角",
      "items": [
        {
          "title": "string",
          "summary": "string (一句话理解)",
          "implication": "string (对你意味着什么：站在该角色的高维视角提供建议)",
          "sourceUrl": "string"
        }
      ],
      "actions": ["string (可执行的落地动作，如技术调研、架构复盘等)"]
    }
  ]
}
注意：roleSuggestions 必须包含 frontend、backend、product 三个角色。`;

  const reduceUserPrompt = JSON.stringify({ builders, blogs, podcasts }, null, 2);
  
  const summary = await callDeepSeek([
    { role: 'system', content: reduceSystemPrompt },
    { role: 'user', content: reduceUserPrompt }
  ]);

  // Combine
  const finalDigest = {
    date: snapshotDate,
    title: summary.title || `${snapshotDate} — AI Builders 早报`,
    intro: summary.intro || '今日焦点...',
    builders,
    blogs,
    podcasts,
    roleSuggestions: summary.roleSuggestions || []
  };

  process.stdout.write(JSON.stringify(finalDigest, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
