import fs from 'node:fs/promises';
import path from 'node:path';
import { runCommand, runShell } from './process-runner.js';

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function publishDigestArtifacts({
  date,
  markdown,
  digest,
  prepared,
  contentDir,
  generatedDir,
  archiveDir,
  skipBuild = false,
  publishCmd = null,
  cwd = process.cwd()
}) {
  await Promise.all([
    ensureDir(contentDir),
    ensureDir(generatedDir),
    ensureDir(archiveDir)
  ]);

  const markdownPath = path.join(contentDir, `${date}.md`);
  const archiveMarkdownPath = path.join(archiveDir, `${date}.md`);
  const dateGeneratedDir = path.join(generatedDir, date);
  await ensureDir(dateGeneratedDir);
  const digestJsonPath = path.join(dateGeneratedDir, 'digest.json');
  const preparedJsonPath = path.join(dateGeneratedDir, 'prepared.json');

  await fs.writeFile(markdownPath, `${markdown}\n`, 'utf-8');
  await fs.writeFile(archiveMarkdownPath, `${markdown}\n`, 'utf-8');
  await fs.writeFile(digestJsonPath, `${JSON.stringify(digest, null, 2)}\n`, 'utf-8');
  await fs.writeFile(preparedJsonPath, `${JSON.stringify(prepared, null, 2)}\n`, 'utf-8');

  if (!skipBuild) {
    await runCommand('npm', ['run', 'publish:site'], { cwd });
  }

  if (publishCmd) {
    await runShell(publishCmd, {
      AI_BUILDERS_DATE: date,
      AI_BUILDERS_MARKDOWN_PATH: markdownPath,
      AI_BUILDERS_ARCHIVE_MARKDOWN_PATH: archiveMarkdownPath,
      AI_BUILDERS_DIGEST_JSON_PATH: digestJsonPath,
      AI_BUILDERS_PREPARED_JSON_PATH: preparedJsonPath
    }, { cwd });
  }

  return {
    markdownPath,
    archiveMarkdownPath,
    digestJsonPath,
    preparedJsonPath,
    built: !skipBuild,
    published: Boolean(publishCmd)
  };
}
