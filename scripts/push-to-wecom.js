#!/usr/bin/env node

/**
 * push-to-wecom.js
 *
 * 将早报 Markdown 推送到企微群机器人。
 *
 * 用法：
 *   node push-to-wecom.js --file output/2026-04-04-wecom-v2.md
 *   node push-to-wecom.js --mode markdown --file output/2026-04-04-wecom-v2.md
 *   node push-to-wecom.js --file output/2026-04-04-wecom-v2.md --dry-run
 *
 * 其他选项：
 *   --webhook <url>    自定义 Webhook 地址
 *   --dry-run          只预览不实际推送
 */

import fs from 'fs';
import 'dotenv/config';

// ─── 默认 Webhook ──────────────────────────────────────
const DEFAULT_WEBHOOK = process.env.WECOM_WEBHOOK_URL || '';

// ─── 解析参数 ──────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { mode: 'markdown', file: null, webhook: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) opts.mode = args[++i];
    if (args[i] === '--file' && args[i + 1]) opts.file = args[++i];
    if (args[i] === '--webhook' && args[i + 1]) opts.webhook = args[++i];
    if (args[i] === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

// ─── 发送通用 payload 到企微 ───────────────────────────
async function sendPayload(payload, webhookUrl, label) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (result.errcode === 0) {
    console.error(`✅ ${label} 推送成功`);
  } else {
    console.error(`❌ ${label} 推送失败: errcode=${result.errcode}, errmsg=${result.errmsg}`);
  }
  return result;
}

// ─── 主逻辑 ───────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const webhookUrl = opts.webhook || process.env.WECOM_WEBHOOK_URL || DEFAULT_WEBHOOK;

  console.error(`推送到: ${webhookUrl.replace(/key=.{8}/, 'key=****')}`);
  console.error(`模式: ${opts.mode}`);

  if (opts.mode !== 'markdown') {
    console.error('Error: 仅支持 --mode markdown');
    process.exit(1);
  }

  if (!opts.file) {
    console.error('Error: --file 参数不能为空');
    process.exit(1);
  }

  const content = fs.readFileSync(opts.file, 'utf-8');
  const bytes = Buffer.byteLength(content, 'utf-8');
  console.error(`Markdown: ${bytes} 字节`);

  if (bytes > 4096) {
    console.error(`Warning: 超过 4096 字节限制 (${bytes})，可能被截断。`);
  }

  const mdPayload = { msgtype: 'markdown_v2', markdown_v2: { content } };

  if (opts.dryRun) {
    console.error('[dry-run] Markdown:');
    console.error(content.slice(0, 200) + '...');
    console.log(JSON.stringify([]));
    return;
  }

  const result = await sendPayload(mdPayload, webhookUrl, 'Markdown');
  console.log(JSON.stringify({ type: 'markdown_v2', ...result }));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
