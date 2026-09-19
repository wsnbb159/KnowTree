/**
 * F1 多模态提问 —— 拍题入口。
 *
 * 支持四条进题路径：本地上传（含手机拍照）、拖拽、剪贴板粘贴截图、PDF 选页。
 * 没有题目时可一键运行内置样例 —— 评委打开链接的那一刻，不需要准备任何东西。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useStore } from '@/app/store';
import { STAGE_LABEL, type DiagnosisStage } from '@/domain/diagnosis/engine';
import { ERROR_CAUSE_LABEL } from '@/domain/types';
import { looksLikePdf, pdfToPageImages, prepareForModel, readAsDataUrl } from '@/utils/image';
import { Card, CardTitle, Chip } from '@/components/ui';

const STAGE_ORDER: DiagnosisStage[] = ['reading', 'locating', 'attributing', 'planning'];

export function CapturePanel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    running,
    stage,
    error,
    runFromImage,
    runFromDemoCase,
    demoCases,
    diagnoses,
    setActiveDiagnosisId,
    engineMode,
    courseName,
  } = useStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pdfPages, setPdfPages] = useState<{ pageNumber: number; dataUrl: string }[]>([]);
  const [pdfName, setPdfName] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ name: string } | null>(null);

  const busy = running || pdfBusy;

  const runImage = useCallback(
    async (dataUrl: string, name: string, kind: 'photo' | 'pdf') => {
      try {
        const prepared = await prepareForModel(dataUrl);
        /**
         * 演示模式只回放内置样例，不看真实图片。
         * 必须在这里拦下来：若放任它跑，用户拿自己的题会得到样例的结论，
         * 看起来就是个 bug。宁可明确交还选择权，也不给一个像模像样的错误答案。
         */
        if (engineMode === 'demo') {
          setPendingUpload({ name });
          return;
        }
        await runFromImage({ name, kind, dataUrl: prepared });
      } catch (cause) {
        setLocalError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [engineMode, runFromImage],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setLocalError(null);
      /* 演示模式下连解析都省了：直接交还选择权，不让用户白等 pdfjs 加载 */
      if (engineMode === 'demo') {
        setPendingUpload({ name: file.name });
        return;
      }
      if (looksLikePdf(file)) {
        setPdfBusy(true);
        setPdfPages([]);
        try {
          const pages = await pdfToPageImages(file);
          setPdfPages(pages);
          setPdfName(file.name);
        } catch (cause) {
          setLocalError(
            cause instanceof Error
              ? `${cause.message}。也可以把题目截图后直接粘贴进来。`
              : 'PDF 解析失败，请改用截图或照片。',
          );
        } finally {
          setPdfBusy(false);
        }
        return;
      }
      if (!file.type.startsWith('image/')) {
        setLocalError('目前支持图片（拍照 / 截图）与 PDF，其他格式请先截图。');
        return;
      }
      const dataUrl = await readAsDataUrl(file);
      await runImage(dataUrl, file.name, 'photo');
    },
    [engineMode, runImage],
  );

  /* 剪贴板粘贴截图：复习场景里最顺手的一条路 */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? [])[0];
      if (!file) return;
      event.preventDefault();
      void handleFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile]);

  const onInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // 允许连续选择同一个文件
    if (file) await handleFile(file);
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* 拍题区 */}
      <Card padded={false} className="overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          aria-label="上传题目照片或 PDF"
          onClick={() => !busy && fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center px-6 py-12 text-center transition ${
            dragActive ? 'bg-brand-50' : 'bg-transparent'
          } ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50">
            <CameraIcon />
          </div>
          <h2 className="text-[16px] font-medium text-ink-900">拍下不会的题</h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-600">
            点击选择图片，或直接<span className="text-brand-600">拖拽 / Ctrl+V 粘贴截图</span>。
            支持 JPG、PNG 与 PDF（可选页）。拍你的手写过程，诊断会更准。
          </p>
          {engineMode === 'demo' ? (
            <p className="mt-2 rounded-lg bg-[#FAEEDA] px-3 py-1.5 text-[12px] text-[#854F0B]">
              当前是演示模式：上传的题目不会被分析，请用下方内置样例体验完整流程。
            </p>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={onInputChange}
          />
        </div>

        {/* 运行中的五步链路 */}
        {running ? <StageStepper stage={stage} /> : null}
        {pdfBusy ? (
          <div className="border-t border-[var(--line)] px-6 py-4 text-[13px] text-ink-600">
            正在解析 PDF 页面……
          </div>
        ) : null}
      </Card>

      {(localError ?? error) ? (
        <div className="rounded-card border border-[#F7C1C1] bg-[#FCEBEB] px-4 py-3 text-[13px] text-[#A32D2D]">
          {localError ?? error}
        </div>
      ) : null}

      {/* 演示模式下上传了真实题目：明确交还选择权，而不是给一个像模像样的错误结论 */}
      {pendingUpload ? (
        <Card className="animate-fade-up border-[#FAC775] bg-[#FAEEDA]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[14px] font-medium text-[#854F0B]">
                当前是演示模式，无法分析你的题目
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#854F0B]">
                「{pendingUpload.name}」没有被上传，知树也不会假装读懂了它。
                演示模式使用内置样例回放，不看真实图片 —— 换个题目它仍会给出同一份结论。
              </p>
            </div>
            <button
              type="button"
              className="kt-btn shrink-0"
              onClick={() => setPendingUpload(null)}
            >
              关闭
            </button>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <button
              type="button"
              className="kt-btn kt-btn-primary"
              onClick={() => {
                setPendingUpload(null);
                void runFromDemoCase(demoCases[0].id);
              }}
            >
              先回放内置样例，看看效果
            </button>
            <button
              type="button"
              className="kt-btn"
              onClick={() => {
                setPendingUpload(null);
                onNavigate('settings');
              }}
            >
              去配置模型，分析我的题 →
            </button>
          </div>
        </Card>
      ) : null}

      {/* PDF 选页 */}
      {pdfPages.length > 0 ? (
        <Card>
          <CardTitle
            title={`选择要诊断的页面 · ${pdfName}`}
            hint="知树按页诊断，一页一道题的效果最好。"
            right={
              <button
                type="button"
                className="kt-btn"
                onClick={() => {
                  setPdfPages([]);
                  setPdfName('');
                }}
              >
                关闭
              </button>
            }
          />
          <div className="kt-scroll flex gap-3 overflow-x-auto pb-1">
            {pdfPages.map((page) => (
              <button
                key={page.pageNumber}
                type="button"
                disabled={running}
                onClick={() =>
                  void runImage(
                    page.dataUrl,
                    `${pdfName} · 第 ${page.pageNumber} 页`,
                    'pdf',
                  )
                }
                className="group shrink-0 overflow-hidden rounded-lg border border-[var(--line)] transition hover:border-brand-400"
              >
                <img
                  src={page.dataUrl}
                  alt={`第 ${page.pageNumber} 页`}
                  className="h-40 object-cover object-top"
                  style={{ width: 118 }}
                />
                <div className="bg-[var(--surface-sunken)] py-1 text-center text-[12px] text-ink-600 group-hover:text-brand-600">
                  第 {page.pageNumber} 页
                </div>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {/* 内置样例 */}
      <Card>
        <CardTitle
          title="手边没有题？用内置样例走一遍"
          hint={`一道《${courseName}》真题，含学生手写解答。演示模式下无需任何模型配置。`}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {demoCases.map((demoCase) => (
            <button
              key={demoCase.id}
              type="button"
              disabled={busy}
              onClick={() => void runFromDemoCase(demoCase.id)}
              className="group flex gap-3 rounded-card border border-[var(--line)] bg-white p-3 text-left transition hover:border-brand-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <img
                src={demoCase.photo}
                alt={demoCase.label}
                className="h-24 w-20 shrink-0 rounded-lg border border-[var(--line)] bg-[#f3efe4] object-cover object-top"
              />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium text-ink-900">
                  {demoCase.label}
                </div>
                <div className="mt-1 text-[12px] leading-relaxed text-ink-600">
                  {demoCase.brief}
                </div>
                <span className="mt-2 inline-block text-[12px] font-medium text-brand-600 group-hover:text-brand-800">
                  {running ? '诊断中……' : '试这道题 →'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* 最近诊断 */}
      {diagnoses.length > 0 ? (
        <Card>
          <CardTitle title="最近的诊断" hint="点击回看当时的归因结论与讲解。" />
          <ul className="divide-y divide-[var(--line)]">
            {diagnoses.slice(0, 4).map((diagnosis) => (
              <li key={diagnosis.id}>
                <button
                  type="button"
                  onClick={() => setActiveDiagnosisId(diagnosis.id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <Chip
                    tone={
                      diagnosis.cause === 'concept-gap' || diagnosis.cause === 'prerequisite-break'
                        ? 'danger'
                        : 'warn'
                    }
                  >
                    {ERROR_CAUSE_LABEL[diagnosis.cause]}
                  </Chip>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">
                    {diagnosis.capture.parsed.statement || '（未识别到题干）'}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-400">
                    {formatTime(diagnosis.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="px-1 text-center text-[12px] leading-relaxed text-ink-400">
        题目照片只在本次诊断中发送给你配置的模型；诊断记录、掌握度与错题本全部保存在本机浏览器，不上传服务器。
      </p>
    </div>
  );
}

function StageStepper({ stage }: { stage: DiagnosisStage | null }) {
  const currentIndex = stage ? STAGE_ORDER.indexOf(stage) : -1;
  return (
    <ol className="flex items-center gap-0 border-t border-[var(--line)] px-6 py-4">
      {STAGE_ORDER.map((item, index) => {
        const state =
          stage === 'done' || index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'todo';
        return (
          <li key={item} className="flex flex-1 items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full transition ${
                state === 'todo'
                  ? 'bg-[var(--line-strong)]'
                  : state === 'active'
                    ? 'animate-pulse bg-brand-600'
                    : 'bg-brand-400'
              }`}
            />
            <span
              className={`whitespace-nowrap text-[12px] ${
                state === 'todo' ? 'text-ink-400' : 'font-medium text-ink-700'
              }`}
            >
              {STAGE_LABEL[item]}
            </span>
            {index < STAGE_ORDER.length - 1 ? (
              <span className="mx-1 hidden h-px flex-1 bg-[var(--line)] sm:block" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function CameraIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.7A1.5 1.5 0 0 1 10.1 3.5h3.8a1.5 1.5 0 0 1 1.3.8L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke="#0F6E56"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="#0F6E56" strokeWidth="1.6" />
    </svg>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}
