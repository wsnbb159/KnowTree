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

import type { LlmProvider, LlmRequest } from '@/services/llm/types';
import {
  registerPluginCourse,
  unregisterPluginCourse,
  getAllCourses,
  type CoursePluginInput,
} from '@/data/courses';

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
