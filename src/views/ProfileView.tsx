/**
 * F4 学情画像。
 *
 * 「薄弱点 Top5」的排序刻意不是按失分排，而是按「补它的收益」排：
 * 源头收敛算法给出的每个洞，都标注了它连带着多少个失效知识点。
 * 我们要传达的判断是：不是你不行，是你有 4 个洞；先补这个，一章跟着活。
 */

import { useMemo } from 'react';
import { useStore } from '@/app/store';
import { chapterBreakdown, dependentClosure, masteryLevel } from '@/domain/knowledge-tree';
import { MASTERY_LEVEL_LABEL } from '@/domain/types';
import { Card, CardTitle, Chip, EmptyHint, HeatBar, MetricCard, RadarChart } from '@/components/ui';

export function ProfileView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { index, mastery, masteryValues, stats, clusters, due, resetMastery } = useStore();

  const chapters = useMemo(
    () => chapterBreakdown(index, masteryValues),
    [index, masteryValues],
  );

  const radarData = useMemo(
    () =>
      chapters.map((entry) => ({
        label: entry.chapter.replace(/^第\S+章\s*/, ''),
        value: entry.average,
      })),
    [chapters],
  );

  const isEmpty = mastery.length === 0 || stats.average === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {isEmpty ? (
        <Card>
          <CardTitle
            title="还没有学情数据"
            hint="掌握度只会在复测题做对时增加 —— 拍题本身不加权，先去诊断一道题。"
          />
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              className="kt-btn kt-btn-primary"
              onClick={() => onNavigate('capture')}
            >
              去拍一道题
            </button>
            <button type="button" className="kt-btn" onClick={resetMastery}>
              载入演示学情画像
            </button>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-400">
            演示画像是为展示「一个洞导致一章塌方」而构造的：某个关键前置没吃透，
            它下游的一整片知识点跟着失效，而其他章节一切正常 ——
            问题出在结构，不出在态度。
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="知识点总数" value={stats.total} />
        <MetricCard label="全树平均掌握" value={stats.average} suffix="分" />
        <MetricCard label="断层知识点" value={stats.gap} tone="danger" hint="低于 60 分" />
        <MetricCard
          label="要补的源头"
          value={clusters.length}
          tone="brand"
          hint={`${stats.gap} 个断层往往只是 ${clusters.length} 个洞`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardTitle title="章节掌握雷达" hint="看形状就知道问题集中在哪一片。" />
          <div className="flex justify-center">
            <RadarChart data={radarData} />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardTitle title="章节明细" hint="红色是该章内的断层知识点数量。" />
          <div className="space-y-2.5">
            {chapters.map((entry) => (
              <HeatBar
                key={entry.chapter}
                label={entry.chapter.replace(/^第\S+章\s*/, '')}
                value={entry.average}
                detail={`断层 ${entry.gap}/${entry.total}`}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle
          title="薄弱点 Top 5 —— 按补它的收益排序"
          hint="不是你不会的都叫薄弱点。排在前面的是「补一个、活一片」的源头。"
        />
        {clusters.length === 0 ? (
          <EmptyHint>目前没有断层，保持住。</EmptyHint>
        ) : (
          <ol className="space-y-3">
            {clusters.slice(0, 5).map((cluster, position) => {
              const root = index.byId.get(cluster.rootNodeId);
              const impact = dependentClosure(index, cluster.rootNodeId).size;
              return (
                <li
                  key={cluster.rootNodeId}
                  className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-medium ${
                      position === 0 ? 'bg-[#A32D2D] text-white' : 'bg-white text-ink-600'
                    }`}
                  >
                    {position + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-medium text-ink-900">
                        {root?.name ?? cluster.rootNodeId}
                      </span>
                      <Chip tone={position === 0 ? 'danger' : 'neutral'}>
                        连带 {cluster.affected.length - 1} 个知识点
                      </Chip>
                      <span className="text-[11.5px] text-ink-400">
                        {root?.chapter}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <HeatBar
                        label="源头掌握度"
                        value={cluster.rootScore}
                        detail={`${MASTERY_LEVEL_LABEL[masteryLevel(cluster.rootScore)]} ${cluster.rootScore}`}
                      />
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="font-mono text-[18px] font-medium text-brand-800">{impact}</div>
                    <div className="text-[11px] text-ink-400">下游受益</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {clusters.length > 0 ? (
          <div className="mt-4 border-t border-[var(--line)] pt-3.5">
            <button type="button" className="kt-btn" onClick={() => onNavigate('tree')}>
              在知识树上查看这些洞 →
            </button>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardTitle
          title="复习优先级"
          hint="来自错题本的间隔重做计划：到期的题排最前。"
          right={
            due.length > 0 ? (
              <Chip tone="danger">{due.length} 题到期</Chip>
            ) : (
              <Chip tone="brand">暂无到期</Chip>
            )
          }
        />
        {due.length === 0 ? (
          <EmptyHint>
            没有到期的复测题。拍了题记得加入错题本，知树会替你安排重做节奏。
          </EmptyHint>
        ) : (
          <ol className="divide-y divide-[var(--line)]">
            {due.slice(0, 3).map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">
                  {item.prompt}
                </span>
                <span className="shrink-0 text-[12px] text-ink-400">
                  {index.byId.get(item.rootNodeId)?.name ?? item.rootNodeId}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-3.5 border-t border-[var(--line)] pt-3.5">
          <button type="button" className="kt-btn" onClick={() => onNavigate('notebook')}>
            打开错题本 →
          </button>
        </div>
      </Card>
    </div>
  );
}
