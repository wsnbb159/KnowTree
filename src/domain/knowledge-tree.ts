/**
 * 知识树的图算法层。
 *
 * 这里是「卡点归因」的数学基础：
 * 一个学生做不出某道题，考点在节点 T，但真正缺的可能是 T 上游很远的某个节点 P。
 * 找到 P 的过程 = 在 T 的前置依赖闭包中，定位「失效边界」——
 * 一个自己没有掌握、但它自己的前置都掌握了的节点。
 * 它才是真正的断层起点，也是要推荐补课的位置。
 */

import type {
  KnowledgeNode,
  KnowledgeTree,
  MasteryLevel,
  MasteryRecord,
} from './types';

export interface KnowledgeTreeIndex {
  tree: KnowledgeTree;
  byId: Map<string, KnowledgeNode>;
  /** 邻接表：nodeId -> 它的前置依赖 id 列表 */
  prerequisitesOf: Map<string, string[]>;
  /** 反向邻接表：nodeId -> 依赖它的节点 id 列表 */
  dependentsOf: Map<string, string[]>;
  /** 没有任何前置依赖的根节点 */
  roots: string[];
}

export function indexTree(tree: KnowledgeTree): KnowledgeTreeIndex {
  const byId = new Map<string, KnowledgeNode>();
  const prerequisitesOf = new Map<string, string[]>();
  const dependentsOf = new Map<string, string[]>();
  const roots: string[] = [];

  for (const node of tree.nodes) {
    if (byId.has(node.id)) {
      throw new Error(`知识树存在重复节点 id：${node.id}`);
    }
    byId.set(node.id, node);
    prerequisitesOf.set(node.id, [...node.prerequisites]);
    if (node.prerequisites.length === 0) roots.push(node.id);
  }

  for (const node of tree.nodes) {
    for (const pre of node.prerequisites) {
      if (!byId.has(pre)) {
        throw new Error(`节点 ${node.id} 声明了不存在的前置依赖：${pre}`);
      }
      const list = dependentsOf.get(pre);
      if (list) list.push(node.id);
      else dependentsOf.set(pre, [node.id]);
    }
  }

  // 环检测：前置依赖关系必须是 DAG，否则回溯会死循环
  detectCycle(byId, prerequisitesOf);

  return { tree, byId, prerequisitesOf, dependentsOf, roots };
}

function detectCycle(
  byId: Map<string, KnowledgeNode>,
  prerequisitesOf: Map<string, string[]>,
): void {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of byId.keys()) color.set(id, WHITE);

  const visit = (id: string, stack: string[]): void => {
    color.set(id, GRAY);
    for (const pre of prerequisitesOf.get(id) ?? []) {
      const c = color.get(pre);
      if (c === GRAY) {
        throw new Error(`知识树前置依赖存在环：${[...stack, pre].join(' -> ')}`);
      }
      if (c === WHITE) visit(pre, [...stack, pre]);
    }
    color.set(id, BLACK);
  };

  for (const id of byId.keys()) {
    if (color.get(id) === WHITE) visit(id, [id]);
  }
}

/** 某节点的全部前置依赖（传递闭包），不含自身 */
export function prerequisiteClosure(
  index: KnowledgeTreeIndex,
  nodeId: string,
): Set<string> {
  const result = new Set<string>();
  const queue = [...(index.prerequisitesOf.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (result.has(current)) continue;
    result.add(current);
    queue.push(...(index.prerequisitesOf.get(current) ?? []));
  }
  return result;
}

/** 某节点的全部后继（依赖它的节点），用于估算「这个断层会波及多少后续内容」 */
export function dependentClosure(
  index: KnowledgeTreeIndex,
  nodeId: string,
): Set<string> {
  const result = new Set<string>();
  const queue = [...(index.dependentsOf.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (result.has(current)) continue;
    result.add(current);
    queue.push(...(index.dependentsOf.get(current) ?? []));
  }
  return result;
}

/**
 * 在依赖图上求 from -> to 的最短路径（from 必须是 to 的前置）。
 * 返回包含两端的节点 id 序列；不存在路径时返回空数组。
 */
export function prerequisitePath(
  index: KnowledgeTreeIndex,
  fromId: string,
  toId: string,
): string[] {
  if (fromId === toId) return [fromId];
  const prev = new Map<string, string>();
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of index.dependentsOf.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      prev.set(next, current);
      if (next === toId) {
        const path: string[] = [toId];
        let cursor = toId;
        while (cursor !== fromId) {
          cursor = prev.get(cursor) as string;
          path.unshift(cursor);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* 掌握度                                                              */
/* ------------------------------------------------------------------ */

export const MASTERY_THRESHOLD = 60;

export function masteryLevel(score: number | undefined): MasteryLevel {
  if (score === undefined) return 'gap';
  if (score < MASTERY_THRESHOLD) return 'gap';
  if (score < 75) return 'weak';
  if (score < 90) return 'ok';
  return 'solid';
}

export function masteryMap(records: MasteryRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const record of records) map.set(record.nodeId, record.score);
  return map;
}

export interface GapLocation {
  /** 真正的断层节点（= 归因结果 rootCauseNodeId） */
  nodeId: string;
  /** 从断层节点到考点的依赖链，用于界面高亮 */
  chain: string[];
  /** 这个断层失守后，会被波及的后续知识点数量 */
  blastRadius: number;
  /**
   * 断层性质：
   * - `prerequisite` 卡点在上游某个前置节点 —— 归因为「前置断层」
   * - `self` 前置全部健康，问题就出在考点本身 —— 归因为「概念缺失」或「方法误用」
   */
  origin: 'prerequisite' | 'self';
  /** 备选断层，按波及范围降序。主结果不理想时给人看的第二意见 */
  alternatives: { nodeId: string; blastRadius: number }[];
}

/**
 * 失效边界搜索：在 targetId 的前置闭包中，找到「自己是失效的，
 * 但它自己的前置都是健康的」那些节点。它们构成断层的起跳面。
 *
 * 若整个闭包都健康（说明知识基础没问题），返回空数组 ——
 * 此时归因应转向「方法误用」或「审题失误」，而不是硬找一个概念缺口。
 */
export function findGapFrontier(
  index: KnowledgeTreeIndex,
  mastery: Map<string, number>,
  targetId: string,
): { nodeId: string; blastRadius: number }[] {
  const closure = prerequisiteClosure(index, targetId);
  const failing = [...closure].filter(
    (id) => masteryLevel(mastery.get(id)) === 'gap',
  );

  const frontier = failing.filter((id) => {
    const pres = index.prerequisitesOf.get(id) ?? [];
    return pres.every((pre) => masteryLevel(mastery.get(pre)) !== 'gap');
  });

  return frontier
    .map((nodeId) => ({
      nodeId,
      blastRadius: dependentClosure(index, nodeId).size,
    }))
    .sort((a, b) => b.blastRadius - a.blastRadius);
}

/**
 * 定位卡点：综合「是否在通往考点的必经路径上」与「波及范围」做选择。
 * 必经路径上的断层优先——补它收益最直接。
 *
 * 前置闭包全部健康时，判定为「自因断层」：问题不在上游，就在考点本身。
 */
export function locateGap(
  index: KnowledgeTreeIndex,
  mastery: Map<string, number>,
  targetId: string,
): GapLocation | null {
  const targetMastery = masteryLevel(mastery.get(targetId));
  if (targetMastery !== 'gap') return null;

  const frontier = findGapFrontier(index, mastery, targetId);
  if (frontier.length === 0) {
    return {
      nodeId: targetId,
      chain: [targetId],
      blastRadius: dependentClosure(index, targetId).size,
      origin: 'self',
      alternatives: [],
    };
  }

  const onPath = frontier.filter(
    (item) => prerequisitePath(index, item.nodeId, targetId).length > 0,
  );
  const pool = onPath.length > 0 ? onPath : frontier;
  const chosen = pool[0];

  return {
    nodeId: chosen.nodeId,
    chain: prerequisitePath(index, chosen.nodeId, targetId),
    blastRadius: chosen.blastRadius,
    origin: 'prerequisite',
    alternatives: pool.slice(1, 4),
  };
}

/* ------------------------------------------------------------------ */
/* 根源收敛                                                            */
/* ------------------------------------------------------------------ */

export interface GapCluster {
  /**
   * 源头节点。按定义它一定是「失效边界」——
   * 自己没掌握，但它自己的前置都健康，所以补它才是有效的。
   */
  rootNodeId: string;
  /** 被这个源头连带的失效节点（含源头自身） */
  affected: string[];
  /** 源头自身的掌握度 */
  rootScore: number;
  /**
   * 下游知识点总数（不限于已失效的）。
   * 与 affected.length 的区别：affected 只数「已经坏的」，这个数「一共涉及多少」，
   * 用来评估补上它之后能保住多大一片。
   */
  downstream: number;
  /**
   * 综合优先级：带连带数量 + 严重程度两个维度。
   *
   * 为什么不能只按连带数量排：某些课程的依赖链是长而窄的，
   * 一个 42 分的致命缺口下游只挂着一个节点，按纯连通性排会掉到后面去。
   * 教学上真正该先讲的，是「坏得最狠、且影响面不小」的那个。
   */
  priority: number;
}

/** 严重程度权重：源头分越低，加权越高。42 分比 58 分更需要立刻处理 */
function severityWeight(rootScore: number): number {
  return Math.max(0, 60 - rootScore) / 20; // 0 ~ 3
}

/**
 * 把全树的失效节点按「真正的源头」聚类。
 *
 * 这是整个产品最想告诉学生的一句话：
 *   你看起来有十几个知识点不会，要补的其实只有几个。
 *
 * 对学生而言，这比任何鼓励都更能降低无力感；
 * 对教师而言，这决定了复习课该讲什么。
 */
export function groupGapsByOrigin(
  index: KnowledgeTreeIndex,
  mastery: Map<string, number>,
): GapCluster[] {
  const clusters = new Map<string, GapCluster>();

  for (const node of index.tree.nodes) {
    if (masteryLevel(mastery.get(node.id)) !== 'gap') continue;
    const located = locateGap(index, mastery, node.id);
    const rootNodeId = located ? located.nodeId : node.id;

    const existing = clusters.get(rootNodeId);
    if (existing) {
      existing.affected.push(node.id);
      continue;
    }
    const rootScore = mastery.get(rootNodeId) ?? 0;
    clusters.set(rootNodeId, {
      rootNodeId,
      affected: [node.id],
      rootScore,
      downstream: dependentClosure(index, rootNodeId).size,
      priority: 0,
    });
  }

  const list = [...clusters.values()];
  for (const cluster of list) {
    // 连带数（含自身）为主，严重程度为辅：
    // 一个 42 分、下游只挂 1 个节点的致命缺口，不该排在一个
    // 58 分、下游挂 3 个节点的缺口后面。
    cluster.priority =
      cluster.affected.length + severityWeight(cluster.rootScore);
  }

  return list.sort(
    (a, b) =>
      b.priority - a.priority ||
      a.rootScore - b.rootScore ||
      a.rootNodeId.localeCompare(b.rootNodeId),
  );
}

/* ------------------------------------------------------------------ */
/* 统计                                                                */
/* ------------------------------------------------------------------ */

export interface TreeStats {
  total: number;
  gap: number;
  weak: number;
  ok: number;
  solid: number;
  /** 全树平均掌握度，0–100 */
  average: number;
}

export function treeStats(
  index: KnowledgeTreeIndex,
  mastery: Map<string, number>,
): TreeStats {
  const stats: TreeStats = { total: 0, gap: 0, weak: 0, ok: 0, solid: 0, average: 0 };
  let sum = 0;
  for (const node of index.tree.nodes) {
    const score = mastery.get(node.id) ?? 0;
    stats.total += 1;
    sum += score;
    stats[masteryLevel(mastery.get(node.id))] += 1;
  }
  stats.average = stats.total === 0 ? 0 : Math.round(sum / stats.total);
  return stats;
}

/** 按章节聚合，用于教师端热力图 */
export function chapterBreakdown(
  index: KnowledgeTreeIndex,
  mastery: Map<string, number>,
): { chapter: string; total: number; gap: number; average: number }[] {
  const buckets = new Map<string, { total: number; gap: number; sum: number }>();
  for (const node of index.tree.nodes) {
    const bucket = buckets.get(node.chapter) ?? { total: 0, gap: 0, sum: 0 };
    const score = mastery.get(node.id) ?? 0;
    bucket.total += 1;
    bucket.sum += score;
    if (masteryLevel(mastery.get(node.id)) === 'gap') bucket.gap += 1;
    buckets.set(node.chapter, bucket);
  }
  return [...buckets.entries()]
    .map(([chapter, b]) => ({
      chapter,
      total: b.total,
      gap: b.gap,
      average: b.total === 0 ? 0 : Math.round(b.sum / b.total),
    }))
    // numeric: true 必需 —— 否则「第 10 章」会排在「第 1 章」前面（字符串序）
    .sort((a, b) => a.chapter.localeCompare(b.chapter, 'zh-Hans-CN', { numeric: true }));
}
