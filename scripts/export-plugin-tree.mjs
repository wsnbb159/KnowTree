/**
 * 把网页端的知识模块插件（public/plugins/*.js）提取成专家版可读的 JSON。
 *
 * 插件是自注册脚本：内部构造 tree/demoCases/mastery，然后调 window.KnowTree.registerCourse()。
 * 这里伪造一个最小的 window.KnowTree 环境执行它，把注册参数捕获下来 ——
 * 不用手写第二份数据，保证专家版与网页版**同一份源头**（本项目的一贯纪律）。
 *
 * 输出格式与 references/knowledge-tree.json 相同（{courses: {id: {...}}}），
 * 因此 diagnose.py 的 --tree 可以直接读。
 *
 * 用法：node scripts/export-plugin-tree.mjs <插件脚本> <输出文件> [courseName] [textbook]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , src, out, name, textbook] = process.argv;
if (!src || !out) {
  console.error('用法: node scripts/export-plugin-tree.mjs <插件脚本> <输出文件> [courseName] [textbook]');
  process.exit(1);
}

const code = readFileSync(src, 'utf8');

let captured;
const fakeWindow = {
  KnowTree: {
    registerCourse(input) {
      captured = input;
      return { ok: true };
    },
  },
  addEventListener() {},
};

new Function('window', code)(fakeWindow);

if (!captured || !captured.tree) {
  console.error('插件脚本没有调用 registerCourse({ tree })，无法提取');
  process.exit(1);
}

const tree = captured.tree;
const courseId = tree.courseId;
const edges = tree.nodes.reduce((sum, n) => sum + (n.prerequisites?.length ?? 0), 0);

const payload = {
  version: `plugin-${courseId}`,
  exportedAt: new Date().toISOString(),
  courses: {
    [courseId]: {
      name: name ?? captured.name ?? courseId,
      textbook: textbook ?? captured.description ?? '插件课程',
      tree,
      demoMastery: captured.mastery ?? [],
    },
  },
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');

console.log('已导出:', out);
console.log(`  ${courseId}（${payload.courses[courseId].name}）：${tree.nodes.length} 节点 / ${edges} 边 / 画像 ${payload.courses[courseId].demoMastery.length} 条`);
if (captured.mastery === undefined) {
  console.warn('  ⚠ 该插件未自带学情画像 —— 专家版 diagnose 时无法给出上游回溯，建议补上');
}
