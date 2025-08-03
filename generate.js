const fetch = require('node-fetch');
const fs = require('fs');
const { execSync } = require('child_process');
const ftp = require('basic-ftp');
const path = require('path');

const BASE_URL = 'https://mathpowergen.com';
const OUTPUT_DIR = 'output';
const REMOTE_DIR = '/www/wp-content/critical-css';

const {
  SFTP_HOST,
  SFTP_USER,
  SFTP_PASS
} = process.env;

(async () => {
  const res = await fetch(`${BASE_URL}/wp-json/wp/v2/posts?per_page=100&_fields=id`);
  const posts = await res.json();
  const sortedPosts = posts.sort((a, b) => a.id - b.id);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  for (const post of sortedPosts) {
    const postId = post.id;
    const url = `${BASE_URL}/?p=${postId}`;
    console.log(`🔍 Generating critical CSS for post ID: ${postId}`);

    try {
      execSync(`npx critical ${url} --width=1300 --height=900 --extract --target=${OUTPUT_DIR}/${postId}_desktop.css`);
      execSync(`npx critical ${url} --width=375 --height=667 --extract --target=${OUTPUT_DIR}/${postId}_mobile.css`);
    } catch (err) {
      console.error(`❌ Failed to generate critical CSS for post ${postId}:`, err.message);
    }
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: SFTP_HOST,
      user: SFTP_USER,
      password: SFTP_PASS,
      port: 21,
      secure: false,
    });

    for (const post of sortedPosts) {
      const postId = post.id;
      try {
        await client.uploadFrom(`${OUTPUT_DIR}/${postId}_desktop.css`, `${REMOTE_DIR}/${postId}_desktop.css`);
        await client.uploadFrom(`${OUTPUT_DIR}/${postId}_mobile.css`, `${REMOTE_DIR}/${postId}_mobile.css`);
        console.log(`✅ Uploaded CSS for post ${postId}`);
      } catch (err) {
        console.error(`❌ Failed to upload CSS for post ${postId}:`, err.message);
      }
    }

    client.close();
  } catch (err) {
    console.error("❌ FTP connection failed:", err.message);
  }
})();
