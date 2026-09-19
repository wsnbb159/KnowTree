/**
 * 诊断链路各阶段的输入输出契约。
 *
 * 关键架构决策（也是本作品答疑时最该讲的一点）：
 *
 *   模型负责「读懂题」和「讲明白」—— 语言与理解层面的事；
 *   图算法负责「归因」—— 依赖关系上的推理。
 *
 * 原因：大模型在图上推理并不可靠，它会把「看起来相关」的节点说成因果。
 * 而依赖链回溯是确定性算法，可复现、可验证、可对教师解释。
 * 所以归因结果永远由 locateGap 给出，模型只负责把它讲成人话。
 */

import type {
  DiagnosisEvidence,
  NodeCandidate,
  ParsedQuestion,
  VariantQuestion,
} from '../types';

export interface AnalyzeOutput {
  parsed: ParsedQuestion;
  /** 模型给出的候选考点，必须能被知识树解析，未知 id 会被过滤 */
  candidates: NodeCandidate[];
}

export interface ExplainStep {
  title: string;
  /** 支持 Markdown 与 $LaTeX$ */
  body: string;
  /** 这一步对应哪个知识点 */
  nodeId?: string;
}

export interface ExplainOutput {
  /** 第 1 级：引导提示。只给方向，不给做法 —— 学生自己先想 */
  hint: string;
  /** 第 2 级：步骤详解 */
  steps: ExplainStep[];
  /** 第 3 级：完整答案。默认折叠，逐级解锁后才可见 */
  answer: string;
  /** 为什么卡 —— 由模型基于确定性归因结果改写生成 */
  reasoning: string;
  evidence: DiagnosisEvidence[];
}

export interface VariantsOutput {
  questions: VariantQuestion[];
}

/** 模型返回的原始形态可能缺字段，这里做一次防御性归一 */
export function normalizeAnalyze(raw: unknown): AnalyzeOutput {
  const source = (raw ?? {}) as Partial<AnalyzeOutput>;
  const parsed = (source.parsed ?? {}) as Partial<ParsedQuestion>;
  return {
    parsed: {
      studentWork: String(parsed.studentWork ?? ''),
      statement: String(parsed.statement ?? ''),
      formulas: Array.isArray(parsed.formulas) ? parsed.formulas.map(String) : [],
      known: Array.isArray(parsed.known) ? parsed.known.map(String) : [],
      goal: String(parsed.goal ?? ''),
      clues: Array.isArray(parsed.clues) ? parsed.clues.map(String) : [],
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((step, index) => ({
            index: Number(step?.index ?? index + 1),
            content: String(step?.content ?? ''),
            correct: typeof step?.correct === 'boolean' ? step.correct : null,
            nodeIds: Array.isArray(step?.nodeIds) ? step.nodeIds.map(String) : [],
          }))
        : [],
    },
    candidates: Array.isArray(source.candidates)
      ? source.candidates.map((c) => ({
          nodeId: String(c?.nodeId ?? ''),
          confidence: Number(c?.confidence ?? 0),
          reason: String(c?.reason ?? ''),
        }))
      : [],
  };
}

export function normalizeExplain(raw: unknown): ExplainOutput {
  const source = (raw ?? {}) as Partial<ExplainOutput>;
  return {
    hint: String(source.hint ?? ''),
    steps: Array.isArray(source.steps)
      ? source.steps.map((step) => ({
          title: String(step?.title ?? ''),
          body: String(step?.body ?? ''),
          nodeId: step?.nodeId ? String(step.nodeId) : undefined,
        }))
      : [],
    answer: String(source.answer ?? ''),
    reasoning: String(source.reasoning ?? ''),
    evidence: Array.isArray(source.evidence)
      ? source.evidence
          .filter((e) => e && typeof e.quote === 'string')
          .map((e) => ({
            kind: (['node-definition', 'student-step', 'dependency-path'] as const).includes(
              e.kind as never,
            )
              ? e.kind
              : 'node-definition',
            ref: String(e.ref ?? ''),
            quote: String(e.quote),
          }))
      : [],
  };
}

export function normalizeVariants(raw: unknown): VariantsOutput {
  const source = (raw ?? {}) as Partial<VariantsOutput>;
  return {
    questions: Array.isArray(source.questions)
      ? source.questions.map((q, index) => ({
          id: String(q?.id ?? `v${index + 1}`),
          nodeId: String(q?.nodeId ?? ''),
          prompt: String(q?.prompt ?? ''),
          checkpoints: Array.isArray(q?.checkpoints) ? q.checkpoints.map(String) : [],
        }))
      : [],
  };
}
