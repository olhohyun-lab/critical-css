import fetch from 'node-fetch';
import fs from 'fs';
import { generate } from 'critical';

const WP_API = 'https://mathpowergen.com/wp-json/wp/v2/posts?per_page=100';

const fetchPosts = async () => {
  const res = await fetch(WP_API);
  const data = await res.json();
  return data.map(post => ({
    id: post.id,
    url: post.link
  }));
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const run = async () => {
  const posts = await fetchPosts();
  ensureDir('critical-css');

  for (const post of posts) {
    const desktopTarget = `critical-css/${post.id}.desktop.css`;
    const mobileTarget = `critical-css/${post.id}.mobile.css`;

    try {
      // 데스크탑
      await generate({
        src: post.url,
        width: 1300,
        height: 900,
        target: desktopTarget,
        minify: true,
        timeout: 60000,
      });
      console.log(`✅ Desktop: ${desktopTarget}`);

      // 모바일
      await generate({
        src: post.url,
        width: 375,
        height: 667,
        target: mobileTarget,
        minify: true,
        timeout: 60000,
      });
      console.log(`📱 Mobile: ${mobileTarget}`);

    } catch (err) {
      console.error(`❌ Failed for ${post.url}: ${err.message}`);
    }
  }
};

run();
