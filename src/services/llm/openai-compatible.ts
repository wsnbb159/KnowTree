/**
 * OpenAI 兼容协议的 Provider。
 *
 * 之所以选这个协议而不是给某一家做 SDK：智谱、通义、混元、DeepSeek
 * 以及各类自建网关都兼容它，产品因此不被单一厂商绑死 ——
 * 这对一个要交给学校长期使用的工具是必要的。
 */

import {
  LlmError,
  type LlmMessage,
  type LlmPart,
  type LlmProvider,
  type LlmRequest,
  type RemoteLlmConfig,
} from './types';

interface OpenAiContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

function toOpenAiContent(content: string | LlmPart[]): string | OpenAiContentPart[] {
  if (typeof content === 'string') return content;
  return content.map((part) =>
    part.type === 'text'
      ? { type: 'text' as const, text: part.text }
      : { type: 'image_url' as const, image_url: { url: part.dataUrl } },
  );
}

function toOpenAiMessages(messages: LlmMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: toOpenAiContent(message.content),
  }));
}

export function createOpenAiCompatibleProvider(config: RemoteLlmConfig): LlmProvider {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new LlmError('模型配置不完整，需要 baseUrl、apiKey 与 model 三项');
  }
  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  return {
    id: 'openai-compatible',
    label: `远程模型 · ${config.model}`,
    kind: 'remote',
    supportsVision: true,

    async complete(request: LlmRequest): Promise<string> {
      const body: Record<string, unknown> = {
        model: config.model,
        messages: toOpenAiMessages(request.messages),
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 2400,
        stream: false,
      };
      if (request.json) {
        body.response_format = { type: 'json_object' };
      }

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        throw new LlmError(
          '无法连接模型服务，请检查网络或接口地址',
          error instanceof Error ? error.message : String(error),
        );
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new LlmError(
          `模型服务返回 ${response.status}`,
          text.slice(0, 300),
        );
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new LlmError('模型返回内容为空', JSON.stringify(payload).slice(0, 200));
      }
      return content;
    },
  };
}

/** 常见服务商的预设，省去学生自己查接口地址 */
export const PROVIDER_PRESETS: { label: string; baseUrl: string; model: string }[] = [
  { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4v-plus' },
  {
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-max',
  },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: '自建网关', baseUrl: '', model: '' },
];
