/**
 * 教师端视角。
 *
 * 单机版没有班级数据，这里如实说明：当前展示的是同一位学生学情的「教研视角」
 * —— 同一份数据，换一个组织方式：章节热力、断层源头收敛、高影响节点。
 * 它要回答教师最关心的一个问题：这节课，我到底该讲什么。
 */

import { useMemo } from 'react';
import { useStore } from '@/app/store';
import { chapterBreakdown, dependentClosure, masteryLevel } from '@/domain/knowledge-tree';
import { Card, CardTitle, Chip, HeatBar, MetricCard } from '@/components/ui';

export function TeacherView() {
  const { index, masteryValues, clusters, stats } = useStore();

  const chapters = useMemo(
    () => chapterBreakdown(index, masteryValues),
    [index, masteryValues],
  );

  /* 高影响断层：按「塌了会连累多少下游」排序，是复习课的优先级 */
  const highImpactGaps = useMemo(
    () =>
      index.tree.nodes
        .filter((node) => masteryLevel(masteryValues.get(node.id)) === 'gap')
        .map((node) => ({
          node,
          impact: dependentClosure(index, node.id).size,
        }))
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 10),
    [index, masteryValues],
  );

  const covered = clusters.reduce((sum, cluster) => sum + cluster.affected.length, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-card border border-[#B5D4F4] bg-[#E6F1FB] px-4 py-3 text-[13px] leading-relaxed text-[#185FA5]">
        教师端把同一份学情按教研需要重新组织。当前为演示模式（单机版，学情存于本机），
        真实班级部署时，这一页聚合的是全班的数据。
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="知识点总数" value={stats.total} />
        <MetricCard label="全班平均" value={stats.average} suffix="分" />
        <MetricCard label="断层知识点" value={stats.gap} tone="danger" />
        <MetricCard
          label="断层源头数"
          value={clusters.length}
          tone="brand"
          hint={`${clusters.length} 个洞解释 ${covered} 个断层`}
        />
      </div>

      <Card>
        <CardTitle
          title="这节课该讲什么 —— 源头收敛"
          hint="把全班断层按真正源头聚类。补一个源头，连带修复一片，这是备课的杠杆点。"
        />
        <ol className="space-y-3">
          {clusters.map((cluster, position) => {
            const root = index.byId.get(cluster.rootNodeId);
            const downstream = dependentClosure(index, cluster.rootNodeId);
            return (
              <li
                key={cluster.rootNodeId}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px] font-medium ${
                      position === 0 ? 'bg-[#A32D2D] text-white' : 'bg-white text-ink-600'
                    }`}
                  >
                    {position + 1}
                  </span>
                  <span className="text-[14px] font-medium text-ink-900">
                    {root?.name ?? cluster.rootNodeId}
                  </span>
                  <Chip tone="neutral">{root?.chapter}</Chip>
                  {position === 0 ? <Chip tone="danger">优先讲这个</Chip> : null}
                  {position !== 0 && cluster.rootScore < 50 ? (
                    <Chip tone="warn">单点严重 · {cluster.rootScore} 分</Chip>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
                  {root?.summary}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-600">
                  <span>
                    源头掌握度：
                    <span className="font-mono font-medium text-[#A32D2D]">{cluster.rootScore}</span>
                  </span>
                  <span>
                    连带断层：
                    <span className="font-medium">{cluster.affected.length - 1}</span> 个知识点
                  </span>
                  <span>
                    下游总数：
                    <span className="font-medium">{downstream.size}</span> 个知识点受益
                  </span>
                </div>
                {root?.misconceptions && root.misconceptions.length > 0 ? (
                  <p className="mt-2 text-[12.5px] text-ink-400">
                    讲课时优先破除：{root.misconceptions.join('；')}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle title="章节热力" hint="红色为该章断层知识点数量。" />
          <div className="space-y-2.5">
            {chapters.map((entry) => (
              <HeatBar
                key={entry.chapter}
                label={entry.chapter}
                value={entry.average}
                detail={`断层 ${entry.gap}/${entry.total}`}
              />
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle title="高影响断层节点" hint="按下游依赖数排序。" />
          <ol className="divide-y divide-[var(--line)]">
            {highImpactGaps.map(({ node, impact }) => (
              <li key={node.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink-700">{node.name}</span>
                  <span className="block text-[11px] text-ink-400">{node.chapter}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[14px] font-medium text-[#A32D2D]">
                    {impact}
                  </span>
                  <span className="block text-[10.5px] text-ink-400">下游</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
