/**
 * 插件广场面板。
 *
 * 顶部「插件」按钮点开的东西：从 CDN 拉清单、一键安装知识模块、卸载、手动注入。
 *
 * 界面上有两处刻意「不好看」的地方：
 * 1. 每个插件都显示脚本地址 —— 安装等于执行远端代码，用户有权在点之前知道装的是什么。
 * 2. 连不上线上清单时明确说「当前展示内置清单」，而不是默默降级。
 * 这两处都是诚实性优先于观感的选择，与整个作品的口径一致。
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardTitle, Chip } from '@/components/ui';
import {
  fetchRegistry,
  installFromSource,
  installPlugin,
  isInstalled,
  type MarketPlugin,
} from '@/services/plugin-market';

interface InstalledCourse {
  id: string;
  name: string;
}

function readInstalled(): InstalledCourse[] {
  const api = (window as unknown as {
    KnowTree?: { listCourses(): InstalledCourse[] };
  }).KnowTree;
  if (!api) return [];
  // 内置四门课不是插件，不出现在「已安装」里
  const builtin = new Set([
    'data-structure',
    'calculus',
    'linear-algebra',
    'probability',
  ]);
  return api.listCourses().filter((course) => !builtin.has(course.id));
}

export function PluginPanel({
  open,
  onClose,
  onInstalled,
}: {
  open: boolean;
  onClose: () => void;
  /** 安装成功后回调，让外壳把课程切过去 */
  onInstalled?: (courseId: string) => void;
}) {
  const [plugins, setPlugins] = useState<MarketPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromFallback, setFromFallback] = useState(false);
  const [installed, setInstalled] = useState<InstalledCourse[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const syncInstalled = useCallback(() => setInstalled(readInstalled()), []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    void fetchRegistry().then(({ registry, fromFallback: fallback }) => {
      if (!alive) return;
      setPlugins(registry.plugins);
      setFromFallback(fallback);
      setLoading(false);
    });
    syncInstalled();
    window.addEventListener('knowtree:course', syncInstalled);
    return () => {
      alive = false;
      window.removeEventListener('knowtree:course', syncInstalled);
    };
  }, [open, syncInstalled]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleInstall = async (plugin: MarketPlugin) => {
    setBusyId(plugin.id);
    setError(null);
    try {
      await installPlugin(plugin);
      syncInstalled();
      onInstalled?.(plugin.courseId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const handleUninstall = (plugin: MarketPlugin) => {
    const api = (window as unknown as {
      KnowTree?: { unregisterCourse(id: string): void };
    }).KnowTree;
    api?.unregisterCourse(plugin.courseId);
    syncInstalled();
  };

  const handleManual = () => {
    setError(null);
    try {
      installFromSource(code);
      syncInstalled();
      setCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="插件广场"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-card bg-white px-5 py-4 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-medium text-ink-900">插件广场</h2>
              <Chip tone="brand">知识模块</Chip>
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">
              知树只内置两门课，但归因引擎只认「知识树」这一种结构。
              装上一个知识模块，它就获得完整的诊断能力。
            </p>
          </div>
          <button type="button" className="kt-btn shrink-0" onClick={onClose}>
            关闭
          </button>
        </div>

        {fromFallback ? (
          <div className="rounded-card border border-[#FAC775] bg-[#FAEEDA] px-4 py-3 text-[12.5px] leading-relaxed text-[#854F0B]">
            没能连到线上清单（网络或 CDN 缓存延迟），当前展示的是内置清单。
            安装仍然可用 —— 插件脚本同样从 CDN 下载。
          </div>
        ) : null}

        {error ? (
          <div className="rounded-card border border-[#F7C1C1] bg-[#FCEBEB] px-4 py-3 text-[12.5px] leading-relaxed text-[#A32D2D]">
            {error}
          </div>
        ) : null}

        <Card>
          <CardTitle
            title="可安装的插件"
            hint="清单托管在 CDN 上，纯前端直接读取 —— 知树没有后端，广场也就没有后端。"
          />
          {loading ? (
            <p className="text-[13px] text-ink-500">正在读取插件清单……</p>
          ) : plugins.length === 0 ? (
            <p className="text-[13px] text-ink-500">清单里还没有插件。</p>
          ) : (
            <ul className="space-y-3">
              {plugins.map((plugin) => {
                const on = isInstalled(plugin, installed);
                return (
                  <li
                    key={plugin.id}
                    className="rounded-card border border-[var(--line)] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-medium text-ink-900">
                            {plugin.name}
                          </span>
                          {on ? <Chip tone="brand">已安装</Chip> : null}
                          {plugin.hasDemo ? <Chip>自带样例</Chip> : null}
                        </div>
                        <div className="mt-1 text-[12px] text-ink-500">
                          {plugin.author} · v{plugin.version}
                          {plugin.audience ? ` · ${plugin.audience}` : ''}
                          {plugin.chapters
                            ? ` · ${plugin.chapters} 章 ${plugin.nodes ?? ''} 个知识点`
                            : ''}
                        </div>
                        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-600">
                          {plugin.description}
                        </p>
                        <div className="mt-2 truncate text-[11px] text-ink-400">
                          脚本来源：{plugin.script}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {on ? (
                          <button
                            type="button"
                            className="kt-btn"
                            onClick={() => handleUninstall(plugin)}
                          >
                            卸载
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="kt-btn kt-btn-primary"
                            disabled={busyId === plugin.id}
                            onClick={() => void handleInstall(plugin)}
                          >
                            {busyId === plugin.id ? '安装中……' : '安装'}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle
            title="手动注入"
            hint="离线也能用：把插件脚本整段粘贴进来执行。等价于在控制台里粘贴。"
          />
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={4}
            placeholder="粘贴一段调用了 window.KnowTree.registerCourse({ tree }) 的脚本"
            className="w-full rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 font-mono text-[12px] outline-none transition focus:border-brand-400"
          />
          <button
            type="button"
            className="kt-btn mt-2"
            disabled={!code.trim()}
            onClick={handleManual}
          >
            执行
          </button>
        </Card>

        <Card>
          <CardTitle title="关于插件的安全边界" />
          <p className="text-[12.5px] leading-relaxed text-ink-600">
            安装插件 = 从上面那个地址下载脚本并
            <strong className="text-ink-900">执行它</strong>
            ，等价于运行插件作者的代码。
            所以这里把脚本地址如实列出来，请确认来源可信再点安装。
            这是「插件生态」的能力演示，不是一个带审核机制的生产级应用市场 —— 这个边界如实说明。
            插件课程的数据只存在内存，刷新页面后需要重新安装。
          </p>
        </Card>
      </div>
    </div>
  );
}
