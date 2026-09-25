/**
 * 把插件广场里的 CDN 引用钉到当前 commit。
 *
 * 为什么必须钉 commit 而不是用 @main：
 * jsDelivr 对分支名的缓存可以长达数天。实测改了 plugins/physics.js 之后，
 * @main 上仍然是旧版本，用户点安装会装到过时的插件 —— 而且不报错，最难查。
 * 按完整 commit sha 引用则每次都命中不可变内容，改完立即生效。
 *
 * 代价是每次改动 plugins/*.js 都要重新钉一次 —— 所以做成脚本。
 * 用 @<40 位十六进制> 作为匹配模式，两个文件（清单 + 内置兜底清单）一起改，
 * 避免出现「清单是新的、兜底是旧的」这种两处事实不一致。
 *
 * 用法：node scripts/pin-plugins.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha = execSync('git rev-parse HEAD', { cwd: root }).toString().trim();
const today = new Date().toISOString().slice(0, 10);

const TARGETS = ['plugins/registry.json', 'src/services/plugin-market.ts'];
/*
 * 只钉「插件脚本」这一类引用（.../<ref>/plugins/xxx.js），
 * 不钉清单自身的地址 —— 清单必须留在 @main 上，否则加新插件就得改代码重新部署。
 */
const PATTERN = /KnowTree@[0-9a-f]{40}(\/plugins\/[^/]+\.js)/g;

let total = 0;
for (const rel of TARGETS) {
  const path = join(root, rel);
  let text = readFileSync(path, 'utf8');
  const hits = text.match(PATTERN)?.length ?? 0;
  if (hits === 0) {
    console.log(`· ${rel}：没有可钉的引用，跳过`);
    continue;
  }
  text = text.replace(PATTERN, (_m, tail) => `KnowTree@${sha}${tail}`);
  if (rel === 'plugins/registry.json') {
    text = text.replace(/"updatedAt": "[^"]*"/, `"updatedAt": "${today}"`);
  }
  writeFileSync(path, text);
  total += hits;
  console.log(`✓ ${rel}：钉了 ${hits} 处`);
}

console.log(`\n当前 commit：${sha}`);
console.log(`共 ${total} 处引用已指向该 commit。记得提交并推送后，CDN 才会出现对应内容。`);
