/**
 * 模型配置面板。
 *
 * 双模式是刻意的架构决策：
 * - 演示模式：内置完整样例，评委打开链接零依赖可用；
 * - 远程模式：OpenAI 兼容协议，智谱 / 通义 / DeepSeek / 自建网关皆可接。
 * 密钥只写进本机 localStorage，不经过任何第三方（包括我们自己 —— 本作品没有后端）。
 */

import { useState, type ReactNode } from 'react';
import { useStore } from '@/app/store';
import { createOpenAiCompatibleProvider, PROVIDER_PRESETS } from '@/services/llm/openai-compatible';
import { Card, CardTitle, Chip } from '@/components/ui';

type TestState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'ok'; reply: string }
  | { status: 'error'; message: string };

export function SettingsPanel() {
  const { engineMode, llmConfig, updateLlmConfig, setEngineMode } = useStore();

  const [baseUrl, setBaseUrl] = useState(llmConfig?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState(llmConfig?.apiKey ?? '');
  const [model, setModel] = useState(llmConfig?.model ?? '');
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const formReady = baseUrl.trim() !== '' && apiKey.trim() !== '' && model.trim() !== '';

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
          hint="OpenAI 兼容协议。密钥仅保存在本机浏览器，不会上传到任何服务器。"
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {PROVIDER_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="kt-btn py-1.5 text-[12px]"
              onClick={() => {
                setBaseUrl(preset.baseUrl);
                setModel(preset.model);
              }}
            >
              {preset.label}
            </button>
          ))}
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
          </Field>
          <Field label="模型名称">
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="glm-4v-plus / qwen-vl-max / deepseek-chat"
              className={inputClass}
            />
          </Field>
        </div>

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
              updateLlmConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() });
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
