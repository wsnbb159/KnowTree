/**
 * 插件接口：把知树的能力暴露给外部容器。
 *
 * 典型场景：WorkBuddy 容器加载知树网页后，调用
 *   window.KnowTree.setLLMAdapter({ complete: async (req) => { ... } })
 * 注入一个用 WorkBuddy 平台模型的调用器，知树就用它调模型 ——
 * 等效于「以 WorkBuddy 为底层大模型」，而知树不需要知道 WorkBuddy 的 API 长什么样。
 *
 * 安全：只暴露能力，不暴露 API Key（key 只存 localStorage，不经过此接口）。
 * 外部 adapter 收到的是结构化请求，它自己决定怎么转发。
 */

import type { LlmProvider, LlmRequest } from '@/services/llm/types';

/** 外部注入的模型调用器 —— 只需要 complete 一个方法 */
export interface KnowTreeAdapter {
  complete: (request: LlmRequest) => Promise<string>;
  label?: string;
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
  /** 订阅自定义事件（knowtree:diagnosis / knowtree:adapter / knowtree:ready） */
  on(event: string, cb: (data: unknown) => void): () => void;
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
        complete: (req: LlmRequest) => adapter.complete(req),
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
