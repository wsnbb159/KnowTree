/**
 * 单题诊断引擎 —— 五步链路的编排者。
 *
 * 职责边界刻意划得很清楚：
 *   1 拍题            → 数据采集
 *   2 题目理解        → 交给模型（语言理解是它的强项）
 *   3 知识点定位      → 模型给候选，图结构做校验与兜底
 *   4 卡点归因        → **完全由确定性算法决定**，模型无权推翻
 *   5 补救路径        → 步骤由算法定，题目内容交给模型
 *
 * 第 4 步是硬约束。原因很直接：如果让模型自己说「他为什么不会」，
 * 它每次给的答案都可能不同，教师无法信任，学生也无法复现。
 * 归因必须是可复现的算法结论。
 */

import {
  locateGap,
  masteryLevel,
  masteryMap,
  indexTree,
  type GapLocation,
  type KnowledgeTreeIndex,
} from '../knowledge-tree';
import { ERROR_CAUSE_LABEL } from '../types';
import type {
  Course,
  Diagnosis,
  DiagnosisEvidence,
  ErrorCause,
  ExplanationSection,
  KnowledgeTree,
  MasteryRecord,
  NodeCandidate,
  ParsedQuestion,
  VariantQuestion,
} from '../types';
import {
  normalizeAnalyze,
  normalizeExplain,
  normalizeVariants,
} from './contracts';
import {
  buildAnalyzeMessages,
  buildExplainMessages,
  buildVariantsMessages,
  type ExplainContext,
} from '@/services/llm/prompt';
import { extractJson, type LlmProvider } from '@/services/llm/types';

export interface RunDiagnosisInput {
  course: Course;
  tree: KnowledgeTree;
  mastery: MasteryRecord[];
  provider: LlmProvider;
  /** 题目来源：真实照片、PDF 页，或内置样例 */
  source: { name: string; kind: 'photo' | 'pdf' | 'sample'; dataUrl: string };
  /** 每一步的进度回调，用于向学生展示「系统在想什么」 */
  onStage?: (stage: DiagnosisStage, detail?: string) => void;
}

export type DiagnosisStage =
  | 'reading'
  | 'locating'
  | 'attributing'
  | 'planning'
  | 'done';

export const STAGE_LABEL: Record<DiagnosisStage, string> = {
  reading: '正在识别题干与公式',
  locating: '正在挂载到课程知识树',
  attributing: '正在回溯前置依赖，定位真正的卡点',
  planning: '正在生成补救路径',
  done: '诊断完成',
};

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 错因判定。注意它只能在「考点自身失守」时才有机会被判为概念缺失；
 * 若是前置断层，链条上的问题更大，一律优先归为前置断层。
 */
function inferCause(
  gap: GapLocation | null,
  parsed: ParsedQuestion,
  mastery: Map<string, number>,
  targetNodeId: string,
): ErrorCause {
  if (gap && gap.origin === 'prerequisite') return 'prerequisite-break';

  const steps = parsed.steps;
  const hasWork = parsed.studentWork.trim().length > 0 || steps.length > 0;
  if (!hasWork) return 'concept-gap';

  const wrong = steps.filter((step) => step.correct === false).length;
  const right = steps.filter((step) => step.correct === true).length;

  // 大部分步骤是对的，只在某一步走了岔路 —— 概念是懂的，错在方法或条件
  if (right > 0 && wrong <= 1) return 'method-misuse';

  // 考点本身已掌握，题却做错了 —— 大概率是读题或边界条件
  if (masteryLevel(mastery.get(targetNodeId)) !== 'gap') return 'reading-error';

  return 'concept-gap';
}

/** 依赖链证据由算法直接生成，保证每条归因至少有一条不可动摇的依据 */
function chainEvidence(index: KnowledgeTreeIndex, chain: string[]): DiagnosisEvidence {
  const names = chain.map((id) => index.byId.get(id)?.name ?? id);
  return {
    kind: 'dependency-path',
    ref: chain.join('→'),
    quote:
      chain.length > 1
        ? `${names.join(' → ')}：这条前置链上只要有一环没通，后面的都会跟着塌。`
        : `${names[0]} 本身没有建立起来。`,
  };
}

/** 过滤模型编造的节点 id。模型会「看起来合理」地拼出不存在的考点，必须挡住 */
function filterCandidates(
  candidates: NodeCandidate[],
  index: KnowledgeTreeIndex,
): NodeCandidate[] {
  return candidates
    .filter((candidate) => index.byId.has(candidate.nodeId))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/** 候选全落空时的兜底：选一个语义上最可能相关的节点，宁可给方案也不要崩 */
function fallbackTarget(parsed: ParsedQuestion, index: KnowledgeTreeIndex): string {
  const haystack = [
    parsed.statement,
    parsed.studentWork,
    ...parsed.clues,
    ...parsed.steps.flatMap((step) => step.content.split(/[\s，。、；]+/)),
  ].join(' ');

  let best = index.roots[0] ?? index.tree.nodes[0]?.id;
  let bestScore = 0;
  for (const node of index.tree.nodes) {
    let score = 0;
    if (haystack.includes(node.name)) score += 3;
    for (const token of node.name.split(/[与和的]/).filter((t) => t.length >= 2)) {
      if (haystack.includes(token)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = node.id;
    }
  }
  return best;
}

function buildExplainContext(
  index: KnowledgeTreeIndex,
  parsed: ParsedQuestion,
  targetNodeId: string,
  gap: GapLocation | null,
  cause: ErrorCause,
): ExplainContext {
  const target = index.byId.get(targetNodeId);
  const rootNodeId = gap?.nodeId ?? targetNodeId;
  const root = index.byId.get(rootNodeId);
  return {
    parsed,
    targetNodeId,
    targetNodeName: target?.name ?? targetNodeId,
    targetDefinition: target?.summary ?? '',
    rootNodeId,
    rootNodeName: root?.name ?? rootNodeId,
    rootDefinition: root?.summary ?? '',
    rootMisconceptions: root?.misconceptions ?? [],
    chainNames: (gap?.chain ?? [targetNodeId]).map(
      (id) => index.byId.get(id)?.name ?? id,
    ),
    cause,
    blastRadius: gap?.blastRadius ?? 0,
  };
}

export async function runDiagnosis(input: RunDiagnosisInput): Promise<Diagnosis> {
  const { course, tree, mastery, provider, source, onStage } = input;
  const index = indexTree(tree);
  const masteryMapValue = masteryMap(mastery);

  /* ---- 第 2 步：题目理解 ---- */
  onStage?.('reading');
  const analyzeRaw = await provider.complete(buildAnalyzeMessages(tree, source.dataUrl));
  const analyzed = normalizeAnalyze(extractJson<unknown>(analyzeRaw));
  const parsed = analyzed.parsed;

  /* ---- 第 3 步：知识点定位 ---- */
  onStage?.('locating');
  const candidates = filterCandidates(analyzed.candidates, index);
  const targetNodeId =
    candidates[0]?.nodeId ?? fallbackTarget(parsed, index);
  const target = index.byId.get(targetNodeId);
  if (!target) {
    throw new Error('无法把这道题挂到知识树上，请换一张更清晰的题目照片');
  }

  /* ---- 第 4 步：卡点归因（确定性） ---- */
  onStage?.('attributing');
  const gap = locateGap(index, masteryMapValue, targetNodeId);
  const cause = inferCause(gap, parsed, masteryMapValue, targetNodeId);
  const rootNodeId = gap?.nodeId ?? targetNodeId;
  const chain = gap?.chain ?? [targetNodeId];
  const blastRadius = gap?.blastRadius ?? 0;

  /* ---- 第 5 步：讲解与补救 ---- */
  onStage?.('planning');
  const context = buildExplainContext(index, parsed, targetNodeId, gap, cause);

  const explainRaw = await provider.complete(buildExplainMessages(context));
  const explained = normalizeExplain(extractJson<unknown>(explainRaw));

  const rootNode = index.byId.get(rootNodeId);
  const variantsRaw = await provider.complete(
    buildVariantsMessages(
      rootNode?.name ?? rootNodeId,
      rootNode?.summary ?? '',
      rootNode?.misconceptions ?? [],
      course.name,
    ),
  );
  const variants = normalizeVariants(extractJson<unknown>(variantsRaw)).questions
    .map<VariantQuestion>((question, position) => ({
      ...question,
      id: question.id || `v${position + 1}`,
      nodeId: index.byId.has(question.nodeId) ? question.nodeId : rootNodeId,
    }))
    .slice(0, 3);

  const headline =
    chain.length > 1
      ? `你卡住的不是「${target.name}」，而是更早的「${rootNode?.name}」`
      : `这次的问题就在「${rootNode?.name}」本身`;

  const evidence: DiagnosisEvidence[] = [
    chainEvidence(index, chain),
    ...explained.evidence.slice(0, 3),
  ];

  onStage?.('done');

  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    courseId: tree.courseId,
    capture: {
      sourceName: source.name,
      sourceKind: source.kind,
      parsed,
    },
    targetNodeId,
    candidates: candidates.length > 0
      ? candidates
      : [{ nodeId: targetNodeId, confidence: 0.5, reason: '按题干关键词匹配' }],
    rootCauseNodeId: rootNodeId,
    cause,
    causalChain: chain,
    blastRadius,
    reasoning: explained.reasoning || buildFallbackReasoning(context),
    evidence,
    explanation: buildExplanation(explained, index, chain),
    remediation: {
      headline,
      steps: buildRemediationSteps(index, chain, cause),
      variantQuestions: variants,
    },
    engine: provider.kind === 'demo' ? 'demo-fixture' : 'llm',
  };
}

/**
 * 讲解三级内容的兜底与整形。
 * 模型偶尔会漏掉某一级（尤其是不给 hint 直接甩答案），界面按级解锁依赖完整结构，
 * 所以这里宁可换成算法可产的朴素内容，也不允许出现空级。
 */
function buildExplanation(
  explained: ReturnType<typeof normalizeExplain>,
  index: KnowledgeTreeIndex,
  chain: string[],
): ExplanationSection {
  const hint =
    explained.hint?.trim() ||
    `先别看答案：把题干里的「已知」和「要求」各列一行，再想一想这道题要用哪个知识点来搭桥。你之前的步骤停在哪一行？停住的那一行往往就是分岔口。`;

  const steps =
    explained.steps.length > 0
      ? explained.steps.map((step) => ({
          title: step.title,
          body: step.body,
          nodeId: step.nodeId && index.byId.has(step.nodeId) ? step.nodeId : undefined,
        }))
      : // 兜底：沿依赖链逐节点给出「这步靠什么」
        chain.map((nodeId, position) => {
          const node = index.byId.get(nodeId);
          return {
            title: node ? `第 ${position + 1} 步 · ${node.name}` : `第 ${position + 1} 步`,
            body: node
              ? `${node.summary}${
                  node.misconceptions && node.misconceptions.length > 0
                    ? `\n\n容易踩的坑：${node.misconceptions.join('；')}。`
                    : ''
                }`
              : '',
            nodeId,
          };
        });

  const answer =
    explained.answer?.trim() ||
    '（本次模型未返回完整答案。你可以先按上面的步骤自己推一遍，再回来对照。）';

  return { hint, steps, answer };
}

function buildFallbackReasoning(context: ExplainContext): string {
  const tail =
    context.blastRadius > 0
      ? `顺着这条链往下，已经连带影响了 ${context.blastRadius} 个后续知识点。`
      : `补齐它，${context.targetNodeName} 会跟着通。`;
  return `你的错因是「${ERROR_CAUSE_LABEL[context.cause]}」。真正的断层在 ${context.rootNodeName}：${context.rootDefinition}。依赖链是 ${context.chainNames.join(' → ')}。${tail}`;
}

/** 补救步骤由算法基于依赖链生成，保证顺序一定符合知识本身的先后关系 */
function buildRemediationSteps(
  index: KnowledgeTreeIndex,
  chain: string[],
  cause: ErrorCause,
): Diagnosis['remediation']['steps'] {
  const steps: Diagnosis['remediation']['steps'] = [];
  const start = chain[0];
  const startNode = start ? index.byId.get(start) : undefined;

  if (startNode && chain.length > 1) {
    steps.push({
      nodeId: startNode.id,
      title: `先补「${startNode.name}」`,
      action: `${startNode.summary} 这是整条链的起点，不通它后面全是白费。`,
      kind: 'review',
    });
  }

  steps.push({
    nodeId: start ?? index.tree.nodes[0]?.id ?? '',
    title: cause === 'prerequisite-break' ? '做 2 道针对性的基础题' : '重做同类题',
    action:
      cause === 'prerequisite-break'
        ? '不要跳步。每做完一步，就停下来问自己「这一步靠的是哪个知识点」，把依据写在一旁 —— 卡点往往就藏在你写不出依据的那一步。（若是数据结构类课程，建议把栈/表的状态一并画出来。）'
        : '保住你已经对的步骤，重点检查方法选择与适用条件。',
    kind: 'drill',
  });

  steps.push({
    nodeId: chain[chain.length - 1] ?? start ?? '',
    title: '回头重做这道原题',
    action: '如果这次能独立写完整过程，这个知识点就算补上了，掌握度会随之更新。',
    kind: 'verify',
  });

  return steps;
}
