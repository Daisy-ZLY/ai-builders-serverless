import fs from 'node:fs/promises';
import path from 'node:path';
import COS from 'cos-nodejs-sdk-v5';
import 'dotenv/config';

import fsSync from 'node:fs';

// Initialize COS instance
function getCosInstance() {
  const SecretId = process.env.TENCENTCLOUD_SECRET_ID;
  const SecretKey = process.env.TENCENTCLOUD_SECRET_KEY;

  if (!SecretId || !SecretKey) {
    throw new Error('TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY are required for COS upload.');
  }

  return new COS({
    SecretId,
    SecretKey,
  });
}

function getBucketConfig() {
  const Bucket = process.env.COS_BUCKET;
  const Region = process.env.COS_REGION;
  const StorageClass = process.env.COS_STORAGE_CLASS || 'STANDARD';

  if (!Bucket || !Region) {
    throw new Error('COS_BUCKET and COS_REGION are required for COS upload.');
  }

  return { Bucket, Region, StorageClass };
}

/**
 * Uploads a single file to COS
 * @param {string} localPath - Local file path
 * @param {string} remoteKey - Remote file key (path in COS)
 */
export async function uploadFileToCos(localPath, remoteKey) {
  const cos = getCosInstance();
  const { Bucket, Region, StorageClass } = getBucketConfig();

  try {
    await fs.access(localPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`File ${localPath} does not exist, skipping upload.`);
      return;
    }
    throw err;
  }

  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket,
        Region,
        Key: remoteKey,
        StorageClass,
        Body: fsSync.createReadStream(localPath), // Use stream for large files
      },
      (err, data) => {
        if (err) {
          console.error(`Failed to upload ${localPath} to COS:`, err);
          reject(err);
        } else {
          console.log(`Successfully uploaded ${localPath} to COS at ${remoteKey}`);
          resolve(data);
        }
      }
    );
  });
}

/**
 * Uploads an entire directory recursively to COS
 * @param {string} localDir - Local directory path
 * @param {string} remotePrefix - Prefix for the remote keys
 */
export async function uploadDirectoryToCos(localDir, remotePrefix = '') {
  let items;
  try {
    items = await fs.readdir(localDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`Directory ${localDir} does not exist, skipping upload.`);
      return;
    }
    throw err;
  }

  for (const item of items) {
    const fullPath = path.join(localDir, item.name);
    // Ensure remote prefix doesn't have leading slash and uses forward slashes
    const normalizedPrefix = remotePrefix.replace(/^\/+/, '');
    const remoteKey = normalizedPrefix ? `${normalizedPrefix}/${item.name}` : item.name;

    if (item.isDirectory()) {
      await uploadDirectoryToCos(fullPath, remoteKey);
    } else {
      await uploadFileToCos(fullPath, remoteKey);
    }
  }
}
