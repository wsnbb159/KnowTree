/**
 * 插件接口：把知树的能力暴露给外部容器。
 *
 * 两个层面的插件：
 *
 * 1. 模型层 —— setLLMAdapter
 *    WorkBuddy 容器注入一个 complete() 函数，知树用它调模型。
 *
 * 2. 知识模块层 —— registerCourse
 *    外部注入一门课程的知识树（物理、英语等），知树自动出现在课程下拉菜单里，
 *    走同一套归因引擎诊断。这就是「知树没有物理英语，但可以插件接入」的实现。
 *
 * 安全：只暴露能力，不暴露 API Key。
 */

import { LlmError } from '@/services/llm/types';
import type { LlmMessage, LlmProvider, LlmRequest, LlmTask } from '@/services/llm/types';
import {
  registerPluginCourse,
  unregisterPluginCourse,
  getAllCourses,
  type CoursePluginInput,
} from '@/data/courses';

/**
 * 对外的任务标记。
 *
 * 内部流水线叫 analyze / explain / variants / followup，这套名字对插件作者是黑话 ——
 * 看到 `analyze` 他不知道自己该干什么、该返回什么。
 * 因此对外收敛成四个通用动词，并显式附带期望的返回格式：
 *
 *   parse 读题 把题目与学生解答读成结构化数据
 *   teach 讲解 分层讲解：引导提示 → 步骤详解 → 完整答案
 *   quiz  出题 围绕指定知识点出 3 道变式复测题
 *   chat  追问 锚定在归因结论上的多轮追问
 *
 * 注意 `teach` 也要返回 JSON（讲解是结构化的三级内容，答案放在最后一级），
 * 里面的正文字段才是 Markdown —— 只有 `chat` 直接返回 Markdown。
 */
export type PluginTask = 'parse' | 'teach' | 'quiz' | 'chat';

/** 期望的返回格式。显式给出，比让插件作者去读文档猜要可靠 */
export type PluginResponseFormat = 'json' | 'text';

export interface PluginLlmRequest {
  task: PluginTask;
  /**
   * 这次该返回什么：
   *   json = 必须返回可解析的 JSON 字符串（允许 ``` 围栏，知树会稳健抽取）
   *   text = Markdown 文本
   */
  responseFormat: PluginResponseFormat;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}

/** 外部注入的模型调用器 —— 只需要 complete 一个方法 */
export interface KnowTreeAdapter {
  complete: (request: PluginLlmRequest) => Promise<string>;
  label?: string;
}

const TASK_TO_PLUGIN: Record<LlmTask, PluginTask> = {
  analyze: 'parse',
  explain: 'teach',
  variants: 'quiz',
  followup: 'chat',
};

/**
 * 把内部请求翻译成插件看得懂的请求。
 * 内部依旧用流水线术语（改它们会牵动提示词与演示样例），
 * 只在插件这一层翻译一次 —— 边界上翻译的代价远小于全局改名。
 */
function toPluginRequest(request: LlmRequest): PluginLlmRequest {
  if (!request.task) {
    throw new LlmError('插件适配器收到缺少 task 的请求，无法确定该做什么');
  }
  return {
    task: TASK_TO_PLUGIN[request.task],
    /*
     * 期望格式直接取自内部请求自带的 json 标记，不另立一张映射表。
     * 这个选择是踩出来的：最初按直觉把 teach 写成 text（"讲解当然是 Markdown"），
     * 但讲解其实是结构化的三级内容，内部 json: true，真按 Markdown 返回会解析失败。
     * 两处事实迟早会对不上 —— 所以让提示词做唯一事实来源。
     */
    responseFormat: request.json === false ? 'text' : 'json',
    messages: request.messages,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxTokens !== undefined ? { maxTokens: request.maxTokens } : {}),
  };
}

/** 知树给插件用的最小 store 视图（避免循环依赖，不引 StoreValue） */
export interface KnowTreeStoreView {
  setExternalAdapter: (adapter: LlmProvider | null) => void;
  readonly mastery: unknown[];
  readonly courseId: string;
  readonly diagnoses: unknown[];
  runFromImage: (target: { name: string; kind: 'photo' | 'pdf' | 'sample'; dataUrl: string }) => Promise<void>;
}

export interface KnowTreeApi {
  version: string;
  /** 注入自定义模型调用器（WorkBuddy 容器用此注入自己的模型） */
  setLLMAdapter(adapter: KnowTreeAdapter | null): void;
  clearLLMAdapter(): void;
  getMastery(): unknown[];
  getActiveCourse(): string;
  getDiagnoses(): unknown[];
  /** 传入题目图片 dataUrl 触发诊断 */
  diagnose(dataUrl: string, name?: string): Promise<void>;
  /** 订阅自定义事件（knowtree:diagnosis / knowtree:adapter / knowtree:ready / knowtree:course） */
  on(event: string, cb: (data: unknown) => void): () => void;
  /** 注册知识模块插件（物理、英语等课程的知识树） */
  registerCourse(input: CoursePluginInput): { ok: true } | { ok: false; error: string };
  /** 注销插件课程 */
  unregisterCourse(courseId: string): void;
  /** 列出全部课程（内置 + 插件） */
  listCourses(): unknown[];
}

let storeGetter: (() => KnowTreeStoreView) | null = null;

export function mountKnowTreeApi(getStore: () => KnowTreeStoreView) {
  storeGetter = getStore;

  const api: KnowTreeApi = {
    version: '1.0.0',

    setLLMAdapter(adapter: KnowTreeAdapter | null) {
      const store = storeGetter?.();
      if (!store) {
        console.warn('[KnowTree] 插件接口尚未就绪，请在 knowtree:ready 事件后调用');
        return;
      }
      if (!adapter) {
        store.setExternalAdapter(null);
        return;
      }
      const provider: LlmProvider = {
        id: 'external-adapter',
        label: adapter.label ?? '外部模型',
        kind: 'remote',
        supportsVision: true,
        complete: (req: LlmRequest) => adapter.complete(toPluginRequest(req)),
      };
      store.setExternalAdapter(provider);
    },

    clearLLMAdapter() {
      storeGetter?.().setExternalAdapter(null);
    },

    getMastery() {
      return storeGetter?.().mastery ?? [];
    },

    getActiveCourse() {
      return storeGetter?.().courseId ?? 'data-structure';
    },

    getDiagnoses() {
      return storeGetter?.().diagnoses ?? [];
    },

    async diagnose(dataUrl: string, name = '插件传入') {
      const store = storeGetter?.();
      if (!store) throw new Error('知树尚未就绪');
      await store.runFromImage({ name, kind: 'photo', dataUrl });
    },

    on(event: string, cb: (data: unknown) => void): () => void {
      const handler = (e: Event) => cb((e as CustomEvent).detail);
      window.addEventListener(event, handler);
      return () => window.removeEventListener(event, handler);
    },

    registerCourse(input: CoursePluginInput): { ok: true } | { ok: false; error: string } {
      const result = registerPluginCourse(input);
      if (result.ok) {
        // 通知 store 重新渲染课程下拉菜单
        window.dispatchEvent(
          new CustomEvent('knowtree:course', { detail: { courseId: input.tree.courseId, action: 'register' } }),
        );
      }
      return result;
    },

    unregisterCourse(courseId: string): void {
      unregisterPluginCourse(courseId);
      window.dispatchEvent(
        new CustomEvent('knowtree:course', { detail: { courseId, action: 'unregister' } }),
      );
    },

    listCourses(): unknown[] {
      return getAllCourses();
    },
  };

  (window as unknown as { KnowTree: KnowTreeApi }).KnowTree = api;
  // 告诉外部容器：知树接口已挂载，可以注入 adapter 了
  window.dispatchEvent(new CustomEvent('knowtree:ready', { detail: { version: api.version } }));
}

/** 派发诊断完成事件，供插件监听 */
export function emitDiagnosisEvent(diagnosisId: string, courseId: string) {
  window.dispatchEvent(
    new CustomEvent('knowtree:diagnosis', { detail: { diagnosisId, courseId } }),
  );
}
