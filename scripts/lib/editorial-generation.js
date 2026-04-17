import 'dotenv/config';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { renderRoleSuggestionsMarkdown } from '../role-suggestions.js';
import { buildQualityFeedbackMessages, validateDigestQuality } from './digest-quality.js';
import { validateDigestSchema } from './digest-schema.js';

const execFileAsync = promisify(execFile);

function buildSchemaDescription() {
  return `Return JSON only. Use this shape:
{
  "date": "YYYY-MM-DD",
  "title": "string",
  "intro": "string",
  "builders": [
    {
      "name": "string",
      "title": "string",
      "originalText": "string",
      "chineseInterpretation": "string (2-4 句话的专业解读。用自然的中文，像懂行的朋友在聊天。技术术语保留英文如 AI, LLM, agent, MCP 等。人名保留英文。)",
      "tldr": "string (大白话：1-2 句话，用最通俗、接地气的语言重新说一遍核心意思，让完全不懂技术的人也能秒懂，可以使用比喻。)",
      "proView": "string (如果他说得对：推演这个观点成立后的影响。仅在原文有明确观点、预测时添加，否则留空。注意：不要包含 emoji)",
      "conView": "string (但另一面是：提出合理的反驳、例外或历史翻车案例。仅在原文有明确观点、预测时添加，否则留空。注意：不要包含 emoji)",
      "clue": "string (判断线索：帮读者自己判断的关键证据或指标。仅在原文有明确观点、预测时添加，否则留空。注意：不要包含 emoji)",
      "relevance": "string (高/中/低)",
      "links": ["https://..."],
      "topicTags": ["string (必须使用中文，但专有名词如Gemini、Claude保持英文原名)"],
      "personTags": ["string (必须使用中文，例如：创业者、研究员)"]
    }
  ],
  "blogs": [
    {
      "name": "string",
      "title": "string",
      "chineseInterpretation": "string (2-4 句话的专业解读)",
      "tldr": "string (大白话：1-2 句话)",
      "links": ["https://..."],
      "topicTags": ["string (必须使用中文，但专有名词如Gemini、Claude保持英文原名)"]
    }
  ],
  "podcasts": [
    {
      "name": "string",
      "title": "string",
      "chineseInterpretation": "string (核心摘要：2-4 句话)",
      "tldr": "string (大白话：1-2 句话)",
      "links": ["https://..."],
      "topicTags": ["string (必须使用中文，但专有名词如Gemini、Claude保持英文原名)"]
    }
  ],
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

重要规则：
1. chineseInterpretation 必须有深度，像懂行的朋友在聊天，不要像机器翻译。
2. tldr 必须接地气，大白话。
3. proView, conView, clue 是【辩证视角】的三要素，必须基于原文进行深度推演和反驳，不要敷衍。如果原文只是普通的产品发布，这三个字段可以为空。
4. roleSuggestions 必须包含 frontend、backend、product 三个角色。每个角色的 implication 必须有深度，actions 必须是具体的落地动作（如发起技术调研、组织设计评审等）。
`;
}

function compactPreparedInput(prepared) {
  return JSON.stringify({
    config: prepared.config,
    stats: prepared.stats,
    x: prepared.x,
    blogs: prepared.blogs,
    podcasts: prepared.podcasts
  }, null, 2);
}

export function buildEditorialMessages(prepared) {
  const systemPrompt = `你是一个资深的 AI 行业观察者和前端工程专家。你的任务是将一份基础格式的 AI 资讯早报数据，精编为高质量的中文早报 JSON。
请严格遵循以下处理规则：

1. 逐条处理每个 Builder 的内容。
2. **过滤水推**：过滤掉没有实质内容的闲聊、生活照等。只保留有技术洞察、产品发布、行业观点的推文。如果某个 Builder 只有水推，直接忽略该 Builder。
3. 对于保留的推文，必须严格按照以下 JSON Schema 输出，并保证内容的深度和质量：

${buildSchemaDescription()}
`;

  const user = [
    '# Prepared Input',
    compactPreparedInput(prepared)
  ].join('\n\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: user }
  ];
}

export function stripJsonFences(text) {
  return String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export class DigestResponseError extends Error {
  constructor(message, details = {}) {
    super(message, details.cause ? { cause: details.cause } : undefined);
    this.name = 'DigestResponseError';
    this.kind = details.kind || 'unknown';
    this.rawResponse = details.rawResponse || '';
    this.cleanedResponse = details.cleanedResponse || '';
    this.validationErrors = details.validationErrors || [];
  }
}

export function parseDigestResponse(text) {
  const rawResponse = String(text || '');
  const cleanedResponse = stripJsonFences(rawResponse);

  let digest;
  try {
    digest = JSON.parse(cleanedResponse);
  } catch (error) {
    throw new DigestResponseError(`Digest response JSON parse failed: ${error.message}`, {
      kind: 'parse',
      rawResponse,
      cleanedResponse,
      cause: error
    });
  }

  const validation = validateDigestSchema(digest);
  if (!validation.valid) {
    throw new DigestResponseError(`Digest response schema validation failed: ${validation.summary}`, {
      kind: 'schema',
      rawResponse,
      cleanedResponse,
      validationErrors: validation.errors
    });
  }

  return digest;
}

function renderEntry(entry, options = {}) {
  const titleSuffix = entry.title ? ` — ${entry.title}` : '';
  const topicTags = (entry.topicTags || []).map(tag => `#话题/${tag.replace(/\s+/g, '')}`).join(' ');
  const headingTail = topicTags ? ` ${topicTags}` : '';
  const lines = [`### ${entry.name}${titleSuffix}${headingTail}`, ''];

  if (entry.originalText) {
    lines.push('**原文：**');
    const quoted = entry.originalText.split('\n').map(line => `> ${line}`).join('\n');
    lines.push(quoted);
    lines.push('');
  }
  if (entry.chineseInterpretation) {
    lines.push(`**中文解读：**\n${entry.chineseInterpretation}`);
    lines.push('');
  }
  if (entry.tldr) {
    lines.push(`**大白话：**\n${entry.tldr}`);
    lines.push('');
  }
  if (entry.proView || entry.conView || entry.clue) {
    lines.push('**辩证视角：**');
    if (entry.proView) lines.push(`🟢 如果他说得对：${entry.proView.replace(/^如果他说得对：/, '')}`);
    if (entry.conView) lines.push(`🔴 但另一面是：${entry.conView.replace(/^但另一面是：/, '')}`);
    if (entry.clue) lines.push(`🎯 判断线索：${entry.clue.replace(/^判断线索：/, '')}`);
    lines.push('');
  }
  if (entry.relevance) {
    lines.push(`**和你有关：** ${entry.relevance}`);
    lines.push('');
  }
  for (const link of entry.links || []) {
    lines.push(link);
  }
  lines.push('');
  if (options.withDivider) {
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

export function renderDigestMarkdown(digest) {
  const lines = [
    '---',
    `title: "${digest.date} — AI Builders 早报"`,
    `date: ${digest.date}`,
    `description: "${digest.intro || 'AI 精编版本。过滤水推，提炼洞察，提供行动建议。'}"`,
    '---',
    '',
    `> ${digest.intro || 'AI 精编版本。过滤水推，提炼洞察，提供行动建议。'}`
  ];

  if ((digest.builders || []).length > 0) {
    lines.push('');
    lines.push('## X / Twitter');
    lines.push('');
    lines.push(digest.builders.map((entry, index, arr) => renderEntry(entry, { withDivider: index < arr.length - 1 })).join('\n'));
  }

  if ((digest.blogs || []).length > 0) {
    lines.push('');
    lines.push('## 官方博客');
    lines.push('');
    lines.push(digest.blogs.map((entry, index, arr) => renderEntry(entry, { withDivider: index < arr.length - 1 })).join('\n'));
  }

  if ((digest.podcasts || []).length > 0) {
    lines.push('');
    lines.push('## 播客');
    lines.push('');
    lines.push(digest.podcasts.map((entry, index, arr) => renderEntry(entry, { withDivider: index < arr.length - 1 })).join('\n'));
  }

  if ((digest.roleSuggestions || []).length > 0) {
    lines.push('');
    lines.push(renderRoleSuggestionsMarkdown(digest.roleSuggestions));
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Generated by AI Builders Daily editorial engine*');

  return lines.join('\n');
}

export async function generateDigestDraft(prepared, { complete }) {
  const messages = buildEditorialMessages(prepared);
  const response = await complete({ messages, prepared });
  const digest = parseDigestResponse(response.text);
  const markdown = renderDigestMarkdown(digest);
  return { digest, markdown, rawResponse: response.text };
}

export async function generateGuardedDigestDraft(prepared, {
  complete,
  maxRounds = 2
}) {
  let messages = buildEditorialMessages(prepared);
  let response = null;
  let digest = null;
  let markdown = null;
  let quality = null;

  for (let round = 1; round <= maxRounds; round += 1) {
    response = await complete({ messages, prepared, draft: digest, quality });
    digest = parseDigestResponse(response.text);
    markdown = renderDigestMarkdown(digest);
    quality = validateDigestQuality(digest, prepared);

    if (quality.passed) {
      return { digest, markdown, rawResponse: response.text, quality, rounds: round };
    }

    if (round < maxRounds) {
      messages = buildQualityFeedbackMessages(prepared, digest, quality);
    }
  }

  return { digest, markdown, rawResponse: response?.text || '', quality, rounds: maxRounds };
}

export async function completeWithCommand({
  prepared,
  messages,
  command,
  cwd = process.cwd(),
  env = process.env
}) {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error('Local generator command must be a non-empty array');
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builders-generator-'));
  const preparedPath = path.join(tempDir, 'prepared.json');
  const messagesPath = path.join(tempDir, 'messages.json');

  await fs.writeFile(preparedPath, JSON.stringify(prepared, null, 2), 'utf-8');
  await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2), 'utf-8');

  try {
    const { stdout, stderr } = await execFileAsync(command[0], command.slice(1), {
      cwd,
      env: {
        ...env,
        AI_BUILDERS_PREPARED_PATH: preparedPath,
        AI_BUILDERS_MESSAGES_PATH: messagesPath
      },
      maxBuffer: 10 * 1024 * 1024
    });

    if (stderr && !stdout) {
      throw new Error(stderr.trim());
    }

    return { text: stdout.trim() };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export function resolveGenerationConfig() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_BASE_URL && process.env.GEMINI_MODEL) {
    return {
      provider: 'gemini-openai-compatible',
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: process.env.GEMINI_BASE_URL.replace(/\/$/, ''),
      model: process.env.GEMINI_MODEL
    };
  }

  throw new Error('No supported editorial generation model configured');
}

function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function completeWithModelConfig({
  config,
  messages,
  fetchImpl = fetch,
  sleepImpl = defaultSleep
}) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const isTransient = response.status === 429 || response.status >= 500;
      if (isTransient && attempt < maxAttempts) {
        await sleepImpl(1000 * attempt);
        continue;
      }
      throw new Error(`Editorial generation failed (${response.status})`);
    }

    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Editorial generation returned empty content');
    }

    return { text };
  }

  throw new Error('Editorial generation failed after retries');
}

export async function completeWithConfiguredModel({ messages }) {
  const config = resolveGenerationConfig();
  return completeWithModelConfig({ config, messages });
}
