/**
 * 插件广场。
 *
 * 知树是纯前端、无后端的作品，所以「广场」也就没有后端：
 * 清单是一个托管在 CDN 上的 JSON 文件，插件是一个自注册的 JS 脚本。
 * 页面 fetch 清单 → 列出插件 → 用户点安装 → 加载脚本并执行 → 脚本自己调
 * window.KnowTree.registerCourse() 完成注册。
 *
 * 为什么用 jsDelivr 而不是 raw.githubusercontent.com：
 * 实测 raw.githubusercontent.com 在本机网络下不通，且不带 CORS 头；
 * jsDelivr 返回 access-control-allow-origin: * —— 纯前端能直接读，这是硬前提。
 *
 * 安全边界（必须说清楚）：
 * 安装插件 = 从远端加载并执行脚本，等价于运行作者的代码。
 * 因此界面上要显示脚本地址，让用户在点之前知道自己在装什么。
 * 作品定位是「插件生态演示」，不是生产级应用市场 —— 这个取舍要如实告知。
 */

import type { CoursePluginInput } from '@/data/courses';

export interface MarketPlugin {
  id: string;
  name: string;
  courseId: string;
  author: string;
  version: string;
  audience?: string;
  description: string;
  chapters?: number;
  nodes?: number;
  hasDemo?: boolean;
  /** 自注册脚本地址 */
  script: string;
  source?: string;
}

export interface MarketRegistry {
  version: number;
  updatedAt?: string;
  plugins: MarketPlugin[];
}

/**
 * 清单走**同源相对路径**，随站点一起部署。
 *
 * 为什么不托管到 CDN：实测 jsDelivr 对分支名的缓存长达数天且刷不掉
 * （purge 接口无效，query string 不参与缓存键：无论加多少时间戳，
 * 拿回来的都是同一份旧内容）。把清单放上 CDN 的结果是「改了清单，线上还是旧内容」，
 * 用户看到的广场永远慢一拍，而且界面上一切正常 —— 最难查的那一类问题。
 * 同源则部署即最新，也不存在跨域问题。
 *
 * 代价是「加插件要重新部署站点」。这个取舍划算：插件脚本本身仍可从任意远端地址
 * 加载（script 支持完整 URL），生态的开放性没丢，丢掉的只是「清单热更新」这项非必需能力。
 */
const REGISTRY_PATH = 'plugins/registry.json';

function registryUrl(): string {
  // document.baseURI 会带上实际部署路径，站点放在子目录下也能工作
  return new URL(REGISTRY_PATH, document.baseURI).toString();
}

/**
 * 把清单里的 script 解析成可 fetch 的绝对地址。
 * 相对路径 = 站内插件（随站点更新）；完整 URL = 外部插件（作者自行保证可跨域）。
 */
function resolveScriptUrl(script: string): string {
  return /^https?:\/\//i.test(script)
    ? script
    : new URL(script, document.baseURI).toString();
}

/**
 * 内置兜底清单。
 * 清单文件读不到（离线、部署异常）时，广场不能变成一片空白 ——
 * 内置这份保证「插件」按钮点开永远有东西可看。
 * 注意：内容必须与 public/plugins/registry.json 保持一致。
 */
const FALLBACK_REGISTRY: MarketRegistry = {
  version: 1,
  plugins: [
    {
      id: 'physics-mechanics',
      name: '大学物理 · 力学',
      courseId: 'physics-mechanics',
      author: '知树团队',
      version: '1.0.0',
      audience: '理工科 · 大一上',
      description:
        '4 章 15 个知识点，自带 1 道演示样例与学情画像。样例是一道斜面上的连接体题 —— 表面考牛顿第二定律，实际卡在受力分析漏掉摩擦力。',
      chapters: 4,
      nodes: 15,
      hasDemo: true,
      script: 'plugins/physics.js',
      source: 'https://github.com/wsnbb159/KnowTree/blob/main/public/plugins/physics.js',
    },
  ],
};

export async function fetchRegistry(): Promise<{
  registry: MarketRegistry;
  fromFallback: boolean;
}> {
  try {
    const response = await fetch(registryUrl(), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const registry = (await response.json()) as MarketRegistry;
    if (!registry || !Array.isArray(registry.plugins)) {
      throw new Error('清单格式不对');
    }
    return { registry, fromFallback: false };
  } catch {
    // 拉不到就用内置清单，并把这件事告诉用户 —— 不能假装连上了广场
    return { registry: FALLBACK_REGISTRY, fromFallback: true };
  }
}

/**
 * 安装插件：加载远端脚本并执行，脚本自己会调 registerCourse。
 *
 * 用 new Function 而不是插 <script> 标签，是为了拿到同步的报错，
 * 否则脚本内部抛错只会变成一条控制台日志，界面上一片安静。
 */
export async function installPlugin(plugin: MarketPlugin): Promise<void> {
  const response = await fetch(resolveScriptUrl(plugin.script), { cache: 'no-store' });
  if (!response.ok) throw new Error(`下载插件失败：HTTP ${response.status}`);
  const code = await response.text();
  if (!code.trim()) throw new Error('插件脚本是空的');

  // eslint-disable-next-line no-new-func
  new Function(code)();
}

/** 手动注入：让用户直接粘贴一段插件代码，离线也能用 */
export function installFromSource(code: string): void {
  if (!code.trim()) throw new Error('代码是空的');
  // eslint-disable-next-line no-new-func
  new Function(code)();
}

/** 判断某个插件是否已注册（用 courseId 比对，这是插件唯一的稳定标识） */
export function isInstalled(plugin: MarketPlugin, courses: { id: string }[]): boolean {
  return courses.some((course) => course.id === plugin.courseId);
}

export type { CoursePluginInput };
