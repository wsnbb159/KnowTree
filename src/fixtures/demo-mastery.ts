/**
 * 演示用的掌握度画像。
 *
 * 刻意构造出「一个洞导致一章塌方」的典型断层：
 * 学生第 1、2 章基础扎实，第 3 章「函数调用栈」失守，
 * 于是第 4 章树与二叉树整片塌方，并连带第 5 章的 DFS。
 *
 * 这份画像要说明的核心命题是：
 *   表面上 13 个知识点失守，源头其实只有 1 个。
 * —— 这正是知树要替学生算出来的东西。
 *
 * 分数约定：< 60 判定为断层，60–74 薄弱，75–89 基本掌握，>= 90 扎实。
 */

import type { MasteryRecord } from '@/domain/types';

const AT = '2026-09-18T21:40:00+08:00';

function m(nodeId: string, score: number, attempts: number): MasteryRecord {
  return { nodeId, score, attempts, updatedAt: AT };
}

export const demoMastery: MasteryRecord[] = [
  /* 第1章 绪论：基础扎实 —— 有扎实的地方，才说明问题不是「态度」 */
  m('ds.intro.concept', 91, 6),
  m('ds.intro.adt', 80, 4),
  m('ds.intro.complexity', 72, 9),
  // 递归思想站在及格线上，还不是断层，但已经是断层的前兆
  m('ds.intro.recursion', 66, 7),

  /* 第2章 线性表：顺序表熟练，链表有漏洞但够用 */
  m('ds.list.sequential', 90, 8),
  m('ds.list.linked', 74, 11),
  m('ds.list.doubly', 70, 5),

  /* 第3章 栈与队列：断层从这里开始 */
  m('ds.stack.basic', 76, 9),
  m('ds.stack.callstack', 38, 4), // ← 唯一的源头
  m('ds.stack.expression', 52, 6),
  m('ds.queue.basic', 70, 6),
  m('ds.queue.circular', 62, 5),

  /* 第4章 树与二叉树：因第3章失守而整片塌方 */
  m('ds.tree.concept', 80, 5),
  m('ds.tree.binary', 68, 8),
  m('ds.tree.traversal', 45, 12),
  m('ds.tree.recursive-thinking', 30, 9), // ← 本次题目的考点
  m('ds.tree.level', 40, 6),
  m('ds.tree.clue', 35, 3),
  m('ds.tree.huffman', 42, 4),
  m('ds.tree.heap', 48, 7),
  m('ds.tree.bst', 44, 6),
  m('ds.tree.avl', 25, 2),
  m('ds.tree.forest', 60, 3),

  /* 第5章 图：DFS 是因调用栈断层被连带的典型 */
  m('ds.graph.concept', 72, 4),
  m('ds.graph.dfs', 38, 5),
  m('ds.graph.bfs', 66, 4),
  m('ds.graph.mst', 60, 3),
  m('ds.graph.shortest', 55, 2),
  m('ds.graph.topo', 52, 2),

  /* 第6章 查找：明显好于树与图，说明学生的困难是结构性的而非全面的 */
  m('ds.search.sequential', 70, 5),
  m('ds.search.hash', 68, 3),
  m('ds.search.index', 62, 2),

  /* 第7章 排序：相对独立，掌握度正常 —— 证明问题不是「学习态度」 */
  m('ds.sort.insert', 82, 6),
  m('ds.sort.swap', 70, 8),
  m('ds.sort.select', 68, 5),
  m('ds.sort.merge', 72, 5),
  m('ds.sort.radix', 66, 3),
  m('ds.sort.summary', 65, 4),
];
