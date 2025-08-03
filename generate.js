const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');

const execPromise = util.promisify(exec);
const BASE_URL = process.env.BASE_URL;
const OUTPUT_DIR = 'output';
const TIMEOUT_MS = 60_000;
const RETRIES = 1;

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
      console.warn(`⚠️ 실패 (${attempt}/${retries + 1}): ${command}`);
      if (attempt > retries) return false;
    }
  }
}

async function main() {
  const postIds = fs.readFileSync('post_ids.txt', 'utf-8')
    .split('\n')
    .filter(Boolean);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

  for (const id of postIds) {
    const desktopFile = `${OUTPUT_DIR}/${id}-desktop.css`;
    const mobileFile = `${OUTPUT_DIR}/${id}-mobile.css`;

    const desktopCommand = `npx critical ${BASE_URL}/?p=${id} --width=1300 --height=900 --minify --extract --timeout=30000 --timeoutRetry --target=${desktopFile}`;
    const mobileCommand = `npx critical ${BASE_URL}/?p=${id} --width=390 --height=800 --minify --extract --timeout=30000 --timeoutRetry --target=${mobileFile}`;

    console.log(`🔧 ${id} - 데스크탑`);
    const desktopSuccess = await runCriticalWithTimeout(desktopCommand, TIMEOUT_MS, RETRIES);

    console.log(`🔧 ${id} - 모바일`);
    const mobileSuccess = await runCriticalWithTimeout(mobileCommand, TIMEOUT_MS, RETRIES);

    if (!desktopSuccess || !mobileSuccess) {
      console.log(`⏭️ ${id} - 타임아웃으로 생성을 건너뜁니다.`);
    }
  }
}

main();
