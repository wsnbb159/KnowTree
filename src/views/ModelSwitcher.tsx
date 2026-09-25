/**
 * 快速换模型按钮。
 *
 * 放在拍题页和诊断页顶部，列已配过密钥的服务商，一键切换，不用跑设置页。
 * 没配过密钥的服务商显示为灰色，点击跳设置页。
 */

import { useMemo } from 'react';
import { useStore } from '@/app/store';
import { PROVIDER_PRESETS } from '@/services/llm/openai-compatible';
import { loadLlmKeyMemory } from '@/services/storage/repository';

export function ModelSwitcher({ onGoSettings }: { onGoSettings: () => void }) {
  const { activePresetId, applyPreset, engineLabel, externalAdapterLabel } = useStore();

  // 读密钥记忆，判断哪些服务商配过 key。
  // 组件在切回拍题/诊断页时重新挂载，useMemo 会重算，不会拿到过期数据。
  const keyMemory = useMemo(() => loadLlmKeyMemory(), []);

  // 外部注入优先显示
  if (externalAdapterLabel) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2">
        <span className="text-[12px] font-medium text-brand-800">🔌 {externalAdapterLabel}</span>
        <span className="text-[11px] text-ink-500">（外部插件注入，优先级最高）</span>
      </div>
    );
  }

  const configured = PROVIDER_PRESETS.filter((p) => p.id !== 'custom' && keyMemory[p.baseUrl]);
  const hasAny = configured.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-ink-500">模型：</span>
      {PROVIDER_PRESETS.filter((p) => p.id !== 'custom').map((preset) => {
        const ready = !!keyMemory[preset.baseUrl];
        const active = preset.id === activePresetId;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={!ready}
            onClick={() => {
              if (ready) applyPreset(preset.id);
              else onGoSettings();
            }}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              active
                ? 'border-brand-400 bg-brand-50 text-brand-800'
                : ready
                  ? 'border-[var(--line)] bg-white text-ink-700 hover:border-brand-200'
                  : 'border-[var(--line)] bg-[var(--surface-sunken)] text-ink-400'
            }`}
            title={ready ? `切换到 ${preset.label}` : `${preset.label}（未配置密钥，去设置页）`}
          >
            {preset.label.replace(/ ·.*/, '')}
            {active ? ' ✓' : ''}
          </button>
        );
      })}
      {!hasAny ? (
        <button
          type="button"
          onClick={onGoSettings}
          className="rounded-full border border-brand-300 bg-brand-50 px-2.5 py-1 text-[11px] text-brand-700"
        >
          去配置模型 ↗
        </button>
      ) : null}
      <span className="text-[11px] text-ink-400">｜{engineLabel}</span>
    </div>
  );
}
