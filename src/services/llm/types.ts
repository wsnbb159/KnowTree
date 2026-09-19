/**
 * 模型调用层的契约。
 *
 * 设计原则：这一层只负责「把话递过去、把话拿回来」，
 * 不掺任何教学逻辑。教学逻辑在 domain 层，模型只是它的一个外部能力。
 * 这样才能做到：换掉模型，产品的判断力不下降。
 */

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmTextPart {
  type: 'text';
  text: string;
}

export interface LlmImagePart {
  type: 'image';
  /** data URL（data:image/png;base64,...），便于纯前端直传 */
  dataUrl: string;
}

export type LlmPart = LlmTextPart | LlmImagePart;

export interface LlmMessage {
  role: LlmRole;
  content: string | LlmPart[];
}

export interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** 期望返回严格 JSON，Provider 需据此附加约束 */
  json?: boolean;
  /** 任务标记，内置演示 Provider 用它选择对应的预置回答 */
  task?: LlmTask;
}

export type LlmTask = 'analyze' | 'explain' | 'variants' | 'followup';

export interface LlmProvider {
  readonly id: string;
  readonly label: string;
  readonly kind: 'demo' | 'remote';
  readonly supportsVision: boolean;
  complete(request: LlmRequest): Promise<string>;
}

export interface RemoteLlmConfig {
  /** 形如 https://open.bigmodel.cn/api/paas/v4 */
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

/**
 * 模型经常把 JSON 包在 ```json 代码块里，或在前后加解释。
 * 这里做一次稳健抽取，失败时抛出可读错误，避免上层拿到 undefined 到处崩。
 *
 * 注意实现顺序（这是真实踩过的坑）：
 * 讲解内容里本身就有 ```c 代码块，它们是 JSON 字符串值的一部分，
 * 一上来就做围栏正则剥离，会把 JSON 的内部当成围栏内容切碎。
 * 所以先用「首 { 到尾 }」直接切，只有它失败时才回退到围栏提取。
 */
export function extractJson<T>(raw: string): T {
  const attempt = (text: string): { ok: true; value: T } | { ok: false } => {
    const start = text.search(/[[{]/);
    if (start === -1) return { ok: false };
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (end <= start) return { ok: false };
    try {
      return { ok: true, value: JSON.parse(text.slice(start, end + 1)) as T };
    } catch {
      return { ok: false };
    }
  };

  const trimmed = raw.trim();
  const direct = attempt(trimmed);
  if (direct.ok) return direct.value;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const fromFence = fenced ? attempt(fenced[1]) : undefined;
  if (fromFence?.ok) return fromFence.value;

  throw new LlmError('模型没有返回可解析的 JSON', raw.slice(0, 200));
}
