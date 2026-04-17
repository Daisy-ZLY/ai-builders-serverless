import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ROLE_ID, ROLE_CONFIGS } from '../roles.js';
import { runShell } from './process-runner.js';

function resolveLatestMarkdown(contentDir) {
  if (!fs.existsSync(contentDir)) {
    throw new Error('找不到 content 目录');
  }

  const mdFiles = fs.readdirSync(contentDir)
    .filter(file => /^\d{4}-\d{2}-\d{2}\.md$/.test(file))
    .sort()
    .reverse();

  if (mdFiles.length === 0) {
    throw new Error('content/ 目录下没有找到 Markdown 文件');
  }

  return mdFiles[0];
}

export async function publishLatestDigest({ cwd = process.cwd() } = {}) {
  const contentDir = path.join(cwd, 'content');
  const outputDir = path.join(cwd, 'output');
  const latestMd = resolveLatestMarkdown(contentDir);
  const dateStr = latestMd.replace('.md', '');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const role of ROLE_CONFIGS) {
    await runShell(
      `node workflow/truncate-for-wecom.js --file "content/${latestMd}" --role ${role.id} > "output/${dateStr}-wecom-${role.id}.md"`,
      {},
      { cwd }
    );
  }

  await runShell(
    `node workflow/truncate-for-wecom.js --file "content/${latestMd}" --role ${DEFAULT_ROLE_ID} > "output/${dateStr}-wecom-v2.md"`,
    {},
    { cwd }
  );
  await runShell('npm run publish:site', {}, { cwd });

  await runShell(
    `node workflow/push-to-wecom.js --mode markdown --file "output/${dateStr}-wecom-v2.md"`,
    {},
    { cwd }
  );

  return {
    date: dateStr,
    markdownFile: path.join(contentDir, latestMd),
    outputDir
  };
}
