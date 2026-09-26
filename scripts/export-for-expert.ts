/**
 * 把知识树与演示画像导出为 JSON，供 LearnBuddy 专家包的归因脚本读取。
 *
 * 为什么需要这个导出步骤：
 * 专家（智能体形态）运行在对话环境里，不能直接 import 本项目的 TypeScript 模块。
 * 把「知识树 + 演示画像」落成 JSON，专家侧的 Python 归因脚本就能读到同一份数据 ——
 * 从而保证网页版与专家版给出**完全一致**的归因结论，不会出现两套口径。
 *
 * 运行：node scripts/export-for-expert.ts <输出目录>
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { dataStructureTree } from '../src/data/courses/data-structure.ts';
import { calculusTree } from '../src/data/courses/calculus.ts';
import { linearAlgebraTree } from '../src/data/courses/linear-algebra.ts';
import { probabilityTree } from '../src/data/courses/probability.ts';
import { demoMastery } from '../src/fixtures/demo-mastery.ts';
import { calculusMastery } from '../src/fixtures/demo-mastery-calculus.ts';
import { linearAlgebraMastery } from '../src/fixtures/demo-mastery-linear-algebra.ts';
import { probabilityMastery } from '../src/fixtures/demo-mastery-probability.ts';

const outDir = process.argv[2];
if (!outDir) {
  console.error('用法: node scripts/export-for-expert.ts <输出目录>');
  process.exit(1);
}

const payload = {
  version: '2026.09',
  exportedAt: new Date().toISOString(),
  courses: {
    'data-structure': {
      name: '数据结构',
      textbook: '严蔚敏《数据结构》',
      tree: dataStructureTree,
      demoMastery,
    },
    calculus: {
      name: '高等数学',
      textbook: '同济《高等数学》第七版',
      tree: calculusTree,
      demoMastery: calculusMastery,
    },
    'linear-algebra': {
      name: '线性代数',
      textbook: '同济《线性代数》第六版',
      tree: linearAlgebraTree,
      demoMastery: linearAlgebraMastery,
    },
    probability: {
      name: '概率论与数理统计',
      textbook: '浙大《概率论与数理统计》第四版',
      tree: probabilityTree,
      demoMastery: probabilityMastery,
    },
  },
};

const target = `${outDir}/knowledge-tree.json`;
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');

console.log('已导出:', target);
for (const [id, course] of Object.entries(payload.courses)) {
  const edges = course.tree.nodes.reduce((sum, n) => sum + n.prerequisites.length, 0);
  console.log(`  ${id}（${course.name}）：${course.tree.nodes.length} 节点 / ${edges} 边`);
}
