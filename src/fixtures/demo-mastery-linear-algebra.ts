/**
 * 《线性代数》演示掌握度画像。
 *
 * 叙事：学生「相似对角化」这一章学不会，根源有二 ——
 *   一是第 4 章「向量组的线性相关性」没吃透（42 分），
 *   导致秩、向量空间、对角化一路跟着塌；
 *   二是第 5 章「特征值计算」自己就没打通（50 分）。
 * 这与数据结构「栈失守→树塌方」、高数「换元失守→重积分塌方」是同一类命题：
 * 一个前置概念没建立起来，下游整条链跟着失效。
 *
 * 分数约定：< 60 断层，60–74 薄弱，75–89 基本掌握，>= 90 扎实。
 */

import type { MasteryRecord } from '@/domain/types';
import { linearAlgebraTree } from '../data/courses/linear-algebra.ts';

const AT = '2026-09-26T10:00:00+08:00';

/** 刻意设成断层的节点：< 60 分 */
const LOW: Record<string, number> = {
  'la.vec.dependence': 42, // 源头一：线性相关/无关没吃透
  'la.vec.rank': 55,
  'la.vec.space': 58,
  'la.eig.value': 50, // 源头二：特征值计算卡
  'la.eig.diagonal': 55,
};

export const linearAlgebraMastery: MasteryRecord[] = linearAlgebraTree.nodes.map(
  (node) => ({
    nodeId: node.id,
    score: LOW[node.id] ?? 72,
    attempts: LOW[node.id] ? 3 : 1,
    updatedAt: AT,
  }),
);
