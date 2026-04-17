import fs from 'node:fs/promises';
import path from 'node:path';

export async function writeModelResponseErrorArtifacts({ basePath, error }) {
  await fs.mkdir(basePath, { recursive: true });

  const rawPath = path.join(basePath, 'model-response.raw.txt');
  const errorPath = path.join(basePath, 'parse-error.txt');

  if (typeof error?.rawResponse === 'string' && error.rawResponse.length > 0) {
    await fs.writeFile(rawPath, `${error.rawResponse}\n`, 'utf-8');
  }

  const details = {
    at: new Date().toISOString(),
    name: error?.name || 'Error',
    kind: error?.kind || 'unknown',
    message: error?.message || 'Unknown error',
    cleanedResponse: error?.cleanedResponse || null,
    validationErrors: error?.validationErrors || null,
    cause: error?.cause?.message || null
  };

  await fs.writeFile(errorPath, `${JSON.stringify(details, null, 2)}\n`, 'utf-8');

  return {
    rawPath,
    errorPath
  };
}
