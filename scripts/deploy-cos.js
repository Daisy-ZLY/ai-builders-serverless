import fs from 'node:fs/promises';
import path from 'node:path';
import COS from 'cos-nodejs-sdk-v5';

const SecretId = process.env.TENCENTCLOUD_SECRET_ID;
const SecretKey = process.env.TENCENTCLOUD_SECRET_KEY;
const Bucket = process.env.COS_BUCKET;
const Region = process.env.COS_REGION;

if (!SecretId || !SecretKey || !Bucket || !Region) {
  console.error('❌ Missing required COS environment variables.');
  process.exit(1);
}

const cos = new COS({ SecretId, SecretKey });

async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

async function uploadFiles(distDir) {
  const files = await getFiles(distDir);
  const uploadTasks = files.map(file => {
    const key = path.relative(distDir, file).replace(/\\/g, '/');
    return {
      Bucket,
      Region,
      Key: key,
      FilePath: file,
    };
  });

  console.log(`🚀 Found ${uploadTasks.length} files to upload to COS.`);

  return new Promise((resolve, reject) => {
    cos.uploadFiles({
      files: uploadTasks,
      SliceSize: 1024 * 1024 * 5,
      onProgress: function (info) {
        // console.log('Progress:', info);
      },
      onFileFinish: function (err, data, options) {
        if (err) console.error('❌ Upload failed for:', options.Key, err);
        // else console.log('✅ Uploaded:', options.Key); // 避免日志过多
      },
    }, function (err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

uploadFiles(path.resolve(process.cwd(), 'dist'))
  .then(() => {
    console.log('🎉 All files uploaded successfully to COS.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ COS Upload error:', err);
    process.exit(1);
  });
