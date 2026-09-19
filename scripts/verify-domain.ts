/**
 * 领域层验证脚本（开发期自检，不进入构建产物）。
 *
 * 运行：node scripts/verify-domain.ts
 * 断言的核心命题：给定一份掌握度画像，归因引擎必须能把
 * 「二叉树递归分解」这道题的卡点，回溯到第 3 章的「函数调用栈」。
 */

import {
  groupGapsByOrigin,
  indexTree,
  locateGap,
  masteryLevel,
  masteryMap,
  prerequisiteClosure,
  prerequisitePath,
  treeStats,
} from '../src/domain/knowledge-tree.ts';
import { dataStructureTree } from '../src/data/courses/data-structure.ts';
import { demoMastery } from '../src/fixtures/demo-mastery.ts';

const index = indexTree(dataStructureTree);
const mastery = masteryMap(demoMastery);

console.log('=== 知识树完整性 ===');
console.log(`节点数：${index.tree.nodes.length}`);
console.log(`根节点：${index.roots.join('、')}`);
let edges = 0;
for (const list of index.prerequisitesOf.values()) edges += list.length;
console.log(`前置依赖边：${edges}`);

const stats = treeStats(index, mastery);
console.log(
  `\n=== 掌握度分布 ===\n断层 ${stats.gap} · 薄弱 ${stats.weak} · 基本掌握 ${stats.ok} · 扎实 ${stats.solid} · 平均 ${stats.average}`,
);

const targets = ['ds.tree.recursive-thinking', 'ds.tree.level', 'ds.tree.avl', 'ds.sort.swap'];

console.log('\n=== 断层定位（归因引擎输出）===');
let failures = 0;
for (const target of targets) {
  const result = locateGap(index, mastery, target);
  const targetName = index.byId.get(target)?.name ?? target;
  if (result === null) {
    console.log(`\n[${targetName}] 考点本身已掌握，无需诊断`);
    continue;
  }
  const chainNames = result.chain.map((id) => index.byId.get(id)?.name ?? id);
  const originLabel =
    result.origin === 'prerequisite' ? '前置断层（源头在上游）' : '自因断层（问题就在考点）';
  console.log(`\n考点：${targetName}`);
  console.log(`  断层节点：${index.byId.get(result.nodeId)?.name}  (${result.nodeId})`);
  console.log(`  断层性质：${originLabel}`);
  console.log(`  因果链：${chainNames.join(' → ')}`);
  console.log(`  波及范围：${result.blastRadius} 个后续知识点`);
  console.log(
    `  备选断层：${result.alternatives.map((a) => `${index.byId.get(a.nodeId)?.name}(${a.blastRadius})`).join('、') || '无'}`,
  );
  if (target === 'ds.tree.recursive-thinking' && result.nodeId !== 'ds.stack.callstack') {
    console.error('  ✗ 断言失败：应回溯到「函数调用栈」');
    failures += 1;
  }
}

console.log('\n=== 根源收敛（产品的核心主张）===');
const clusters = groupGapsByOrigin(index, mastery);
const gapCount = clusters.reduce((sum, c) => sum + c.affected.length, 0);
console.log(`全树断层 ${gapCount} 个，收敛为 ${clusters.length} 个源头：\n`);
for (const cluster of clusters) {
  const name = index.byId.get(cluster.rootNodeId)?.name ?? cluster.rootNodeId;
  console.log(
    `${name}【当前 ${cluster.rootScore} 分】→ 连带 ${cluster.affected.length - 1} 个知识点`,
  );
  console.log(
    `    ${cluster.affected
      .filter((id) => id !== cluster.rootNodeId)
      .map((id) => index.byId.get(id)?.name)
      .join('、') || '无（问题就在自身）'}`,
  );
}

// 断言：凡前置闭包含「函数调用栈」的第4章断层，必须 100% 收敛到它
const ch4 = index.tree.nodes.filter((n) => n.chapter === '第4章 树与二叉树');
const shouldConverge = ch4.filter(
  (n) =>
    masteryLevel(mastery.get(n.id)) === 'gap' &&
    prerequisiteClosure(index, n.id).has('ds.stack.callstack'),
);
const wrong = shouldConverge.filter((n) => {
  const located = locateGap(index, mastery, n.id);
  return !located || located.nodeId !== 'ds.stack.callstack';
});
console.log(
  `\n第4章中断层且闭包含「函数调用栈」的知识点：${shouldConverge.length} 个`,
);
if (wrong.length > 0) {
  console.error(`  ✗ 断言失败：${wrong.map((n) => n.name).join('、')} 未收敛到函数调用栈`);
  failures += 1;
} else {
  console.log('  ✓ 全部收敛到唯一源头：函数调用栈与递归展开');
}
const top = clusters[0];
if (top.rootNodeId !== 'ds.stack.callstack') {
  console.error(`  ✗ 断言失败：最大源头应为函数调用栈，实际为 ${top.rootNodeId}`);
  failures += 1;
} else {
  console.log(`  ✓ 最大源头为「函数调用栈与递归展开」，一次修复可解放 ${top.affected.length} 个知识点`);
}

console.log('\n=== 因果链长度校验 ===');
const chain = prerequisitePath(index, 'ds.stack.callstack', 'ds.tree.recursive-thinking');
console.log(chain.map((id) => index.byId.get(id)?.name).join(' → '));
if (chain.length !== 3) {
  console.error(`✗ 断言失败：应为三段式因果链，实际 ${chain.length} 段`);
  failures += 1;
}

if (failures > 0) {
  console.error(`\n✗ 共 ${failures} 项断言失败`);
  process.exit(1);
}
console.log('\n✓ 全部断言通过：归因引擎能把「树的递归分解」卡点回溯到「函数调用栈」');
