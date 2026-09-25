/**
 * 诊断结果页 —— 产品叙事的主舞台。
 *
 * 信息顺序就是诊断的思考顺序：
 * 读题 → 归因（卡在哪、为什么）→ 分层讲解（逐级解锁，不抢答）→ 追问 → 补救 → 复测。
 * 学生从头滑到尾，恰好就是「拍下题 → 知道自己缺什么 → 补上它」的完整闭环。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/app/store';
import { RichText } from '@/components/RichText';
import { Card, CardTitle, ChainFlow, Chip, EmptyHint } from '@/components/ui';
import { ModelSwitcher } from '@/views/ModelSwitcher';
import { dependentClosure } from '@/domain/knowledge-tree';
import { ERROR_CAUSE_HINT, ERROR_CAUSE_LABEL } from '@/domain/types';
import { findDemoCase } from '@/fixtures/demo-cases';

const EVIDENCE_KIND_LABEL: Record<string, string> = {
  'node-definition': '知识点定义',
  'student-step': '你的解答',
  'dependency-path': '依赖链',
};

const GENERIC_SUGGESTIONS = ['这道题最关键的一步是什么？', '我以后怎么避免再犯？'];

export function DiagnosisView({
  onGoCapture,
  onNavigate,
}: {
  onGoCapture: () => void;
  onNavigate: (tab: string) => void;
}) {
  const { activeDiagnosis, index, masteryValues, reviews, addToNotebook, askFollowup, recordVariantResult } =
    useStore();

  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [variantResults, setVariantResults] = useState<Record<string, 'pass' | 'fail'>>({});

  /* 换了诊断，解锁状态全部归位：讲解分级必须从第 1 级重新开始 */
  useEffect(() => {
    setLevel(1);
    setVariantResults({});
  }, [activeDiagnosis?.id]);

  const inNotebook = useMemo(
    () =>
      activeDiagnosis
        ? reviews.find((item) => item.diagnosisId === activeDiagnosis.id) ?? null
        : null,
    [activeDiagnosis, reviews],
  );

  if (!activeDiagnosis) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyHint>
          还没有正在查看的诊断。去拍一道题，或运行一个内置样例。
          <div className="mt-4">
            <button type="button" className="kt-btn kt-btn-primary" onClick={onGoCapture}>
              去拍题
            </button>
          </div>
        </EmptyHint>
      </div>
    );
  }

  const diagnosis = activeDiagnosis;
  const target = index.byId.get(diagnosis.targetNodeId);
  const rootNode = index.byId.get(diagnosis.rootCauseNodeId);
  const chainNodes = diagnosis.causalChain.map((id) => ({
    id,
    name: index.byId.get(id)?.name ?? id,
    score: masteryValues.get(id),
  }));
  /* 旧版本诊断记录没有持久化 blastRadius，用图算法现场补算，保证口径一致 */
  const blastRadius =
    diagnosis.blastRadius ?? dependentClosure(index, diagnosis.rootCauseNodeId).size;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ModelSwitcher onGoSettings={() => onNavigate('settings')} />
      {/* 结论横幅 */}
      <div className="animate-fade-up rounded-card border border-brand-200 bg-brand-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={diagnosis.cause === 'prerequisite-break' ? 'danger' : 'warn'}>
            {ERROR_CAUSE_LABEL[diagnosis.cause]}
          </Chip>
          <Chip tone="neutral">
            {diagnosis.engine === 'llm' ? '远程模型诊断' : '内置演示数据'}
          </Chip>
          <span className="font-mono text-[11px] text-ink-400">{formatTime(diagnosis.createdAt)}</span>
        </div>
        <h1 className="mt-2.5 text-[19px] font-medium leading-snug text-ink-900">
          {diagnosis.remediation.headline}
        </h1>
        <p className="mt-1 text-[13px] text-brand-800">{ERROR_CAUSE_HINT[diagnosis.cause]}</p>
      </div>

      {/* 题目理解 */}
      <Card>
        <CardTitle title="知树读到的题目" hint="多模态识别结果，公式已转为 LaTeX。" />
        <div className="flex flex-col gap-3 sm:flex-row">
          {diagnosis.capture.sourceDataUrl ? (
            <img
              src={diagnosis.capture.sourceDataUrl}
              alt="原始题目照片"
              className="h-40 w-32 shrink-0 rounded-lg border border-[var(--line)] bg-white object-cover object-top"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <RichText text={diagnosis.capture.parsed.statement || '（未识别到题干）'} />
            {diagnosis.capture.parsed.clues.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {diagnosis.capture.parsed.clues.map((clue) => (
                  <span key={clue} className="kt-chip">
                    {clue}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {diagnosis.capture.parsed.steps.length > 0 ? (
          <div className="mt-4 border-t border-[var(--line)] pt-3.5">
            <div className="kt-label mb-2">你的解答，逐步核对</div>
            <ol className="space-y-2">
              {diagnosis.capture.parsed.steps.map((step) => (
                <li key={step.index} className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                      step.correct === true
                        ? 'bg-[#E1F5EE] text-brand-800'
                        : step.correct === false
                          ? 'bg-[#FCEBEB] text-[#A32D2D]'
                          : 'bg-[var(--surface-sunken)] text-ink-400'
                    }`}
                    aria-hidden
                  >
                    {step.correct === true ? '✓' : step.correct === false ? '✗' : '?'}
                  </span>
                  <RichText text={step.content} className="min-w-0" />
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </Card>

      {/* 归因结论 */}
      <Card>
        <CardTitle
          title="卡点归因"
          hint="这条结论由依赖图上的确定性算法回溯得出，可复现、可向老师解释。"
        />
        <ChainFlow nodes={chainNodes} rootNodeId={diagnosis.rootCauseNodeId} highlightFrom={0} />

        <div className="mt-4 rounded-xl bg-[var(--surface-sunken)] px-4 py-3.5">
          <RichText text={diagnosis.reasoning} />
        </div>

        {rootNode ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-600">
            <span>
              考点：
              <span className="font-medium text-ink-900">{target?.name ?? diagnosis.targetNodeId}</span>
            </span>
            <span>
              真正的断层：
              <span className="font-medium text-[#A32D2D]">{rootNode.name}</span>
            </span>
            <span>
              补上它，下游
              <span className="font-medium text-brand-800">{blastRadius}</span>
              个知识点会跟着受益
            </span>
          </div>
        ) : null}
      </Card>

      {/* 分层讲解 */}
      <Card>
        <CardTitle
          title="分层讲解"
          hint="一级一级来。看每一级之前，先自己想一下 —— 答案在最后一级才会出现。"
          right={<LevelIndicator level={level} />}
        />
        <section>
          <div className="kt-label">第 1 级 · 引导提示</div>
          <blockquote className="mt-1.5 border-l-2 border-brand-400 pl-3.5 text-[13.5px] leading-relaxed text-ink-700">
            <RichText text={diagnosis.explanation.hint} />
          </blockquote>
        </section>

        {level >= 2 ? (
          <section className="mt-4 animate-fade-up border-t border-[var(--line)] pt-4">
            <div className="kt-label">第 2 级 · 步骤详解</div>
            <ol className="mt-2 space-y-3.5">
              {diagnosis.explanation.steps.map((step, position) => (
                <li key={`${step.title}-${position}`} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-[12px] font-medium text-brand-800">
                    {position + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-ink-900">
                      {step.title}
                      {step.nodeId ? (
                        <span className="ml-2 align-middle">
                          <Chip tone="brand">{index.byId.get(step.nodeId)?.name ?? step.nodeId}</Chip>
                        </span>
                      ) : null}
                    </div>
                    <RichText text={step.body} className="mt-1" />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <button type="button" className="kt-btn" onClick={() => setLevel(2)}>
              想过之后还是没思路 —— 看步骤详解
            </button>
          </div>
        )}

        {level >= 3 ? (
          <section className="mt-4 animate-fade-up border-t border-[var(--line)] pt-4">
            <div className="kt-label">第 3 级 · 完整答案</div>
            <div className="mt-1.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5">
              <RichText text={diagnosis.explanation.answer} />
            </div>
          </section>
        ) : level >= 2 ? (
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <button type="button" className="kt-btn" onClick={() => setLevel(3)}>
              我已经自己推过一遍 —— 对照完整答案
            </button>
          </div>
        ) : null}
      </Card>

      {/* 追问 */}
      <FollowupPanel diagnosis={diagnosis} askFollowup={askFollowup} />

      {/* 补救路径 */}
      <Card>
        <CardTitle title="接下来补什么" hint="顺序由依赖关系决定：先通源头，再回考点。" />
        <ol className="space-y-3">
          {diagnosis.remediation.steps.map((step, position) => (
            <li key={`${step.title}-${position}`} className="flex items-start gap-3">
              <span className="kt-chip shrink-0">{KIND_LABEL[step.kind]}</span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-ink-900">{step.title}</div>
                <RichText text={step.action} className="mt-0.5" />
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 border-t border-[var(--line)] pt-3.5">
          {inNotebook ? (
            <p className="text-[13px] text-brand-800">
              ✓ 已在错题本 · {formatDue(inNotebook.dueAt)}复测（间隔 {inNotebook.intervalDays} 天）
            </p>
          ) : (
            <button
              type="button"
              className="kt-btn kt-btn-primary"
              onClick={() =>
                addToNotebook(
                  diagnosis,
                  diagnosis.capture.parsed.statement.slice(0, 60) || '（未识别题干）',
                )
              }
            >
              加入错题本，间隔重做
            </button>
          )}
        </div>
      </Card>

      {/* 复测题 */}
      <Card>
        <CardTitle
          title="复测：这个洞补上了吗"
          hint="只考同一个知识点。做对了，掌握度才会涨 —— 拍题本身不加任何分。"
        />
        {diagnosis.remediation.variantQuestions.length === 0 ? (
          <EmptyHint>这次没有生成复测题。</EmptyHint>
        ) : (
          <ol className="space-y-3.5">
            {diagnosis.remediation.variantQuestions.map((variant, position) => {
              const result = variantResults[variant.id];
              return (
                <li
                  key={variant.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)] p-3.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-ink-400">Q{position + 1}</span>
                    <Chip tone="brand">{index.byId.get(variant.nodeId)?.name ?? '复测'}</Chip>
                  </div>
                  <RichText text={variant.prompt} className="mt-1.5" />
                  {!result ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="kt-btn kt-btn-primary"
                        onClick={() => {
                          setVariantResults((current) => ({ ...current, [variant.id]: 'pass' }));
                          recordVariantResult(diagnosis, variant.nodeId, true);
                        }}
                      >
                        做对了
                      </button>
                      <button
                        type="button"
                        className="kt-btn"
                        onClick={() => {
                          setVariantResults((current) => ({ ...current, [variant.id]: 'fail' }));
                          if (!reviews.some((item) => item.diagnosisId === diagnosis.id)) {
                            addToNotebook(
                              diagnosis,
                              diagnosis.capture.parsed.statement.slice(0, 60) || '（未识别题干）',
                            );
                          }
                        }}
                      >
                        还没做对
                      </button>
                    </div>
                  ) : result === 'pass' ? (
                    <div className="mt-3 rounded-lg bg-[#E1F5EE] px-3 py-2 text-[13px] text-brand-800">
                      ✓ 掌握度 +22。用正确的感觉再巩固一次，明天回来做第 2 题。
                      {variant.checkpoints.length > 0 ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-[12px] text-brand-800">
                            对照自查要点
                          </summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] text-brand-900">
                            {variant.checkpoints.map((checkpoint) => (
                              <li key={checkpoint}>{checkpoint}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg bg-[#FCEBEB] px-3 py-2 text-[13px] text-[#A32D2D]">
                      没关系 —— 说明这个洞还在。已把原题排进错题本，明天先重做它。
                      {variant.checkpoints.length > 0 ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-[12px] text-[#A32D2D]">
                            对照自查要点
                          </summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] text-[#7a2525]">
                            {variant.checkpoints.map((checkpoint) => (
                              <li key={checkpoint}>{checkpoint}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* 证据 */}
      <Card>
        <CardTitle title="归因证据" hint="每一条结论都必须挂得住证据。" />
        <ul className="space-y-3">
          {diagnosis.evidence.map((item, position) => (
            <li key={position} className="flex items-start gap-3">
              <span className="kt-chip shrink-0">{EVIDENCE_KIND_LABEL[item.kind] ?? '证据'}</span>
              <div className="min-w-0">
                {item.ref && index.byId.get(item.ref) ? (
                  <div className="text-[12.5px] font-medium text-ink-900">
                    {index.byId.get(item.ref)?.name}
                  </div>
                ) : null}
                <RichText text={`「${item.quote}」`} className="text-[13px] text-ink-600" />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FollowupPanel({
  diagnosis,
  askFollowup,
}: {
  diagnosis: NonNullable<ReturnType<typeof useStore>['activeDiagnosis']>;
  askFollowup: ReturnType<typeof useStore>['askFollowup'];
}) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput('');
  }, [diagnosis.id]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, busy]);

  const suggestions = useMemo(() => {
    const demoCase = diagnosis.demoCaseId ? findDemoCase(diagnosis.demoCaseId) : undefined;
    return demoCase?.bundle.suggestedFollowups ?? GENERIC_SUGGESTIONS;
  }, [diagnosis.demoCaseId]);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    const history = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      const reply = await askFollowup(diagnosis, history);
      setMessages([...history, { role: 'assistant', content: reply }]);
    } catch (cause) {
      setMessages([
        ...history,
        {
          role: 'assistant',
          content: `（追问失败了：${cause instanceof Error ? cause.message : String(cause)}）`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle title="还有疑问？继续追问" hint="追问的回答会始终围绕你卡住的那个知识点展开。" />
      <div
        ref={scrollRef}
        className="kt-scroll max-h-80 space-y-3 overflow-y-auto rounded-xl bg-[var(--surface-sunken)] px-3.5 py-3"
      >
        {messages.length === 0 ? (
          <p className="px-1 py-2 text-[13px] text-ink-400">
            例如：这一步为什么用这个方法？换个角度怎么想？
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'user' ? (
                <p className="max-w-[85%] rounded-xl rounded-br-sm bg-brand-600 px-3.5 py-2 text-[13px] leading-relaxed text-white">
                  {message.content}
                </p>
              ) : (
                <div className="max-w-[92%] rounded-xl rounded-bl-sm border border-[var(--line)] bg-white px-3.5 py-2">
                  <RichText text={message.content} />
                </div>
              )}
            </div>
          ))
        )}
        {busy ? <p className="animate-pulse px-1 text-[12.5px] text-ink-400">正在思考……</p> : null}
      </div>

      {messages.length === 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="kt-btn py-1.5 text-[12px]"
              disabled={busy}
              onClick={() => void send(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="围绕这道题或这个知识点，继续问我……"
          className="min-w-0 flex-1 rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 text-[13px] outline-none transition focus:border-brand-400"
        />
        <button type="submit" className="kt-btn kt-btn-primary shrink-0" disabled={busy || !input.trim()}>
          追问
        </button>
      </form>
    </Card>
  );
}

function LevelIndicator({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-ink-400">
      {[1, 2, 3].map((item) => (
        <span
          key={item}
          className={`h-1.5 w-6 rounded-full ${item <= level ? 'bg-brand-400' : 'bg-[var(--line-strong)]'}`}
        />
      ))}
      <span className="ml-1">{level} / 3</span>
    </span>
  );
}

const KIND_LABEL: Record<string, string> = {
  review: '复习',
  drill: '练习',
  verify: '验证',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function formatDue(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}
