/**
 * 知树 KnowTree · 领域模型
 *
 * 本文件只描述「知识世界」本身，不依赖任何 UI 或外部服务。
 * 保持纯净是刻意的：诊断算法必须可以脱离界面被单独推理和测试。
 */

/**
 * 课程标识。前四个是内置课程；末尾的 `(string & {})` 保留了字面量补全，
 * 同时允许插件课程（物理、英语等）用自己的 id 注册进来 ——
 * 知识模块是运行时可插拔的，类型上就不能把它写死。
 */
export type CourseId =
  | 'data-structure'
  | 'calculus'
  | 'linear-algebra'
  | 'probability'
  | (string & {});

export interface Course {
  id: CourseId;
  name: string;
  /** 面向的专业/学期，用于教师端与学生端的语境提示 */
  audience: string;
  description: string;
}

/**
 * 认知层次，对齐 Bloom 修订版。
 * 用途：同样是「掌握」，`apply` 层与 `analyze` 层的漏点含义完全不同，
 * 归因时必须区分——学生可能能背定义（remember）但不会用（apply）。
 */
export type CognitiveLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

export const COGNITIVE_LABEL: Record<CognitiveLevel, string> = {
  remember: '记忆',
  understand: '理解',
  apply: '应用',
  analyze: '分析',
  evaluate: '评价',
  create: '创造',
};

export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** 知识点：知识树上的一个节点 */
export interface KnowledgeNode {
  /** 稳定标识，形如 `ds.tree.traversal`。写入错题记录后不得变更 */
  id: string;
  courseId: CourseId;
  name: string;
  /** 章节归属，如「第4章 树与二叉树」 */
  chapter: string;
  /** 一句话定义，是归因时向学生引用的证据来源 */
  summary: string;
  difficulty: Difficulty;
  cognitive: CognitiveLevel;
  /**
   * 前置依赖：必须先掌握这些节点，才能掌握本节点。
   * 有向边的方向为 `prerequisite -> this`。
   */
  prerequisites: string[];
  /**
   * 典型误概念。归因引擎用它把「学生说什么」映射到「他脑子里错在哪」。
   * 这是本作品区别于普通 AI 讲题的关键数据资产。
   */
  misconceptions?: string[];
  /** 证据出处，如教材章节号，用于归因结果的溯源展示 */
  sources?: string[];
}

/** 一门课的完整知识树 */
export interface KnowledgeTree {
  courseId: CourseId;
  version: string;
  nodes: KnowledgeNode[];
}

/* ------------------------------------------------------------------ */
/* 错因分类                                                            */
/* ------------------------------------------------------------------ */

/**
 * 错因被强制收敛到有限类别，而不是让模型自由发挥。
 * 理由：自由文本的归因无法被验证，也长得像废话。
 */
export type ErrorCause =
  /** 概念缺失：这个知识点本身就没学会 */
  | 'concept-gap'
  /** 前置断层：卡点不在考点上，而在更早的前置节点 */
  | 'prerequisite-break'
  /** 方法误用：概念懂，但选了不适用的方法或套错条件 */
  | 'method-misuse'
  /** 审题失误：知识都会，读题或边界条件出错 */
  | 'reading-error';

export const ERROR_CAUSE_LABEL: Record<ErrorCause, string> = {
  'concept-gap': '概念缺失',
  'prerequisite-break': '前置断层',
  'method-misuse': '方法误用',
  'reading-error': '审题失误',
};

export const ERROR_CAUSE_HINT: Record<ErrorCause, string> = {
  'concept-gap': '这个知识点本身没有建立起来',
  'prerequisite-break': '真正缺的是更早的一个前置知识点',
  'method-misuse': '概念懂，但方法选择或适用条件出错',
  'reading-error': '知识都会，问题出在读题和边界条件',
};

/* ------------------------------------------------------------------ */
/* 诊断结果                                                            */
/* ------------------------------------------------------------------ */

/** 归因证据：每一条归因都必须挂上可核对的依据 */
export interface DiagnosisEvidence {
  kind: 'node-definition' | 'student-step' | 'dependency-path';
  /** 指向的知识点 id，或学生解题步骤的序号 */
  ref: string;
  quote: string;
}

/** 学生解题步骤的解析结果 */
export interface SolutionStep {
  index: number;
  content: string;
  /** 该步骤是否正确，null 表示无法判定 */
  correct: boolean | null;
  /** 该步骤关联的知识点 */
  nodeIds: string[];
}

/** 题目理解结果（链路第 2 步） */
export interface ParsedQuestion {
  /** OCR 得到的学生手写解答原文 */
  studentWork: string;
  /** 题干正文 */
  statement: string;
  /** 公式，统一以 LaTeX 表达 */
  formulas: string[];
  known: string[];
  goal: string;
  /** 解题所需的线索，如「第 k 层」「递归」 */
  clues: string[];
  steps: SolutionStep[];
}

/** 知识点定位结果（链路第 3 步） */
export interface NodeCandidate {
  nodeId: string;
  /** 0–1，映射置信度 */
  confidence: number;
  reason: string;
}

/** 补救计划（链路第 5 步） */
export interface RemediationStep {
  nodeId: string;
  title: string;
  action: string;
  kind: 'review' | 'drill' | 'verify';
}

export interface VariantQuestion {
  id: string;
  nodeId: string;
  prompt: string;
  /** 复测用的判定要点，不展示给学生 */
  checkpoints: string[];
}

export interface RemediationPlan {
  headline: string;
  steps: RemediationStep[];
  variantQuestions: VariantQuestion[];
}

/**
 * 分层讲解（F2）。
 *
 * 三级必须分开存，这不是排版需要而是教学需要：
 * 「引导提示」和「完整答案」如果同时出现在屏幕上，学生只会看答案。
 * 数据结构上分开，界面上才有办法强制分级解锁。
 */
export interface ExplanationSection {
  /** 第 1 级：只给方向，不给做法 */
  hint: string;
  /** 第 2 级：分步详解，讲方法但不给最终结果 */
  steps: { title: string; body: string; nodeId?: string }[];
  /** 第 3 级：完整答案 */
  answer: string;
}

/** 一次完整诊断 */
export interface Diagnosis {
  id: string;
  createdAt: string;
  courseId: CourseId;
  capture: {
    sourceName: string;
    /** 演示模式下为内置样例的配图说明 */
    sourceKind: 'photo' | 'pdf' | 'sample';
    /** 原始照片的缩略图（本地 canvas 生成，避免把大图塞进 localStorage） */
    sourceDataUrl?: string;
    parsed: ParsedQuestion;
  };
  /** 演示样例来源。追问面板需要它找回对应的预置回答 */
  demoCaseId?: string;
  /** 第 3 步：题目直接考查的节点 */
  targetNodeId: string;
  candidates: NodeCandidate[];
  /** 第 4 步：真正卡住的节点，可能比 target 更靠前 */
  rootCauseNodeId: string;
  cause: ErrorCause;
  /** 从 rootCause 到 target 的依赖链，用于界面上的高亮路径 */
  causalChain: string[];
  /** 这个断层会波及的后续知识点数量（图算法直接给出） */
  blastRadius?: number;
  /** 用人话解释「为什么卡」 */
  reasoning: string;
  evidence: DiagnosisEvidence[];
  explanation: ExplanationSection;
  remediation: RemediationPlan;
  /** 诊断来源，用于界面上如实标注 */
  engine: 'demo-fixture' | 'llm';
}

/* ------------------------------------------------------------------ */
/* 掌握度                                                              */
/* ------------------------------------------------------------------ */

export interface MasteryRecord {
  nodeId: string;
  /** 0–100 */
  score: number;
  attempts: number;
  updatedAt: string;
}

export type MasteryLevel = 'gap' | 'weak' | 'ok' | 'solid';

export const MASTERY_LEVEL_LABEL: Record<MasteryLevel, string> = {
  gap: '未掌握',
  weak: '薄弱',
  ok: '基本掌握',
  solid: '扎实',
};
