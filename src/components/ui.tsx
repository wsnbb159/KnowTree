/**
 * 通用展示组件。
 * 只做呈现，不含业务判断 —— 业务结论一律由 domain 层给。
 */

import type { ReactNode } from 'react';
import { MASTERY_LEVEL_LABEL, type MasteryLevel } from '@/domain/types';

export const MASTERY_COLOR: Record<MasteryLevel, string> = {
  gap: '#E24B4A',
  weak: '#EF9F27',
  ok: '#97C459',
  solid: '#0F6E56',
};

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`kt-card ${padded ? 'p-5' : ''} ${className ?? ''}`}>
      {children}
    </section>
  );
}

export function CardTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-3 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[14px] font-medium text-ink-900">{title}</h2>
        {hint ? <p className="mt-1 text-[12px] leading-relaxed text-ink-400">{hint}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'danger' | 'warn' | 'info';
}) {
  const tones = {
    neutral: 'border-[var(--line)] bg-[var(--surface-sunken)] text-ink-600',
    brand: 'border-brand-200 bg-brand-50 text-brand-800',
    danger: 'border-[#F7C1C1] bg-[#FCEBEB] text-[#A32D2D]',
    warn: 'border-[#FAC775] bg-[#FAEEDA] text-[#854F0B]',
    info: 'border-[#B5D4F4] bg-[#E6F1FB] text-[#185FA5]',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function MasteryBadge({ score }: { score: number | undefined }) {
  const level: MasteryLevel =
    score === undefined || score < 60
      ? 'gap'
      : score < 75
        ? 'weak'
        : score < 90
          ? 'ok'
          : 'solid';
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-600">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: MASTERY_COLOR[level] }}
        aria-hidden
      />
      {MASTERY_LEVEL_LABEL[level]}
      <span className="font-mono text-[11px] text-ink-400">{score ?? 0}</span>
    </span>
  );
}

export function MetricCard({
  label,
  value,
  suffix,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: 'brand' | 'danger';
  hint?: string;
}) {
  return (
    <div className="rounded-card bg-[var(--surface-sunken)] px-4 py-3">
      <div className="kt-label">{label}</div>
      <div
        className="mt-1 flex items-baseline gap-1"
        style={{
          color: tone === 'danger' ? '#A32D2D' : tone === 'brand' ? '#0F6E56' : undefined,
        }}
      >
        <span className="text-[24px] font-medium leading-none text-ink-900">{value}</span>
        {suffix ? <span className="text-[12px] text-ink-600">{suffix}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-[11px] leading-snug text-ink-400">{hint}</div> : null}
    </div>
  );
}

/** 依赖链可视化：把「源头 → 考点」这条路径画出来，是归因结论最直观的证据 */
export function ChainFlow({
  nodes,
  highlightFrom,
  rootNodeId,
}: {
  nodes: { id: string; name: string; score?: number }[];
  highlightFrom?: number;
  rootNodeId?: string;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {nodes.map((node, position) => {
        const isRoot = node.id === rootNodeId;
        const emphasized = highlightFrom === undefined || position >= highlightFrom;
        return (
          <li key={node.id} className="flex items-center gap-1.5">
            {position > 0 ? (
              <span className="text-[13px] text-ink-400" aria-hidden>
                →
              </span>
            ) : null}
            <span
              className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] ${
                isRoot
                  ? 'border-[#E24B4A] bg-[#FCEBEB] font-medium text-[#A32D2D]'
                  : emphasized
                    ? 'border-brand-200 bg-brand-50 text-brand-800'
                    : 'border-[var(--line)] bg-white text-ink-400'
              }`}
            >
              {node.name}
              {node.score !== undefined ? (
                <span className="ml-1.5 font-mono text-[11px] opacity-70">{node.score}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 掌握度雷达图。
 * 六轴是章节，不是知识点 —— 章节能看出「问题集中在哪一片」，
 * 逐点铺开反而看不出形状。
 */
export function RadarChart({
  data,
  size = 260,
}: {
  data: { label: string; value: number }[];
  size?: number;
}) {
  const axes = data.slice(0, 8);
  if (axes.length < 3) return null;
  const center = size / 2;
  const radius = center - 46;

  const point = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * radius * ratio,
      y: center + Math.sin(angle) * radius * ratio,
    };
  };

  const polygon = axes
    .map((axis, index) => {
      const p = point(index, Math.max(0.04, axis.value / 100));
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="各章节掌握度雷达图"
    >
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={axes
            .map((_, index) => {
              const p = point(index, ring);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ')}
          fill="none"
          stroke="#E2E0D8"
          strokeWidth="0.8"
        />
      ))}
      {axes.map((axis, index) => {
        const p = point(index, 1);
        const label = point(index, 1.19);
        return (
          <g key={axis.label}>
            <line
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke="#E2E0D8"
              strokeWidth="0.8"
            />
            <text
              x={label.x}
              y={label.y}
              fontSize="11"
              fill="#5F5E5A"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {axis.label}
            </text>
          </g>
        );
      })}
      <polygon points={polygon} fill="rgba(15,110,86,0.16)" stroke="#0F6E56" strokeWidth="1.5" />
      {axes.map((axis, index) => {
        const p = point(index, Math.max(0.04, axis.value / 100));
        return (
          <circle
            key={axis.label}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={axis.value < 60 ? '#E24B4A' : '#0F6E56'}
          />
        );
      })}
    </svg>
  );
}

/** 章节热力条，教师端与学生端共用 */
export function HeatBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  const color = value < 60 ? '#E24B4A' : value < 75 ? '#EF9F27' : '#0F6E56';
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-[12.5px] text-ink-700" title={label}>
        {label}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(3, value)}%`, background: color }}
        />
      </span>
      <span className="w-24 shrink-0 text-right font-mono text-[11.5px] text-ink-400">
        {detail ?? `${value}`}
      </span>
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-[var(--line-strong)] px-5 py-8 text-center text-[13px] text-ink-400">
      {children}
    </div>
  );
}
