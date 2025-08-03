const fetch = require('node-fetch');
const fs = require('fs');
const { exec } = require('child_process');
const ftp = require('basic-ftp');
const util = require('util');
const path = require('path');

const execPromise = util.promisify(exec);
const BASE_URL = 'https://mathpowergen.com';
const OUTPUT_DIR = 'output';
const REMOTE_DIR = '/www/wp-content/critical-css';

const {
  FTP_HOST,
  FTP_USER,
  FTP_PASS
} = process.env;

const BATCH_SIZE = 20;
const TIMEOUT = 60_000; // 60초 제한

async function runCriticalWithTimeout(command, timeoutMs, retries = 1) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      await Promise.race([
        execPromise(command),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        )
      ]);
      return true;
    } catch (err) {
      if (attempt > retries) {
        console.error(`❌ [Timeout/Error] ${command} → ${err.message}`);
        return false;
      } else {
        console.warn(`🔁 Retry (${attempt}/${retries}) for: ${command}`);
      }
    }
  }
}

(async () => {
  const res = await fetch(`${BASE_URL}/wp-json/wp/v2/posts?per_page=100&_fields=id`);
  const posts = await res.json();
  const sortedPosts = posts.sort((a, b) => a.id - b.id);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  const batches = [];
  for (let i = 0; i < sortedPosts.length; i += BATCH_SIZE) {
    batches.push(sortedPosts.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    const successfulPosts = [];

    for (const post of batch) {
      const postId = post.id;
      const url = `${BASE_URL}/?p=${postId}`;
      console.log(`🔍 Generating critical CSS for post ID: ${postId}`);

      const desktopCmd = `npx critical ${url} --width=1300 --height=900 --extract --target=${OUTPUT_DIR}/${postId}_desktop.css`;
      const mobileCmd  = `npx critical ${url} --width=375 --height=667 --extract --target=${OUTPUT_DIR}/${postId}_mobile.css`;

      const desktopSuccess = await runCriticalWithTimeout(desktopCmd, TIMEOUT, 1);
      const mobileSuccess  = await runCriticalWithTimeout(mobileCmd, TIMEOUT, 1);

      if (desktopSuccess && mobileSuccess) {
        successfulPosts.push(postId);
      } else {
        console.warn(`⚠️ Skipped post ${postId} due to failure`);
      }
    }

    // FTP 업로드
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      await client.access({
        host: FTP_HOST,
        user: FTP_USER,
        password: FTP_PASS,
        port: 21,
        secure: false,
      });

      for (const postId of successfulPosts) {
        try {
          await client.uploadFrom(`${OUTPUT_DIR}/${postId}_desktop.css`, `${REMOTE_DIR}/${postId}_desktop.css`);
          await client.uploadFrom(`${OUTPUT_DIR}/${postId}_mobile.css`, `${REMOTE_DIR}/${postId}_mobile.css`);
          console.log(`✅ Uploaded CSS for post ${postId}`);
        } catch (err) {
          console.error(`❌ FTP upload failed for post ${postId}:`, err.message);
        }
      }

      client.close();
    } catch (err) {
      console.error("❌ FTP connection failed:", err.message);
    }
  }
})();
