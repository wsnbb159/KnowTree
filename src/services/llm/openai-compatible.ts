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
        /*
         * 本地服务（Ollama / LM Studio）与云端失败的原因完全不同：
         * 云端多半是网络或地址写错，本地几乎总是「服务没启动」或「没放行跨域」。
         * 给一句同样的话会让人去查网络，白费时间 —— 分开说。
         */
        const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(config.baseUrl);
        throw new LlmError(
          isLocal
            ? '连不上本机模型服务：先确认它已经启动（Ollama 要 ollama serve；LM Studio 要开 Local Server），并允许浏览器跨域访问'
            : '无法连接模型服务，请检查网络或接口地址',
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

/**
 * 服务商预设。
 *
 * 拍题诊断依赖识图能力，所以每个预设都显式标注 supportsVision ——
 * 纯文本模型（DeepSeek、混元 Lite 等）只能承接追问 / 讲解，
 * 界面必须提前拦住，不能等模型报错才让学生知道。
 *
 * 免费额度信息只写「档位」，不写精确数字的失效日期 ——
 * 各平台政策会变，以 keyUrl 指向的控制台为准。
 */
export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  /** 是否支持图片输入；拍题 / PDF 诊断要求 true */
  supportsVision: boolean;
  /** 是否有可用的免费档位（决定界面上的「免费」徽章） */
  free: boolean;
  /** 免费档位说明（一句话，界面上直接展示） */
  freeTier: string;
  /** 申请 API Key 的控制台地址 */
  keyUrl: string;
  /** 补充说明（可选） */
  note?: string;
  /**
   * 本地服务：不需要密钥。
   * 协议上仍要带 Authorization 头，所以内部填一个占位串 ——
   * 界面据此隐藏密钥输入框，用户不必理解这个细节。
   */
  noKey?: boolean;
  /**
   * 推荐项：界面上置顶并加「推荐」徽章。
   * 只给「免费 + 支持识图 + 实测可浏览器直连」三者同时成立的服务商 ——
   * 这是能跑通完整拍题链路的最低成本组合，其余都要在某一项上妥协。
   */
  recommended?: boolean;
}

/** 本地服务的占位密钥。本地网关不看它，但协议要求它非空 */
export const LOCAL_PLACEHOLDER_KEY = 'local';

/**
 * 界面使用的预设顺序：推荐项置顶。
 * 做成函数而不是在数组里手排，是为了让设置页与快速切换按钮共用同一份顺序 ——
 * 两处各自排序迟早会不一致。
 */
export function orderedPresets(): ProviderPreset[] {
  return [...PROVIDER_PRESETS].sort(
    (a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0),
  );
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'doubao',
    label: '豆包 · 火山方舟',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-1-6-vision-250815',
    supportsVision: true,
    free: true,
    freeTier: '新用户每个模型送 50 万 tokens，够诊断上百道题',
    keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    note: '模型名以方舟控制台「在线推理」列表为准，也可直接填推理接入点 ep-xxxxxxxx',
  },
  {
    id: 'hunyuan-lite',
    label: '腾讯混元 Lite',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    model: 'hunyuan-lite',
    supportsVision: false,
    free: true,
    freeTier: '官方宣布永久免费',
    keyUrl: 'https://console.cloud.tencent.com/hunyuan/api-key',
    note: '与元宝同族的腾讯自研模型；不支持识图，仅适合追问、讲解等纯文本任务',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    supportsVision: false,
    free: false,
    freeTier: '无免费档，按量计费但价格极低',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: '不支持识图；想要免费 DeepSeek，可用火山方舟里的 DeepSeek 模型（同样送 50 万 tokens）',
  },
  {
    id: 'siliconflow',
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    supportsVision: false,
    free: true,
    freeTier: '多个小参数模型永久免费，完整版 DeepSeek 低价',
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
    note: '聚合平台，模型名以控制台「模型广场」为准；免费档位模型不支持识图',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4v-flash',
    supportsVision: true,
    free: true,
    freeTier: 'glm-4v-flash 官方永久免费且支持识图；新用户另赠 2000 万 tokens 体验包',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    recommended: true,
  },
  {
    id: 'qwen',
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-max',
    supportsVision: true,
    free: true,
    freeTier: '新用户每个模型有限时免费额度',
    keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
  },
  {
    id: 'ollama',
    label: 'Ollama（本机 · 免密钥）',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
    supportsVision: false,
    free: true,
    freeTier: '完全免费：模型跑在你自己的电脑上，不需要任何 API Key',
    keyUrl: 'https://ollama.com/download',
    noKey: true,
    note:
      '需先装 Ollama 并 ollama pull 一个模型。浏览器跨域要在环境变量里设 OLLAMA_ORIGINS=* 后重启；要识图请换 llava 等视觉模型。',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio（本机 · 免密钥）',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    supportsVision: false,
    free: true,
    freeTier: '完全免费：本地起一个 OpenAI 兼容服务，不需要任何 API Key',
    keyUrl: 'https://lmstudio.ai/',
    noKey: true,
    note:
      '需在 LM Studio 里加载模型并开启 Local Server（默认 1234 端口）。model 名填控制台里显示的那个，常是 local-model。',
  },
  {
    id: 'custom',
    label: '自建网关',
    baseUrl: '',
    model: '',
    supportsVision: true,
    free: false,
    freeTier: '学校或团队自建的 OpenAI 兼容网关',
    keyUrl: '',
  },
];
