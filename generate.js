const fetch = require('node-fetch');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');

const execPromise = util.promisify(exec);
const BASE_URL = 'https://mathpowergen.com';
const OUTPUT_DIR = 'output';

const BATCH_SIZE = 20;
const TIMEOUT = 60_000; // 60초 제한

async function fetchAllPosts() {
  let page = 1;
  const allPosts = [];

  while (true) {
    const res = await fetch(`${BASE_URL}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id`);
    const posts = await res.json();
    if (posts.length === 0) break;
    allPosts.push(...posts);
    page++;
  }

  return allPosts.sort((a, b) => a.id - b.id);
}

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
  const posts = await fetchAllPosts();

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  const batches = [];
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    batches.push(posts.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    for (const post of batch) {
      const postId = post.id;
      const url = `${BASE_URL}/?p=${postId}`;
      console.log(`🔍 Generating critical CSS for post ID: ${postId}`);

      const desktopCmd = `npx critical ${url} --width=1300 --height=900 --extract --target=${OUTPUT_DIR}/${postId}_desktop.css`;
      const mobileCmd  = `npx critical ${url} --width=375 --height=667 --extract --target=${OUTPUT_DIR}/${postId}_mobile.css`;

      const desktopSuccess = await runCriticalWithTimeout(desktopCmd, TIMEOUT, 1);
      const mobileSuccess  = await runCriticalWithTimeout(mobileCmd, TIMEOUT, 1);

      if (!(desktopSuccess && mobileSuccess)) {
        console.warn(`⚠️ Skipped post ${postId} due to failure`);
      }
    }
  }

  console.log("🎯 CSS generation complete. All files stored in /output.");
})();
