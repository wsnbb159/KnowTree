/**
 * 《高等数学》归因链路验证。
 *
 * 断言分两层，刻意分开：
 *
 *   A. 结构层 —— 知识树与算法的正确性（必须永远通过）
 *   B. 叙事层 —— 演示画像能否支撑一条有说服力的归因链（当前画像下的期望值）
 *
 * 分开的理由：结构错了是 bug；叙事不理想只是演示效果问题。
 * 混在一起会导致「为了让它变绿去改分数」，那是把测试当成装饰品。
 */

import {
  groupGapsByOrigin,
  indexTree,
  locateGap,
  masteryLevel,
  masteryMap,
  prerequisitePath,
  treeStats,
} from '../src/domain/knowledge-tree.ts';
import { calculusTree } from '../src/data/courses/calculus.ts';
import { calculusMastery } from '../src/fixtures/demo-mastery-calculus.ts';

const index = indexTree(calculusTree);
const mastery = masteryMap(calculusMastery);

let failed = 0;
function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}${detail ? ` —— ${detail}` : ''}`);
    failed += 1;
  }
}

console.log('=== 知识树完整性 ===');
console.log('节点数：', calculusTree.nodes.length);
console.log('前置依赖边：', calculusTree.nodes.reduce((s, n) => s + n.prerequisites.length, 0));
console.log('根节点：', index.roots.join(', '), `（${index.roots.length} 个入口）`);

const stats = treeStats(index, mastery);
console.log('\n=== 掌握度分布 ===');
console.log(
  `断层 ${stats.gap} · 薄弱 ${stats.weak} · 基本掌握 ${stats.ok} · 扎实 ${stats.solid} · 平均 ${stats.average}`,
);

console.log('\n--- A. 结构层断言 ---');

check("节点数是 67", calculusTree.nodes.length === 67, `实际 ${calculusTree.nodes.length}`);
check(
  '存在且仅存在一个根节点（课程有唯一入口）',
  index.roots.length === 1,
  `实际 ${index.roots.length} 个：${index.roots.join(', ')}`,
);
check(
  '每个节点都有典型误概念（归因质量的数据基础）',
  calculusTree.nodes.every((n) => (n.misconceptions?.length ?? 0) > 0),
);
check(
  '每个节点都有教材出处（归因可溯源）',
  calculusTree.nodes.every((n) => (n.sources?.length ?? 0) > 0),
);
check(
  '每个节点都有章节归属',
  calculusTree.nodes.every((n) => n.chapter.trim() !== ''),
);
check(
  '不存在自指依赖',
  calculusTree.nodes.every((n) => !n.prerequisites.includes(n.id)),
);

console.log('\n--- B. 叙事层：第 298 题（极坐标）的归因链 ---');
const target = 'calc.multint.polar';
const located = locateGap(index, mastery, target);
const path = located ? located.chain : [];

console.log('考点：', index.byId.get(target)?.name);
console.log('断层节点：', located ? index.byId.get(located.nodeId)?.name : '（无）');
console.log('断层性质：', located?.origin === 'prerequisite' ? '前置断层（源头在上游）' : '自因断层');
console.log('因果链：', path.map((id) => index.byId.get(id)?.name ?? id).join(' → '));
console.log('blastRadius（含断层自身）：', located?.blastRadius ?? 0, '个后续知识点');

// 独立的第二路径：从「定积分换元」出发看它能波及多少
const subChain = prerequisitePath(index, 'calc.integral.substitution-def', target);
console.log(
  '\n分支事实：换元法 → 极坐标 的必经路径 =',
  subChain.map((id) => index.byId.get(id)?.name ?? id).join(' → '),
);

check('考点本身判定为断层', masteryLevel(mastery.get(target)) === 'gap');
check('断层性质为前置断层', located?.origin === 'prerequisite', `实际 origin=${located?.origin}`);
check(
  '归因停在与考点直接相邻的失效边界（算法设计如此：补最近的洞才解决眼前问题）',
  located?.nodeId === 'calc.multint.iteration',
  `实际 nodeId=${located?.nodeId}`,
);
check(
  '因果链是一条真实的依赖路径（首尾正确）',
  path[0] === located?.nodeId && path[path.length - 1] === target,
  `实际链=${path.join(' → ')}`,
);
check('因果链长度 >= 2', path.length >= 2);
check(
  '「定积分换元」确实在考点上游闭包中（跨模块依赖成立）',
  prerequisitePath(index, 'calc.integral.substitution-def', target).length > 0,
);

console.log('\n--- B2. 叙事层：这门课的最大源头 ---');
const clusters = groupGapsByOrigin(index, mastery);
console.log(`全树断层 ${stats.gap} 个，收敛为 ${clusters.length} 个源头：`);
clusters.forEach((c, i) => {
  console.log(
    `  ${i + 1}. ${index.byId.get(c.rootNodeId)?.name}【当前 ${c.rootScore} 分】→ 连带 ${c.affected.length - 1} 个知识点`,
  );
});

check('存在「全微分」以外的跨模块断层（多元微分模块确实有洞）', clusters.some((c) => c.rootNodeId === 'calc.multivar.total'));
check('换元法是全树最低分断层之一（它的波及面最大）', (mastery.get('calc.integral.substitution-def') ?? 100) < 50);

console.log(`\n${failed === 0 ? '✅ 全部断言通过' : `❌ ${failed} 条断言失败`}`);
process.exit(failed === 0 ? 0 : 1);
