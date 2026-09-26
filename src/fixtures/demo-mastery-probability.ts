/**
 * 《概率论与数理统计》演示掌握度画像。
 *
 * 叙事：学生「贝叶斯公式」总不会用，根源在更早的「条件概率」没吃透 ——
 *   条件概率(48) → 乘法公式(58) → 全概率公式(52) → 贝叶斯(55) 一路塌。
 * 概率论里这类「公式套公式」的依赖链最典型：学生以为卡在贝叶斯，
 * 其实是「结果→原因」与「原因→结果」的样本空间缩小没想清楚。
 */

import type { MasteryRecord } from '@/domain/types';
import { probabilityTree } from '../data/courses/probability.ts';

const AT = '2026-09-26T10:00:00+08:00';

/** 刻意设成断层的节点：< 60 分 */
const LOW: Record<string, number> = {
  'prob.event.conditional': 48, // 源头：条件概率（样本空间缩小）没想清
  'prob.event.multiplication': 58,
  'prob.event.total': 52,
  'prob.event.bayes': 55,
};

export const probabilityMastery: MasteryRecord[] = probabilityTree.nodes.map(
  (node) => ({
    nodeId: node.id,
    score: LOW[node.id] ?? 72,
    attempts: LOW[node.id] ? 3 : 1,
    updatedAt: AT,
  }),
);
