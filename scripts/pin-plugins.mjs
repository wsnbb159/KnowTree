/**
 * 把插件广场里指向**外部 CDN** 的脚本引用钉到当前 commit。
 *
 * 背景（实测踩出来的坑）：
 * jsDelivr 对分支名的缓存长达数天，而且刷不掉 —— purge 接口无效，
 * query string 也不参与缓存键，所以加再多个 Date.now() 都拿的是同一份旧内容。
 * 结果是「改了插件，线上装到的还是旧版本」，且界面一切正常，最难查。
 * 按完整 commit sha 引用则命中不可变内容，改完立即生效。
 *
 * 现在站内插件（script 写相对路径，如 `plugins/physics.js`）已经不需要钉 ——
 * 它随站点一起部署，部署即最新。这个脚本只处理清单里显式写了完整 CDN URL 的外部插件。
 *
 * 之所以做成脚本而不是手改：清单与页面内置兜底清单是两处，一旦不一致就会出现
 * 「线上清单是新的、离线兜底是旧的」这种极难发现的错位。
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
