export * from './types';
export { createOpenAiCompatibleProvider, PROVIDER_PRESETS } from './openai-compatible';
export { createDemoProvider } from './demo';
export type { DemoBundle } from './demo';
export {
  buildAnalyzeMessages,
  buildExplainMessages,
  buildFollowupMessages,
  buildVariantsMessages,
  treeDigest,
} from './prompt';
export type { ExplainContext } from './prompt';
