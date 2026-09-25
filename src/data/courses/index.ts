import type { Course, CourseId, KnowledgeTree, MasteryRecord } from '@/domain/types';
import { indexTree } from '@/domain/knowledge-tree';
import type { DemoCase } from '@/fixtures/demo-cases';
import { dataStructureTree } from './data-structure';
import { calculusTree } from './calculus';

/**
 * 课程注册表。
 *
 * 《数据结构》与《高等数学》已完成建模，线代与概率论保留入口但标注为规划中 ——
 * 与其把四门课都做成半成品，不如把两门课做到能被当众验证。
 * 这个取舍会在作品介绍里如实说明。
 *
 * 插件课程：外部可通过 registerPluginCourse 动态注入知识树（如物理、英语），
 * 注入后自动出现在课程下拉菜单里，走同一套归因引擎。
 */
export const courses: Course[] = [
  {
    id: 'data-structure',
    name: '数据结构',
    audience: '计算机类 · 大二上',
    description: '已完整建模：7 章 38 个知识点，含跨章节的隐式前置依赖。',
  },
  {
    id: 'calculus',
    name: '高等数学',
    audience: '理工科 · 大一',
    description:
      '已完整建模：12 章 62 个知识点，含跨模块的隐式前置依赖（第 8 章贯通多元微分与曲面积分、第 11 章三大公式串起曲线/曲面/重积分）。',
  },
  {
    id: 'linear-algebra',
    name: '线性代数',
    audience: '理工科 · 大一',
    description: '规划中：矩阵运算、向量空间、特征值三大模块。',
  },
  {
    id: 'probability',
    name: '概率论与数理统计',
    audience: '理工科 · 大二',
    description: '规划中：随机变量、分布、参数估计与假设检验。',
  },
];

const trees: Partial<Record<CourseId, KnowledgeTree>> = {
  'data-structure': dataStructureTree,
  calculus: calculusTree,
};

/* ------------------------------------------------------------------ */
/* 插件课程（运行时动态注册）                                        */
/* ------------------------------------------------------------------ */

const PLUGIN_COURSES = new Map<string, Course>();
const PLUGIN_TREES = new Map<string, KnowledgeTree>();
/** 插件自带的演示样例（可选）。不带的课程在演示模式下无法回放，只能接真实模型。 */
const PLUGIN_DEMO_CASES = new Map<string, DemoCase[]>();
/** 插件自带的学情画像（可选）。不带的课程用中性基线填充，避免空画像把归因推到根节点。 */
const PLUGIN_MASTERY = new Map<string, MasteryRecord[]>();

/**
 * 校验插件知识树结构。归因引擎对 DAG 有硬性假设，注入前必须检查。
 * 不通过就拒绝注册，否则后面归因会给出荒唐结论且不报错。
 */
function validatePluginTree(tree: KnowledgeTree): { ok: true } | { ok: false; error: string } {
  if (!tree || typeof tree.courseId !== 'string' || !tree.courseId.trim()) {
    return { ok: false, error: '缺少有效的 courseId' };
  }
  if (!Array.isArray(tree.nodes) || tree.nodes.length === 0) {
    return { ok: false, error: 'nodes 为空或不是数组' };
  }
  const ids = new Set<string>();
  for (const node of tree.nodes) {
    if (!node.id || !node.name || !node.chapter) {
      return { ok: false, error: `节点缺少 id/name/chapter（位置：${node.id ?? '未知'}）` };
    }
    if (ids.has(node.id)) {
      return { ok: false, error: `节点 id 重复：${node.id}` };
    }
    ids.add(node.id);
    if (node.prerequisites.includes(node.id)) {
      return { ok: false, error: `节点 ${node.id} 自指依赖` };
    }
    if (!Array.isArray(node.misconceptions) || node.misconceptions.length === 0) {
      return { ok: false, error: `节点 ${node.id} 缺少典型误概念（归因质量的数据基础）` };
    }
    if (!Array.isArray(node.sources) || node.sources.length === 0) {
      return { ok: false, error: `节点 ${node.id} 缺少教材出处（归因可溯源）` };
    }
  }
  // 引用完整性：prerequisites 指向的 id 必须存在
  for (const node of tree.nodes) {
    for (const prereq of node.prerequisites) {
      if (!ids.has(prereq)) {
        return { ok: false, error: `节点 ${node.id} 的前置依赖 ${prereq} 不存在` };
      }
    }
  }
  // 单根 + 无环：用 indexTree 建索引后检查
  try {
    const index = indexTree(tree);
    if (index.roots.length === 0) {
      return { ok: false, error: '没有根节点（所有节点都有前置依赖，存在环）' };
    }
    // 环检测：从每个节点出发沿 prerequisites 回溯，看能否到达根
    const reachRoot = (id: string, seen: Set<string>): boolean => {
      if (seen.has(id)) return false; // 环
      seen.add(id);
      const node = tree.nodes.find((n) => n.id === id);
      if (!node) return false;
      if (index.roots.includes(id)) return true;
      return node.prerequisites.every((p) => reachRoot(p, new Set(seen)));
    };
    for (const node of tree.nodes) {
      const seen = new Set<string>();
      if (!reachRoot(node.id, seen)) {
        return { ok: false, error: `节点 ${node.id} 无法到达根节点（可能存在环）` };
      }
    }
  } catch (e) {
    return { ok: false, error: `知识树索引失败：${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true };
}

export interface CoursePluginInput {
  /** 知识树（必须含 courseId / version / nodes） */
  tree: KnowledgeTree;
  /** 课程显示名（不填则用 courseId） */
  name?: string;
  audience?: string;
  description?: string;
  /** 该课程自带的演示样例（可选，带上才能在无模型时离线回放） */
  demoCases?: DemoCase[];
  /** 该课程自带的学情画像（可选，不带则用中性基线） */
  mastery?: MasteryRecord[];
}

/**
 * 中性基线学情：插件课程没给画像时用它填。
 * 空画像会让归因一路回溯到最上游根节点（这是踩过的坑），
 * 所以宁可给一个「哪里都没塌」的起点，让归因只在真的有洞时才响。
 */
const BASELINE_SCORE = 70;

/**
 * 注册一个插件课程。校验通过后存入内存 map，课程下拉菜单自动出现。
 * 已存在同 courseId 的会被覆盖（热更新）。
 */
export function registerPluginCourse(input: CoursePluginInput): { ok: true } | { ok: false; error: string } {
  const result = validatePluginTree(input.tree);
  if (!result.ok) return result;

  const courseId = input.tree.courseId;
  const course: Course = {
    id: courseId,
    name: input.name ?? courseId,
    audience: input.audience ?? '插件课程',
    description: input.description ?? `插件注入 · ${input.tree.nodes.length} 个知识点`,
  };
  PLUGIN_COURSES.set(courseId, course);
  PLUGIN_TREES.set(courseId, input.tree);
  if (input.demoCases && input.demoCases.length > 0) {
    PLUGIN_DEMO_CASES.set(courseId, input.demoCases);
  } else {
    PLUGIN_DEMO_CASES.delete(courseId);
  }
  if (input.mastery && input.mastery.length > 0) {
    PLUGIN_MASTERY.set(courseId, input.mastery);
  } else {
    PLUGIN_MASTERY.delete(courseId);
  }
  return { ok: true };
}

export function unregisterPluginCourse(courseId: string): void {
  PLUGIN_COURSES.delete(courseId);
  PLUGIN_TREES.delete(courseId);
  PLUGIN_DEMO_CASES.delete(courseId);
  PLUGIN_MASTERY.delete(courseId);
}

/** 插件课程的演示样例；没带则为空数组（内置课程不走这里） */
export function getPluginDemoCases(courseId: string): DemoCase[] | null {
  return PLUGIN_DEMO_CASES.get(courseId) ?? null;
}

/** 插件课程的学情画像；没带则调用方自行用中性基线 */
export function getPluginMastery(courseId: string): MasteryRecord[] | null {
  return PLUGIN_MASTERY.get(courseId) ?? null;
}

export function getPluginCourses(): Course[] {
  return [...PLUGIN_COURSES.values()];
}

/** 全部课程（内置 + 插件），用于下拉菜单渲染 */
export function getAllCourses(): Course[] {
  const pluginIds = new Set(PLUGIN_COURSES.keys());
  return [...courses.filter((c) => !pluginIds.has(c.id)), ...PLUGIN_COURSES.values()];
}

/* ------------------------------------------------------------------ */
/* 查询（内置 + 插件）                                                */
/* ------------------------------------------------------------------ */

export function getCourse(courseId: CourseId): Course | undefined {
  return PLUGIN_COURSES.get(courseId) ?? courses.find((course) => course.id === courseId);
}

export function getTree(courseId: CourseId): KnowledgeTree | undefined {
  return PLUGIN_TREES.get(courseId) ?? trees[courseId];
}

export function isCourseReady(courseId: CourseId): boolean {
  return PLUGIN_TREES.has(courseId) || trees[courseId] !== undefined;
}

export function isPluginCourse(courseId: CourseId): boolean {
  return PLUGIN_TREES.has(courseId);
}

/** 中性基线画像：每个知识点都给同一分数，表明「还没数据」而不是「全都塌了」 */
export function baselineMastery(tree: KnowledgeTree): MasteryRecord[] {
  const now = new Date().toISOString();
  return tree.nodes.map((node) => ({
    nodeId: node.id,
    score: BASELINE_SCORE,
    attempts: 0,
    updatedAt: now,
  }));
}

export const readyCourses = courses.filter((course) => isCourseReady(course.id));
