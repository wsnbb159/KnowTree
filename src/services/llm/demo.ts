/**
 * 内置演示 Provider。
 *
 * 存在的理由不是「图省事」，而是一个产品判断：
 * 作品要交给评委点开链接体验，那一刻不能要求对方先去申请 API Key。
 * 因此默认必须有一条完全不依赖外部服务的完整通路。
 *
 * 演示数据是逐条人工撰写的，不是随便造的假数据 ——
 * 它同时也是我们对外展示「诊断质量」的样板。
 */

import type { LlmProvider, LlmRequest, LlmTask } from './types';
import { LlmError } from './types';

export interface DemoBundle {
  id: string;
  label: string;
  /** 每个任务对应的预置回答（对象形式，内部会序列化为 JSON）。followup 走单独的命中表 */
  responses: Partial<Record<LlmTask, unknown>>;
  /** 追问的预置回答：按关键词命中，未命中时用 defaultReply */
  followups?: { match: string[]; reply: string }[];
  defaultReply?: string;
  /** 界面上展示的推荐追问（措辞刻意包含命中关键词，保证点了一定有高质量回答） */
  suggestedFollowups?: string[];
}

/** 演示模式下保留一点「正在推理」的停顿，让过程对学生是可见的 */
const STAGE_DELAY: Record<LlmTask, number> = {
  analyze: 1100,
  explain: 900,
  variants: 700,
  followup: 500,
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lastUserText(request: LlmRequest): string {
  for (let i = request.messages.length - 1; i >= 0; i -= 1) {
    const message = request.messages[i];
    if (message.role !== 'user') continue;
    if (typeof message.content === 'string') return message.content;
    return message.content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join(' ');
  }
  return '';
}

export function createDemoProvider(bundle: DemoBundle): LlmProvider {
  return {
    id: `demo:${bundle.id}`,
    label: `演示样例 · ${bundle.label}`,
    kind: 'demo',
    supportsVision: true,

    async complete(request: LlmRequest): Promise<string> {
      const task = request.task;
      if (!task) {
        throw new LlmError('演示模式必须声明 task 才能选择对应的预置回答');
      }
      await wait(STAGE_DELAY[task]);

      if (task === 'followup') {
        const question = lastUserText(request);
        const hit = bundle.followups?.find((item) =>
          item.match.some((keyword) => question.includes(keyword)),
        );
        return hit?.reply ?? bundle.defaultReply ?? '（演示样例未覆盖这个问题）';
      }

      const payload = bundle.responses[task];
      if (payload === undefined) {
        throw new LlmError(`演示样例缺少 ${task} 阶段的预置回答`);
      }
      return JSON.stringify(payload);
    },
  };
}
