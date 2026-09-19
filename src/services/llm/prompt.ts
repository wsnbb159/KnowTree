/**
 * 提示词模板。
 *
 * 这些提示词承载的是教学法，不是「让模型回答」的胶水代码：
 * - 讲解必须分三级，答案不许抢答
 * - 归因不许模型自己推，只能改写图算法给出的确定性结论
 * - 每条结论必须挂证据
 */

import { COGNITIVE_LABEL, ERROR_CAUSE_HINT, ERROR_CAUSE_LABEL } from '@/domain/types';
import type { ErrorCause, KnowledgeTree, ParsedQuestion } from '@/domain/types';

/**
 * 把知识树压成模型可读的紧凑清单。
 *
 * 注意扩展性边界：这里把整棵树塞进上下文，在 200 个节点以内既准又省事；
 * 若课程规模再大一个数量级，应改为「按题干关键词预召回候选章节」再注入。
 * 这个取舍写在这里，是为了后来者知道该在什么时候动它。
 */
export function treeDigest(tree: KnowledgeTree): string {
  const byChapter = new Map<string, string[]>();
  for (const node of tree.nodes) {
    const list = byChapter.get(node.chapter) ?? [];
    list.push(`${node.id}｜${node.name}｜前置:${node.prerequisites.join(',') || '无'}`);
    byChapter.set(node.chapter, list);
  }
  return [...byChapter.entries()]
    .map(([chapter, lines]) => `## ${chapter}\n${lines.join('\n')}`)
    .join('\n\n');
}

const ANALYZE_SYSTEM = `你是一位严谨的工科基础课助教，负责把学生拍来的题目转成结构化数据。

要求：
1. 准确识别题干与学生的手写解答，公式一律转成 LaTeX。
2. 逐步骤拆解学生的解答，逐步判断对错（无法判断时 correct 填 null）。
3. 从给定的知识树中挑选本题涉及的考点，最多 3 个，按置信度降序。
   nodeId 必须来自知识树清单，不得自创。宁可少给，也不要猜。
4. 只输出 JSON，不要任何解释性文字。

JSON 结构：
{
  "parsed": {
    "statement": "题干原文（可含 $LaTeX$）",
    "studentWork": "学生手写解答的转录",
    "formulas": ["$...$"],
    "known": ["已知条件"],
    "goal": "求解目标",
    "clues": ["解题线索，如 递归、第 k 层"],
    "steps": [{ "index": 1, "content": "步骤内容", "correct": true, "nodeIds": ["ds.xxx"] }]
  },
  "candidates": [{ "nodeId": "ds.xxx", "confidence": 0.0, "reason": "判断理由" }]
}`;

const EXPLAIN_SYSTEM = `你是一位懂得「不抢答」的工科基础课助教。你的学生刚做错了一道题。

最重要的一条纪律：**不要一上来就给答案。**
讲解必须分三级，学生逐级解锁：

- level 1「引导提示」：只给思考方向和一个反问，不给任何具体做法。学生看了应该更想自己想，而不是更想抄。
- level 2「步骤详解」：把正确思路一步步讲清楚，每步说明「为什么这样做」。这一步可以讲方法，但仍不要给出最终数值结果。
- level 3「完整答案」：给出完整推导与最终结果。

另外提供：
- reasoning：用两三句话解释这位学生**为什么卡住**。严重要求：归因结论（卡点节点、错因类型、依赖链）已经由算法确定，你**只能解释它、不许推翻它**。要具体、要戳中，不要说「基础不牢」这种废话。
- evidence：每条 1–3 条，必须来自给你的知识点定义或学生自己的解答原文，不许编造。

数学公式一律用 $LaTeX$。正文可用 Markdown。只输出 JSON。

JSON 结构：
{
  "hint": "引导提示",
  "steps": [{ "title": "步骤小标题", "body": "讲解内容", "nodeId": "ds.xxx" }],
  "answer": "完整答案",
  "reasoning": "为什么卡",
  "evidence": [{ "kind": "node-definition", "ref": "ds.xxx", "quote": "引用原文" }]
}`;

const VARIANTS_SYSTEM = `你是一位工科基础课助教，要根据学生的具体卡点设计「复测题」。

要求：
1. 题目必须**恰好考同一个知识点**，不要顺带考别的东西 —— 我们要验证的是这一个洞补上没有。
2. 难度与原题相当或略低，目的是让学生做对一次，重建信心。
3. 每题给出 2–3 条判定要点（checkpoints），用于批改，不展示给学生。
4. 共出 3 题。只输出 JSON。

JSON 结构：
{ "questions": [{ "id": "v1", "nodeId": "ds.xxx", "prompt": "题目（可含 $LaTeX$）", "checkpoints": ["要点"] }] }`;

export interface ExplainContext {
  parsed: ParsedQuestion;
  targetNodeId: string;
  targetNodeName: string;
  targetDefinition: string;
  rootNodeId: string;
  rootNodeName: string;
  rootDefinition: string;
  rootMisconceptions: string[];
  chainNames: string[];
  cause: ErrorCause;
  blastRadius: number;
}

function userPayload(context: ExplainContext): string {
  return [
    `【题目】${context.parsed.statement}`,
    `【学生解答】${context.parsed.studentWork || '（学生没有写出过程，只留了空白）'}`,
    `【本题考点】${context.targetNodeName}：${context.targetDefinition}`,
    '【算法给出的归因结论 —— 不可推翻，只能解释】',
    `- 真正卡住的知识点：${context.rootNodeName}`,
    `- 该知识点的定义：${context.rootDefinition}`,
    `- 该知识点常见的误解：${context.rootMisconceptions.join('；') || '（未收录）'}`,
    `- 错因类型：${ERROR_CAUSE_LABEL[context.cause]}（${ERROR_CAUSE_HINT[context.cause]}）`,
    `- 依赖链：${context.chainNames.join(' → ')}`,
    `- 若补齐该知识点，可连带修复 ${context.blastRadius} 个后续知识点`,
  ].join('\n');
}

export function buildAnalyzeMessages(tree: KnowledgeTree, imageDataUrl: string) {
  return {
    task: 'analyze' as const,
    json: true,
    temperature: 0.1,
    messages: [
      { role: 'system' as const, content: ANALYZE_SYSTEM },
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: `这是《${tree.courseId}》的知识树清单：\n\n${treeDigest(tree)}` },
          { type: 'text' as const, text: '请分析这张照片里的题目与学生解答：' },
          { type: 'image' as const, dataUrl: imageDataUrl },
        ],
      },
    ],
  };
}

export function buildExplainMessages(context: ExplainContext) {
  return {
    task: 'explain' as const,
    json: true,
    temperature: 0.4,
    messages: [
      { role: 'system' as const, content: EXPLAIN_SYSTEM },
      { role: 'user' as const, content: userPayload(context) },
    ],
  };
}

export function buildVariantsMessages(
  rootNodeName: string,
  rootDefinition: string,
  rootMisconceptions: string[],
  courseName: string,
) {
  return {
    task: 'variants' as const,
    json: true,
    temperature: 0.7,
    messages: [
      { role: 'system' as const, content: VARIANTS_SYSTEM },
      {
        role: 'user' as const,
        content: [
          `课程：${courseName}`,
          `要复测的知识点：${rootNodeName}`,
          `知识点定义：${rootDefinition}`,
          `学生在这个点上的典型误解：${rootMisconceptions.join('；') || '（未收录）'}`,
          '请据此设计 3 道复测题。',
        ].join('\n'),
      },
    ],
  };
}

/** 追问只需要归因三要素：讲解界面据此重建上下文 */
export interface FollowupContext {
  targetNodeName: string;
  rootNodeName: string;
  cause: ErrorCause;
}

export function buildFollowupMessages(
  history: { role: 'user' | 'assistant'; content: string }[],
  context: FollowupContext,
) {
  return {
    task: 'followup' as const,
    json: false,
    temperature: 0.5,
    messages: [
      {
        role: 'system' as const,
        content: `你是「知树」的教学助手，正在辅导一位学生。学生刚做错一道题，你给出的诊断结论是：
- 表面考点：${context.targetNodeName}
- 真正卡住的地方：${context.rootNodeName}
- 错因类型：${ERROR_CAUSE_LABEL[context.cause]}

现在学生继续追问。请：
1. 直接回答他的问题，不要重复已经讲过的内容。
2. 回答时始终围绕「他卡住的那个知识点」组织内容，帮他真正补上这个洞，而不是只把当前这道题讲完。
3. 公式用 $LaTeX$，正文可用 Markdown。
4. 简洁，不说套话。`,
      },
      ...history.map((message) => ({ role: message.role, content: message.content })),
    ],
  };
}

export const COGNITIVE_HINT = COGNITIVE_LABEL;
