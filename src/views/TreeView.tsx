/**
 * F3 课程知识树。
 *
 * 布局选型说明（这是本作品一个刻意的可视化决策）：
 * 课程知识树的真实形态是 DAG —— 一个知识点可以有多个前置，
 * 用严格的「二叉树形」画法必然丢边。因此采用「章节分列 + 依赖连线」的分层布局：
 * 横轴是章节推进方向，纵向按知识纵深（最长前置路径）排布，
 * 每一条前置依赖边都如实画出。掌握度用颜色直接涂在节点上，
 * 诊断发生后，归因链会在这张图上高亮 —— 学生第一次「看见」自己的知识结构。
 */

import { useMemo, useState } from 'react';
import { useStore } from '@/app/store';
import { dependentClosure, masteryLevel } from '@/domain/knowledge-tree';
import { COGNITIVE_LABEL, MASTERY_LEVEL_LABEL } from '@/domain/types';
import { Card, CardTitle, MasteryBadge } from '@/components/ui';

const COL_W = 216;
const NODE_W = 178;
const NODE_H = 46;
const ROW_H = 70;
const HEADER_H = 30;
const PAD = 18;

export function TreeView() {
  const { index, masteryValues, activeDiagnosis, tree } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusGaps, setFocusGaps] = useState(false);

  /*
   * 章节列：按章节号排序，而不是依赖数据文件里的声明顺序。
   * 依赖声明顺序太脆 —— 数据文件按「教材模块」组织（微分方程可能写在重积分之后），
   * 一旦顺序变了，图上就会把第 7 章画到第 10 章右边。
   * numeric: true 必需，否则「第 10 章」会排到「第 1 章」前面。
   */
  const chapters = useMemo(() => {
    const seen = new Set<string>();
    for (const node of index.tree.nodes) seen.add(node.chapter);
    return [...seen].sort((a, b) =>
      a.localeCompare(b, 'zh-Hans-CN', { numeric: true }),
    );
  }, [index]);

  /* 知识纵深：从任意根出发的最长前置路径长度，决定列内纵向次序 */
  const depthOf = useMemo(() => {
    const memo = new Map<string, number>();
    const visit = (id: string): number => {
      const cached = memo.get(id);
      if (cached !== undefined) return cached;
      memo.set(id, 0); // 先落桩防止坏数据成环（indexTree 已验证 DAG，这里只是双保险）
      const pres = index.prerequisitesOf.get(id) ?? [];
      const depth = pres.length === 0 ? 0 : Math.max(...pres.map((pre) => visit(pre) + 1));
      memo.set(id, depth);
      return depth;
    };
    for (const id of index.byId.keys()) visit(id);
    return memo;
  }, [index]);

  const layout = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; column: number }>();
    chapters.forEach((chapter, column) => {
      const nodes = index.tree.nodes
        .filter((node) => node.chapter === chapter)
        .sort(
          (a, b) =>
            (depthOf.get(a.id) ?? 0) - (depthOf.get(b.id) ?? 0) ||
            a.id.localeCompare(b.id),
        );
      nodes.forEach((node, row) => {
        positions.set(node.id, {
          x: PAD + column * COL_W,
          y: HEADER_H + PAD + row * ROW_H,
          column,
        });
      });
    });

    const rows = Math.max(
      ...chapters.map((chapter) =>
        index.tree.nodes.filter((node) => node.chapter === chapter).length,
      ),
      1,
    );

    return {
      positions,
      width: PAD * 2 + chapters.length * COL_W,
      height: HEADER_H + PAD * 2 + rows * ROW_H,
    };
  }, [chapters, depthOf, index]);

  const chainSet = useMemo(
    () => new Set(activeDiagnosis?.causalChain ?? []),
    [activeDiagnosis],
  );

  const edges = useMemo(() => {
    const list: {
      id: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
      inChain: boolean;
      fromGap: boolean;
    }[] = [];
    for (const node of index.tree.nodes) {
      const to = layout.positions.get(node.id);
      if (!to) continue;
      for (const pre of node.prerequisites) {
        const from = layout.positions.get(pre);
        if (!from) continue;
        list.push({
          id: `${pre}->${node.id}`,
          from: { x: from.x + NODE_W, y: from.y + NODE_H / 2 },
          to: { x: to.x, y: to.y + NODE_H / 2 },
          inChain: chainSet.has(pre) && chainSet.has(node.id),
          fromGap: masteryLevel(masteryValues.get(pre)) === 'gap',
        });
      }
    }
    return list;
  }, [index, layout, chainSet, masteryValues]);

  const selected = selectedId ? index.byId.get(selectedId) : undefined;
  const rootCauseId = activeDiagnosis?.rootCauseNodeId;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {activeDiagnosis ? (
        <div className="rounded-card border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] text-brand-800">
          正在高亮诊断的归因链：
          <span className="font-medium">
            {index.byId.get(activeDiagnosis.rootCauseNodeId)?.name}
          </span>
          <span className="mx-1.5 opacity-60">→</span>
          <span className="font-medium">
            {index.byId.get(activeDiagnosis.targetNodeId)?.name}
          </span>
          <span className="ml-1 opacity-70">（红色环是断层源头）</span>
        </div>
      ) : null}

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3.5 text-[12px] text-ink-600">
            {(['solid', 'ok', 'weak', 'gap'] as const).map((level) => (
              <span key={level} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: LEVEL_FILL[level] }}
                />
                {MASTERY_LEVEL_LABEL[level]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] border-2 border-[#E24B4A]" />
              断层源头
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-600">
            <input
              type="checkbox"
              checked={focusGaps}
              onChange={(event) => setFocusGaps(event.target.checked)}
              className="h-3.5 w-3.5 accent-[#0F6E56]"
            />
            突出断层（其余淡化）
          </label>
        </div>

        <div className="kt-scroll overflow-x-auto">
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="block"
            role="img"
            aria-label={`${tree.courseId} 知识树，按章节与掌握度着色`}
          >
            {/* 章节表头 */}
            {chapters.map((chapter, column) => (
              <text
                key={chapter}
                x={PAD + column * COL_W + NODE_W / 2}
                y={16}
                textAnchor="middle"
                fontSize="11.5"
                fill="#888780"
              >
                {chapter}
              </text>
            ))}

            {/* 前置依赖边 */}
            {edges.map((edge) => {
              const dx = Math.max(46, (edge.to.x - edge.from.x) / 2);
              const sameColumn = edge.to.x - edge.from.x < 24;
              const path = sameColumn
                ? `M ${edge.from.x} ${edge.from.y} C ${edge.from.x + 44} ${edge.from.y + 26}, ${edge.to.x + 44} ${edge.to.y - 26}, ${edge.to.x} ${edge.to.y}`
                : `M ${edge.from.x} ${edge.from.y} C ${edge.from.x + dx} ${edge.from.y}, ${edge.to.x - dx} ${edge.to.y}, ${edge.to.x} ${edge.to.y}`;
              return (
                <path
                  key={edge.id}
                  d={path}
                  fill="none"
                  stroke={edge.inChain ? '#1D9E75' : '#D8D6CE'}
                  strokeWidth={edge.inChain ? 2.2 : 1.1}
                  className={edge.inChain ? 'animate-dash-flow' : undefined}
                  strokeDasharray={edge.inChain ? '6 3' : undefined}
                  opacity={focusGaps && !edge.fromGap ? 0.25 : 1}
                />
              );
            })}

            {/* 知识点节点 */}
            {index.tree.nodes.map((node) => {
              const position = layout.positions.get(node.id);
              if (!position) return null;
              const score = masteryValues.get(node.id);
              const level = masteryLevel(score);
              const isChain = chainSet.has(node.id);
              const isRootCause = node.id === rootCauseId;
              const dim = focusGaps && level !== 'gap' && !isChain && !isRootCause;

              return (
                <g
                  key={node.id}
                  transform={`translate(${position.x}, ${position.y})`}
                  opacity={dim ? 0.28 : 1}
                  onClick={() => setSelectedId(node.id)}
                  className="cursor-pointer"
                >
                  <title>{`${node.name}｜${MASTERY_LEVEL_LABEL[level]} ${score ?? 0} 分`}</title>
                  {isRootCause ? (
                    <rect
                      x="-3.5"
                      y="-3.5"
                      width={NODE_W + 7}
                      height={NODE_H + 7}
                      rx="11"
                      fill="none"
                      stroke="#E24B4A"
                      strokeWidth="1.8"
                    />
                  ) : null}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx="8"
                    fill={LEVEL_FILL[level]}
                    fillOpacity={level === 'gap' ? 0.14 : 0.1}
                    stroke={
                      isRootCause ? '#E24B4A' : isChain ? '#1D9E75' : LEVEL_FILL[level]
                    }
                    strokeWidth={isRootCause || isChain ? 1.8 : 1.4}
                  />
                  <text x="10" y="19" fontSize="11.5" fill="#2C2C2A" fontWeight="500">
                    {clip(node.name, 12)}
                  </text>
                  <text x="10" y="35" fontSize="10" fill="#888780" className="font-mono">
                    {score ?? 0}
                  </text>
                  {level === 'gap' ? (
                    <circle cx={NODE_W - 10} cy="13" r="3.2" fill="#E24B4A" />
                  ) : null}
                  {isChain ? (
                    <circle cx={NODE_W - 10} cy={NODE_H - 13} r="3.2" fill="#1D9E75" />
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      </Card>

      {/* 选中节点的详情 */}
      {selected ? (
        <Card className="animate-fade-up">
          <CardTitle
            title={selected.name}
            hint={`${selected.chapter} · ${selected.id}`}
            right={
              <span className="flex items-center gap-3">
                <span className="kt-chip">{COGNITIVE_LABEL[selected.cognitive]}</span>
                <MasteryBadge score={masteryValues.get(selected.id)} />
              </span>
            }
          />
          <p className="text-[13.5px] leading-relaxed text-ink-700">{selected.summary}</p>

          <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="kt-label mb-1.5">前置依赖（要懂它，先得懂这些）</div>
              {selected.prerequisites.length === 0 ? (
                <p className="text-[12.5px] text-ink-400">无 —— 它是这门课的起点之一</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selected.prerequisites.map((pre) => (
                    <button
                      key={pre}
                      type="button"
                      className="kt-chip transition hover:border-brand-400 hover:text-brand-600"
                      onClick={() => setSelectedId(pre)}
                    >
                      {index.byId.get(pre)?.name ?? pre}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="kt-label mb-1.5">下游影响（它塌了，这些跟着塌）</div>
              <p className="text-[12.5px] text-ink-600">
                {dependentClosure(index, selected.id).size} 个知识点直接或间接依赖它
              </p>
            </div>
          </div>

          {selected.misconceptions && selected.misconceptions.length > 0 ? (
            <div className="mt-3.5 border-t border-[var(--line)] pt-3">
              <div className="kt-label mb-1.5">这个知识点上最常见的误解</div>
              <ul className="list-disc space-y-1 pl-4 text-[13px] text-ink-600">
                {selected.misconceptions.map((misconception) => (
                  <li key={misconception}>{misconception}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : (
        <p className="text-center text-[12.5px] text-ink-400">
          点击任意知识点，查看它的定义、前置依赖与常见误解。
        </p>
      )}
    </div>
  );
}

const LEVEL_FILL = {
  gap: '#E24B4A',
  weak: '#EF9F27',
  ok: '#97C459',
  solid: '#0F6E56',
} as const;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
