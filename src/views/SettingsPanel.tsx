/**
 * 模型配置面板。
 *
 * 双模式是刻意的架构决策：
 * - 演示模式：内置完整样例，评委打开链接零依赖可用；
 * - 远程模式：OpenAI 兼容协议。豆包（火山方舟）、腾讯混元 Lite、
 *   DeepSeek、硅基流动、智谱、通义都有免费或极低价档位，点开卡片即用。
 * 密钥只写进本机 localStorage（按服务商分别记忆，切换不丢），
 * 不经过任何第三方 —— 本作品没有后端。
 */

import { useState, type ReactNode } from 'react';
import { useStore } from '@/app/store';
import {
  createOpenAiCompatibleProvider,
  PROVIDER_PRESETS,
  type ProviderPreset,
} from '@/services/llm/openai-compatible';
import { recallLlmKey, rememberLlmKey } from '@/services/storage/repository';
import { Card, CardTitle, Chip } from '@/components/ui';

type TestState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'ok'; reply: string }
  | { status: 'error'; message: string };

export function SettingsPanel() {
  const { engineMode, llmConfig, updateLlmConfig, setEngineMode } = useStore();

  const [presetId, setPresetId] = useState<string | null>(() => {
    const hit = PROVIDER_PRESETS.find((preset) => preset.baseUrl === llmConfig?.baseUrl);
    return hit?.id ?? null;
  });
  const [baseUrl, setBaseUrl] = useState(llmConfig?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState(llmConfig?.apiKey ?? '');
  const [model, setModel] = useState(llmConfig?.model ?? '');
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const activePreset = PROVIDER_PRESETS.find((preset) => preset.id === presetId) ?? null;
  const visionBlocked =
    activePreset !== null && !activePreset.supportsVision && baseUrl.trim() === activePreset.baseUrl;

  const formReady = baseUrl.trim() !== '' && apiKey.trim() !== '' && model.trim() !== '';

  const selectPreset = (preset: ProviderPreset) => {
    setPresetId(preset.id);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    // 切回配过的服务商时，密钥自动回填 —— 三家都配好，随时切换
    setApiKey(recallLlmKey(preset.baseUrl));
    setTest({ status: 'idle' });
  };

  const runTest = async () => {
    if (!formReady) return;
    setTest({ status: 'busy' });
    try {
      const provider = createOpenAiCompatibleProvider({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
      });
      const reply = await provider.complete({
        messages: [{ role: 'user', content: '请只回复两个字：正常' }],
        json: false,
        temperature: 0,
        maxTokens: 16,
      });
      setTest({ status: 'ok', reply: reply.slice(0, 40) });
    } catch (cause) {
      setTest({
        status: 'error',
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardTitle
          title="诊断引擎"
          hint="两种模式产出同一套领域逻辑：换引擎，归因结论不变 —— 这是分层架构的意义。"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setEngineMode('demo')}
            className={`rounded-card border p-4 text-left transition ${
              engineMode === 'demo'
                ? 'border-brand-400 bg-brand-50'
                : 'border-[var(--line)] bg-white hover:border-brand-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-ink-900">演示模式</span>
              {engineMode === 'demo' ? <Chip tone="brand">当前</Chip> : null}
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">
              内置完整样例与预置讲解，无需任何配置。适合快速体验与离线演示。
            </p>
          </button>

          <button
            type="button"
            onClick={() => setEngineMode('remote')}
            disabled={!llmConfig}
            className={`rounded-card border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
              engineMode === 'remote'
                ? 'border-brand-400 bg-brand-50'
                : 'border-[var(--line)] bg-white hover:border-brand-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-ink-900">远程模型</span>
              {engineMode === 'remote' ? <Chip tone="brand">当前</Chip> : null}
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">
              真实模型逐题分析。需先在下方保存一份有效配置。
              {llmConfig ? '' : '（尚未配置）'}
            </p>
          </button>
        </div>
      </Card>

      <Card>
        <CardTitle
          title="远程模型配置"
          hint="OpenAI 兼容协议。点选服务商卡片自动填好接口与模型，密钥仅保存在本机浏览器。"
        />

        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {PROVIDER_PRESETS.map((preset) => {
            const selected = preset.id === presetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset)}
                className={`rounded-lg border p-3 text-left transition ${
                  selected
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-[var(--line)] bg-white hover:border-brand-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-ink-900">{preset.label}</span>
                  <span className="flex shrink-0 gap-1">
                    {preset.free ? (
                      <span className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[11px] text-brand-800">
                        免费
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        preset.supportsVision
                          ? 'bg-[#E6F1FE] text-[#185FA5]'
                          : 'bg-[var(--surface-sunken)] text-ink-600'
                      }`}
                    >
                      {preset.supportsVision ? '识图' : '纯文本'}
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600">{preset.freeTier}</p>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <Field label="接口地址 Base URL">
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://open.bigmodel.cn/api/paas/v4"
              className={inputClass}
            />
          </Field>
          <Field label="API Key">
            <div className="flex gap-2">
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                type={showKey ? 'text' : 'password'}
                placeholder="sk-……"
                autoComplete="off"
                className={inputClass}
              />
              <button
                type="button"
                className="kt-btn shrink-0"
                onClick={() => setShowKey((value) => !value)}
              >
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
            {activePreset?.keyUrl ? (
              <a
                href={activePreset.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-[12px] text-brand-700 underline underline-offset-2"
              >
                去{activePreset.label}控制台免费申请密钥 ↗
              </a>
            ) : null}
          </Field>
          <Field label="模型名称">
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="doubao-seed-1-6-vision-250815 / glm-4v-flash / deepseek-chat"
              className={inputClass}
            />
            {activePreset?.note ? (
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-600">{activePreset.note}</p>
            ) : null}
          </Field>
        </div>

        {visionBlocked ? (
          <div className="mt-3 rounded-lg bg-[#FAEEDA] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#854F0B]">
            该模型不支持识图：拍题与 PDF 诊断会失败，只有追问、讲解、变式题等纯文本任务可用。
            想体验完整链路，请换用带「识图」徽章的服务商（如豆包、智谱）。
          </div>
        ) : null}

        {test.status !== 'idle' ? (
          <div
            className={`mt-4 rounded-lg px-3.5 py-2.5 text-[12.5px] ${
              test.status === 'ok'
                ? 'bg-[#E1F5EE] text-brand-800'
                : test.status === 'error'
                  ? 'bg-[#FCEBEB] text-[#A32D2D]'
                  : 'bg-[var(--surface-sunken)] text-ink-600'
            }`}
          >
            {test.status === 'busy'
              ? '正在测试连接……'
              : test.status === 'ok'
                ? `✓ 连接成功，模型回复：「${test.reply}」`
                : `✗ ${test.message}`}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="kt-btn kt-btn-primary"
            disabled={!formReady}
            onClick={() => {
              const config = {
                baseUrl: baseUrl.trim(),
                apiKey: apiKey.trim(),
                model: model.trim(),
              };
              updateLlmConfig(config);
              rememberLlmKey(config.baseUrl, config.apiKey);
              setTest({ status: 'idle' });
            }}
          >
            保存并启用远程模型
          </button>
          <button
            type="button"
            className="kt-btn"
            disabled={!formReady || test.status === 'busy'}
            onClick={() => void runTest()}
          >
            测试连接
          </button>
          {llmConfig ? (
            <button
              type="button"
              className="kt-btn"
              onClick={() => {
                updateLlmConfig(null);
                setTest({ status: 'idle' });
              }}
            >
              清除配置，回到演示模式
            </button>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle title="关于题目数据" />
        <p className="text-[13px] leading-relaxed text-ink-600">
          题目照片在诊断时直接发往你配置的模型服务；诊断记录、掌握度、错题本全部存于本机
          localStorage。知树本身没有后端，也就没有任何数据离开你的浏览器 ——
          除了你主动选择连接的模型服务。
        </p>
      </Card>
    </div>
  );
}

const inputClass =
  'min-w-0 flex-1 rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 text-[13px] outline-none transition focus:border-brand-400';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="kt-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
