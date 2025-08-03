const fetch = require('node-fetch');
const { writeFileSync } = require('fs');
const { execSync } = require('child_process');
const Client = require('ssh2-sftp-client');
const path = require('path');

const BASE_URL = 'https://mathpowergen.com';
const OUTPUT_DIR = 'output';
const REMOTE_DIR = '/web/home/mathpowergen/html/wp-content/critical-css';

const sftp = new Client();

// 환경변수
const {
  SFTP_HOST,
  SFTP_PORT,
  SFTP_USER,
  SFTP_PASS
} = process.env;

(async () => {
  // WordPress REST API에서 포스트 목록 가져오기
  const res = await fetch(`${BASE_URL}/wp-json/wp/v2/posts?per_page=100`);
  const posts = await res.json();

  for (const post of posts) {
    const postId = post.id;
    const url = `${BASE_URL}/?p=${postId}`;

    console.log(`🔍 Generating critical CSS for post ID: ${postId}`);

    
// Desktop
execSync(`npx critical ${url} --width=1300 --height=900 --extract --target=${OUTPUT_DIR}/${postId}_desktop.css`);

// Mobile
execSync(`npx critical ${url} --width=375 --height=667 --extract --target=${OUTPUT_DIR}/${postId}_mobile.css`);
  }
  // FTP 업로드
  await sftp.connect({
    host: SFTP_HOST,
    port: SFTP_PORT,
    username: SFTP_USER,
    password: SFTP_PASS,
  });

  for (const post of posts) {
    const postId = post.id;
    const remoteDesktopPath = `${REMOTE_DIR}/${postId}_desktop.css`;
    const remoteMobilePath = `${REMOTE_DIR}/${postId}_mobile.css`;

    await sftp.put(`${OUTPUT_DIR}/${postId}_desktop.css`, remoteDesktopPath);
    await sftp.put(`${OUTPUT_DIR}/${postId}_mobile.css`, remoteMobilePath);

    console.log(`✅ Uploaded critical CSS for post ${postId}`);
  }

  await sftp.end();
})();
