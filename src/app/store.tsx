/**
 * 应用状态。
 *
 * 刻意保持成一个扁平的、可序列化的状态树：
 * 所有持久化数据都是纯 JSON，所有派生数据（知识树索引、统计）
 * 都在这里用 useMemo 算出来，界面组件不自己算东西。
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { groupGapsByOrigin, indexTree, masteryMap, treeStats } from '@/domain/knowledge-tree';
import type { CourseId, Diagnosis, KnowledgeTree, MasteryRecord } from '@/domain/types';
import { getCourse, getTree, readyCourses } from '@/data/courses';
import {
  runDiagnosis,
  type DiagnosisStage,
} from '@/domain/diagnosis/engine';
import { createDemoProvider } from '@/services/llm/demo';
import { createOpenAiCompatibleProvider } from '@/services/llm/openai-compatible';
import { buildFollowupMessages } from '@/services/llm/prompt';
import type { LlmProvider, RemoteLlmConfig } from '@/services/llm/types';
import { makeThumbnail } from '@/utils/image';
import {
  applyMasteryUpdate,
  createReviewItem,
  dueReviews,
  loadActiveCourse,
  loadDiagnoses,
  loadLlmConfig,
  loadMastery,
  loadReviews,
  saveActiveCourse,
  saveDiagnosis,
  saveLlmConfig,
  saveReviews,
  scheduleNext,
  type ReviewItem,
} from '@/services/storage/repository';
import { demoCases } from '@/fixtures/demo-cases';
import { calcDemoCases } from '@/fixtures/demo-cases-calculus';
import { demoMastery } from '@/fixtures/demo-mastery';
import { calculusMastery } from '@/fixtures/demo-mastery-calculus';

/* ------------------------------------------------------------------ */
/* 按课程分发演示数据                                                  */
/* ------------------------------------------------------------------ */

/**
 * 演示样例与学情画像都必须按课程取，否则切到《高数》后会拿到《数据结构》的
 * 样例和画像 —— 归因会给出荒唐结论，而且不报错。这类错误必须在源头收口。
 */
const DEMO_CASES_BY_COURSE: Partial<Record<CourseId, typeof demoCases>> = {
  'data-structure': demoCases,
  calculus: calcDemoCases,
};

const DEMO_MASTERY_BY_COURSE: Partial<Record<CourseId, MasteryRecord[]>> = {
  'data-structure': demoMastery,
  calculus: calculusMastery,
};

export function demoCasesFor(courseId: CourseId): typeof demoCases {
  return DEMO_CASES_BY_COURSE[courseId] ?? demoCases;
}

export function demoMasteryFor(courseId: CourseId): MasteryRecord[] {
  return DEMO_MASTERY_BY_COURSE[courseId] ?? demoMastery;
}

export function findDemoCaseIn(courseId: CourseId, id: string) {
  return demoCasesFor(courseId).find((item) => item.id === id);
}

export type EngineMode = 'demo' | 'remote';

export interface RunTarget {
  name: string;
  kind: 'photo' | 'pdf' | 'sample';
  dataUrl: string;
}

interface StoreValue {
  /* 课程 */
  courseId: CourseId;
  setCourseId: (courseId: CourseId) => void;
  courseName: string;
  tree: KnowledgeTree;
  index: ReturnType<typeof indexTree>;

  /* 掌握度 */
  mastery: MasteryRecord[];
  masteryValues: Map<string, number>;
  stats: ReturnType<typeof treeStats>;
  clusters: ReturnType<typeof groupGapsByOrigin>;

  /* 诊断 */
  diagnoses: Diagnosis[];
  activeDiagnosis: Diagnosis | null;
  setActiveDiagnosisId: (id: string | null) => void;
  stage: DiagnosisStage | null;
  running: boolean;
  error: string | null;
  runFromImage: (target: RunTarget) => Promise<void>;
  runFromDemoCase: (caseId: string) => Promise<void>;
  /** F6 多轮追问：复用诊断时的 Provider 分发，上下文锚定在归因结论上 */
  askFollowup: (
    diagnosis: Diagnosis,
    history: { role: 'user' | 'assistant'; content: string }[],
  ) => Promise<string>;

  /* 错题本 */
  reviews: ReviewItem[];
  due: ReviewItem[];
  addToNotebook: (diagnosis: Diagnosis, prompt: string) => void;
  gradeReview: (reviewId: string, result: 'pass' | 'fail') => void;
  /** 复测题结果：只有做对才回写掌握度，与错题本同一套纪律 */
  recordVariantResult: (diagnosis: Diagnosis, nodeId: string, passed: boolean) => void;

  /* 模型 */
  engineMode: EngineMode;
  setEngineMode: (mode: EngineMode) => void;
  llmConfig: RemoteLlmConfig | null;
  updateLlmConfig: (config: RemoteLlmConfig | null) => void;
  engineLabel: string;

  /* 其他 */
  demoCases: typeof demoCases;
  resetMastery: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const FALLBACK_COURSE: CourseId = 'data-structure';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [courseId, setCourseIdState] = useState<CourseId>(() =>
    loadActiveCourse(FALLBACK_COURSE),
  );
  const [mastery, setMastery] = useState<MasteryRecord[]>(() => {
    const active = loadActiveCourse(FALLBACK_COURSE);
    const loaded = loadMastery(active);
    // 首访种子化：没有本地学情时载入**该门课**的演示画像，让「一个洞导致一章塌方」
    // 的叙事在评委打开链接的第一秒就成立。真实使用后（复测回写）即为用户自己的数据。
    return loaded.length > 0 ? loaded : demoMasteryFor(active);
  });
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>(() => loadDiagnoses());
  const [activeDiagnosisId, setActiveDiagnosisId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>(() => loadReviews());
  const [engineMode, setEngineMode] = useState<EngineMode>('demo');
  const [llmConfig, setLlmConfig] = useState<RemoteLlmConfig | null>(() => loadLlmConfig());
  const [stage, setStage] = useState<DiagnosisStage | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remoteCaseRef = useRef<RunTarget | null>(null);

  const tree = useMemo(
    () => getTree(courseId) ?? getTree(FALLBACK_COURSE)!,
    [courseId],
  );
  const index = useMemo(() => indexTree(tree), [tree]);
  const masteryValues = useMemo(() => masteryMap(mastery), [mastery]);
  const stats = useMemo(() => treeStats(index, masteryValues), [index, masteryValues]);
  const clusters = useMemo(
    () => groupGapsByOrigin(index, masteryValues),
    [index, masteryValues],
  );
  const due = useMemo(() => dueReviews(reviews), [reviews]);

  const setCourseId = useCallback((next: CourseId) => {
    setCourseIdState(next);
    saveActiveCourse(next);
    // 与首访同样的纪律：该课程没有本地学情时，给该课程的演示画像，
    // 而不是让它空着 —— 空画像会让归因一路回溯到最上游根节点
    const loaded = loadMastery(next);
    setMastery(loaded.length > 0 ? loaded : demoMasteryFor(next));
    setActiveDiagnosisId(null);
  }, []);

  const activeDiagnosis = useMemo(
    () => diagnoses.find((item) => item.id === activeDiagnosisId) ?? null,
    [diagnoses, activeDiagnosisId],
  );

  const resolveProvider = useCallback(
    (caseId: string): LlmProvider => {
      if (engineMode === 'remote' && llmConfig) {
        return createOpenAiCompatibleProvider(llmConfig);
      }
      const courseCases = demoCasesFor(courseId);
      const demoCase = findDemoCaseIn(courseId, caseId) ?? courseCases[0];
      return createDemoProvider(demoCase.bundle);
    },
    [courseId, engineMode, llmConfig],
  );

  const run = useCallback(
    async (target: RunTarget, caseId: string) => {
      setRunning(true);
      setError(null);
      setActiveDiagnosisId(null);
      remoteCaseRef.current = target;
      try {
        const provider = resolveProvider(caseId);
        const diagnosis = await runDiagnosis({
          course: getCourse(tree.courseId)!,
          tree,
          mastery,
          provider,
          source: { name: target.name, kind: target.kind, dataUrl: target.dataUrl },
          onStage: (next) => setStage(next),
        });

        // 追问面板需要知道去哪里找预置回答；缩略图只存小图，守住 localStorage 配额
        if (provider.kind === 'demo') diagnosis.demoCaseId = caseId;
        diagnosis.capture.sourceDataUrl = await makeThumbnail(target.dataUrl);

        const nextDiagnoses = saveDiagnosis(diagnosis);
        setDiagnoses(nextDiagnoses);
        setActiveDiagnosisId(diagnosis.id);

        // 诊断本身不直接改掌握度：掌握度只在学生做完复测题后才动，
        // 这样「掌握度」反映的是真实能力，而不是拍题次数。
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setRunning(false);
        setStage(null);
      }
    },
    [mastery, resolveProvider, tree],
  );

  const askFollowup = useCallback(
    async (
      diagnosis: Diagnosis,
      history: { role: 'user' | 'assistant'; content: string }[],
    ): Promise<string> => {
      const provider =
        engineMode === 'remote' && llmConfig
          ? createOpenAiCompatibleProvider(llmConfig)
          : (() => {
              // 追问要找回**这门课、这道题**对应的预置回答。
              // 用诊断自身的 courseId 而不是当前选中的课程 ——
              // 学生可能切了课程再回来看历史诊断，两者会不一致。
              const courseCases = demoCasesFor(diagnosis.courseId);
              const matched = diagnosis.demoCaseId
                ? findDemoCaseIn(diagnosis.courseId, diagnosis.demoCaseId)
                : undefined;
              return createDemoProvider((matched ?? courseCases[0]).bundle);
            })();

      const targetName = index.byId.get(diagnosis.targetNodeId)?.name ?? diagnosis.targetNodeId;
      const rootName = index.byId.get(diagnosis.rootCauseNodeId)?.name ?? diagnosis.rootCauseNodeId;
      return provider.complete(
        buildFollowupMessages(history, {
          targetNodeName: targetName,
          rootNodeName: rootName,
          cause: diagnosis.cause,
        }),
      );
    },
    [engineMode, llmConfig, index],
  );

  const runFromImage = useCallback(
    async (target: RunTarget) => {
      await run(target, demoCasesFor(courseId)[0].id);
    },
    [courseId, run],
  );

  const runFromDemoCase = useCallback(
    async (caseId: string) => {
      const demoCase = findDemoCaseIn(courseId, caseId);
      if (!demoCase) return;
      await run(
        {
          name: `${demoCase.label}（内置样例）`,
          kind: 'sample',
          dataUrl: demoCase.photo,
        },
        caseId,
      );
    },
    [courseId, run],
  );

  const addToNotebook = useCallback((diagnosis: Diagnosis, prompt: string) => {
    setReviews((current) => {
      if (current.some((item) => item.diagnosisId === diagnosis.id)) return current;
      const next = [createReviewItem(diagnosis.courseId, diagnosis, prompt), ...current];
      saveReviews(next);
      return next;
    });
  }, []);

  const gradeReview = useCallback(
    (reviewId: string, result: 'pass' | 'fail') => {
      const target = reviews.find((item) => item.id === reviewId);
      if (!target) return;
      const updated = scheduleNext(target, result);
      const next = reviews.map((item) => (item.id === reviewId ? updated : item));
      saveReviews(next);
      setReviews(next);

      // 复测结果才回写掌握度：答对加分，答错不加也不扣。
      // 注意不要把 setMastery 嵌进 setReviews 的 updater —— updater 必须保持纯粹。
      if (result === 'pass') {
        setMastery((records) =>
          applyMasteryUpdate(target.courseId, target.rootNodeId, 22, records),
        );
      }
    },
    [reviews],
  );

  const recordVariantResult = useCallback(
    (diagnosis: Diagnosis, nodeId: string, passed: boolean) => {
      if (!passed) return;
      setMastery((records) => applyMasteryUpdate(diagnosis.courseId, nodeId, 22, records));
    },
    [],
  );

  const updateLlmConfig = useCallback((config: RemoteLlmConfig | null) => {
    setLlmConfig(config);
    saveLlmConfig(config);
    setEngineMode(config ? 'remote' : 'demo');
  }, []);

  const value: StoreValue = {
    courseId,
    setCourseId,
    courseName: getCourse(courseId)?.name ?? tree.courseId,
    tree,
    index,
    mastery,
    masteryValues,
    stats,
    clusters,
    diagnoses,
    activeDiagnosis,
    setActiveDiagnosisId,
    stage,
    running,
    error,
    runFromImage,
    runFromDemoCase,
    askFollowup,
    reviews,
    due,
    addToNotebook,
    gradeReview,
    recordVariantResult,
    engineMode,
    setEngineMode,
    llmConfig,
    updateLlmConfig,
    engineLabel:
      engineMode === 'remote' && llmConfig
        ? `远程模型 · ${llmConfig.model}`
        : '内置演示数据',
    demoCases: demoCasesFor(courseId),
    resetMastery: () => setMastery(demoMasteryFor(courseId)),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore 必须在 StoreProvider 内使用');
  return value;
}

export const readyCourseList = readyCourses;
