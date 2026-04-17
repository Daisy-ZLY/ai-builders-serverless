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
  
  // In the new Astro project, we want the JSON directly in src/data/api/${date}.json
  const digestJsonPath = path.join(generatedDir, `${date}.json`);
  const preparedJsonPath = path.join(generatedDir, `${date}.prepared.json`);

  await fs.writeFile(markdownPath, `${markdown}\n`, 'utf-8');
  await fs.writeFile(archiveMarkdownPath, `${markdown}\n`, 'utf-8');
  await fs.writeFile(digestJsonPath, `${JSON.stringify(digest, null, 2)}\n`, 'utf-8');
  await fs.writeFile(preparedJsonPath, `${JSON.stringify(prepared, null, 2)}\n`, 'utf-8');

  if (!skipBuild) {
    // We don't need to run publish:site anymore, Astro handles building
    console.log('Skipping legacy publish:site command in Astro project.');
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
