/**
 * 本地持久化。
 *
 * 纯前端作品的现实约束：没有后端，所有学生数据只能留在浏览器里。
 * 这件事要在界面上如实告诉用户 —— 既是诚实，也是一个卖点：
 * 学生的错题与学情不出本机，比上传到某个服务器更让人放心。
 */

import type {
  CourseId,
  Diagnosis,
  ErrorCause,
  MasteryRecord,
} from '@/domain/types';
import type { RemoteLlmConfig } from '@/services/llm/types';

const KEY_PREFIX = 'knowtree.v1';

const keys = {
  llm: `${KEY_PREFIX}.llm-config`,
  diagnoses: `${KEY_PREFIX}.diagnoses`,
  mastery: `${KEY_PREFIX}.mastery`,
  reviews: `${KEY_PREFIX}.reviews`,
  activeCourse: `${KEY_PREFIX}.active-course`,
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储配额满或隐私模式：静默降级，不能让持久化失败中断诊断流程
  }
}

/* ------------------------------ 模型配置 ------------------------------ */

export function loadLlmConfig(): RemoteLlmConfig | null {
  return read<RemoteLlmConfig | null>(keys.llm, null);
}

export function saveLlmConfig(config: RemoteLlmConfig | null): void {
  write(keys.llm, config);
}

/* ------------------------------ 诊断记录 ------------------------------ */

export function loadDiagnoses(): Diagnosis[] {
  return read<Diagnosis[]>(keys.diagnoses, []);
}

export function saveDiagnosis(diagnosis: Diagnosis): Diagnosis[] {
  const all = [diagnosis, ...loadDiagnoses().filter((item) => item.id !== diagnosis.id)];
  const trimmed = all.slice(0, 60);
  write(keys.diagnoses, trimmed);
  return trimmed;
}

export function deleteDiagnosis(id: string): Diagnosis[] {
  const rest = loadDiagnoses().filter((item) => item.id !== id);
  write(keys.diagnoses, rest);
  return rest;
}

/* ------------------------------ 掌握度 ------------------------------ */

type MasteryStore = Partial<Record<CourseId, MasteryRecord[]>>;

export function loadMastery(courseId: CourseId): MasteryRecord[] {
  const store = read<MasteryStore>(keys.mastery, {});
  return store[courseId] ?? [];
}

/**
 * 根据一次诊断结果更新掌握度。
 * 规则克制：只有「做对了复测题」才加分，做错不扣分 ——
 * 我们不希望学生因为怕掉分而不敢拍题。
 */
export function applyMasteryUpdate(
  courseId: CourseId,
  nodeId: string,
  delta: number,
  base: MasteryRecord[],
): MasteryRecord[] {
  const store = read<MasteryStore>(keys.mastery, {});
  const current = base.length > 0 ? base : store[courseId] ?? [];
  const now = new Date().toISOString();
  const existing = current.find((record) => record.nodeId === nodeId);

  const next: MasteryRecord[] = existing
    ? current.map((record) =>
        record.nodeId === nodeId
          ? {
              ...record,
              score: clamp(record.score + delta),
              attempts: record.attempts + 1,
              updatedAt: now,
            }
          : record,
      )
    : [
        ...current,
        { nodeId, score: clamp(50 + delta), attempts: 1, updatedAt: now },
      ];

  store[courseId] = next;
  write(keys.mastery, store);
  return next;
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ------------------------------ 错题本与间隔重做 ------------------------------ */

export interface ReviewItem {
  id: string;
  courseId: CourseId;
  diagnosisId: string;
  /** 挂载的知识点（考点） */
  targetNodeId: string;
  /** 真实卡点，也是归因标签所指的节点 */
  rootNodeId: string;
  cause: ErrorCause;
  /** 题目摘要，展示在错题本列表里 */
  prompt: string;
  createdAt: string;
  dueAt: string;
  /** 当前间隔（天） */
  intervalDays: number;
  /** 熟练度因子，答错会下调 */
  ease: number;
  reps: number;
  lastResult?: 'pass' | 'fail';
}

/**
 * 间隔重做安排。刻意做成比 SM-2 更宽容的版本：
 * 起步间隔短、答错只回退不归零，因为学生的挫败感比记忆效率更需要照顾。
 */
const LADDER = [1, 3, 7, 16, 35];

export function createReviewItem(
  courseId: CourseId,
  diagnosis: Diagnosis,
  prompt: string,
): ReviewItem {
  const now = new Date();
  return {
    id: `rv_${Math.random().toString(36).slice(2, 10)}`,
    courseId,
    diagnosisId: diagnosis.id,
    targetNodeId: diagnosis.targetNodeId,
    rootNodeId: diagnosis.rootCauseNodeId,
    cause: diagnosis.cause,
    prompt,
    createdAt: now.toISOString(),
    dueAt: addDays(now, LADDER[0]).toISOString(),
    intervalDays: LADDER[0],
    ease: 1,
    reps: 0,
  };
}

export function scheduleNext(item: ReviewItem, result: 'pass' | 'fail'): ReviewItem {
  const now = new Date();
  let ease = item.ease;
  let level = Math.max(0, LADDER.indexOf(item.intervalDays));

  if (result === 'pass') {
    level = Math.min(LADDER.length - 1, level + 1);
    ease = Math.min(1.6, ease + 0.15);
  } else {
    // 回退一级而不是归零：让学生看到「只差一点」，而不是「又要重来」
    level = Math.max(0, level - 1);
    ease = Math.max(0.7, ease - 0.2);
  }

  const intervalDays = LADDER[level];
  return {
    ...item,
    intervalDays,
    ease,
    reps: item.reps + 1,
    lastResult: result,
    dueAt: addDays(now, intervalDays).toISOString(),
  };
}

function addDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

export function loadReviews(): ReviewItem[] {
  return read<ReviewItem[]>(keys.reviews, []);
}

export function saveReviews(items: ReviewItem[]): void {
  write(keys.reviews, items);
}

export function dueReviews(items: ReviewItem[], at = new Date()): ReviewItem[] {
  return items
    .filter((item) => new Date(item.dueAt).getTime() <= at.getTime())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

/* ------------------------------ 其他 ------------------------------ */

export function loadActiveCourse(fallback: CourseId): CourseId {
  return read<CourseId>(keys.activeCourse, fallback);
}

export function saveActiveCourse(courseId: CourseId): void {
  write(keys.activeCourse, courseId);
}

export function isStorageAvailable(): boolean {
  try {
    const probe = `${KEY_PREFIX}.probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
