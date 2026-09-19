/**
 * F5 错题本。
 *
 * 错题本不是「错题列表」，是间隔重做的调度台：
 * 每条记录都带着归因标签（断层在哪、什么性质的错），
 * 到期才出现在「今天该做」区；答对间隔拉长，答错回退一级 —— 永不归零。
 */

import { useState } from 'react';
import { useStore } from '@/app/store';
import { ERROR_CAUSE_LABEL } from '@/domain/types';
import { Card, CardTitle, Chip, EmptyHint } from '@/components/ui';

export function NotebookView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { reviews, due, index, gradeReview } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);

  const future = reviews.filter((item) => !due.some((dueItem) => dueItem.id === item.id));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Chip tone="neutral">共 {reviews.length} 题</Chip>
          <Chip tone={due.length > 0 ? 'danger' : 'brand'}>
            {due.length > 0 ? `今天该做 ${due.length} 题` : '今天没有到期的复测'}
          </Chip>
        </div>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <EmptyHint>
            错题本还是空的。诊断一道题之后点「加入错题本」，知树会按 1 / 3 / 7 / 16 / 35
            天的节奏替你安排重做。
            <div className="mt-4">
              <button
                type="button"
                className="kt-btn kt-btn-primary"
                onClick={() => onNavigate('capture')}
              >
                去拍一道题
              </button>
            </div>
          </EmptyHint>
        </Card>
      ) : null}

      {due.length > 0 ? (
        <Card>
          <CardTitle title="今天该做" hint="重做时不看讲解。做完再回来对答案 —— 做对了，掌握度才会涨。" />
          <ol className="space-y-3">
            {due.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[#F7C1C1] bg-[#FDF6F6] p-3.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="danger">{ERROR_CAUSE_LABEL[item.cause]}</Chip>
                  <span className="text-[12px] text-ink-600">
                    断层：{index.byId.get(item.rootNodeId)?.name ?? item.rootNodeId}
                  </span>
                  <span className="text-[11.5px] text-ink-400">
                    考点：{index.byId.get(item.targetNodeId)?.name ?? item.targetNodeId}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-ink-400">
                    第 {item.reps + 1} 次重做
                  </span>
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-700">{item.prompt}</p>

                {openId === item.id ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="kt-btn kt-btn-primary"
                      onClick={() => {
                        gradeReview(item.id, 'pass');
                        setOpenId(null);
                      }}
                    >
                      做对了
                    </button>
                    <button
                      type="button"
                      className="kt-btn"
                      onClick={() => {
                        gradeReview(item.id, 'fail');
                        setOpenId(null);
                      }}
                    >
                      还是没做对
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="kt-btn mt-3"
                    onClick={() => setOpenId(item.id)}
                  >
                    现在重做
                  </button>
                )}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {future.length > 0 ? (
        <Card>
          <CardTitle title="已安排" hint="按遗忘曲线排期，没到期不打扰你。" />
          <ol className="divide-y divide-[var(--line)]">
            {future.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <Chip
                  tone={
                    item.cause === 'concept-gap' || item.cause === 'prerequisite-break'
                      ? 'danger'
                      : 'warn'
                  }
                >
                  {ERROR_CAUSE_LABEL[item.cause]}
                </Chip>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">
                  {item.prompt}
                </span>
                <span className="shrink-0 text-[12px] text-ink-400">
                  {item.lastResult === 'pass' ? '上次做对 · ' : item.lastResult === 'fail' ? '上次没对 · ' : ''}
                  {relativeDay(item.dueAt)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}

function relativeDay(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days <= 0) return '已到期';
  if (days === 1) return '明天复测';
  return `${days} 天后`;
}
