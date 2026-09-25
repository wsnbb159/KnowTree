# 知树知识模块插件接口（KnowTree Knowledge Module Plugin API）

知树只认识两门课（数据结构、高等数学），但它的归因引擎只依赖一件事：**知识树**。
任何能被画成知识树的东西——物理、英语语法、线性代数、考研政治——都可以作为**知识模块插件**接入，
接入后立刻拥有同一套完整能力：拍照诊断、卡点归因、分层讲解、变式复测、错题本、教师端卡点热力图。

这就是「知树没有物理英语，但可以插件接入」的实现方式。

---

## 一、30 秒上手

页面加载后，在浏览器控制台执行：

```js
window.KnowTree.registerCourse({
  tree: {
    courseId: 'english-grammar',
    version: '1.0.0',
    nodes: [
      {
        id: 'eg.tenses.present',
        courseId: 'english-grammar',
        name: '一般现在时',
        chapter: '第1章 时态',
        summary: '表示习惯性动作与客观事实，主语第三人称单数时动词加 -s/-es。',
        difficulty: 1,
        cognitive: 'understand',
        prerequisites: [],
        misconceptions: ['认为一般现在时不能表示将来的动作'],
        sources: ['《新概念英语》第一册 Lesson 1'],
      },
    ],
  },
  name: '英语语法',
  audience: '通用 · 大一',
})
```

返回 `{ ok: true }` 即接入成功，课程下拉菜单里立刻出现「英语语法」。
返回 `{ ok: false, error: '...' }` 则会告诉你**具体哪个节点、缺了什么** —— 见第五节。

完整的可运行样例见仓库里的 [`examples/plugin-physics.js`](../examples/plugin-physics.js)，
它把《大学物理·力学》4 章 15 个知识点 + 1 道演示样例整套接了进来。

---

## 二、接口清单

知树把能力挂在全局对象 `window.KnowTree` 上（版本 `1.0.0`）。

### 2.1 知识模块

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `registerCourse` | `(input: CoursePluginInput) => { ok: true } \| { ok: false; error: string }` | 注册一门插件课程。同 `courseId` 重复注册会热更新覆盖。 |
| `unregisterCourse` | `(courseId: string) => void` | 注销插件课程。若当前正选中该课，会自动切回内置课程。 |
| `listCourses` | `() => Course[]` | 列出全部课程（内置 + 插件）。 |

### 2.2 模型层（WorkBuddy / 外部容器用）

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `setLLMAdapter` | `(adapter: { complete(req): Promise<string>; label?: string }) => void` | 注入自定义模型调用器。**优先级最高**，覆盖设置页配置与演示模式。 |
| `clearLLMAdapter` | `() => void` | 撤销注入，回落到设置页配置或演示模式。 |

`adapter.complete` 收到的是标准 OpenAI 消息结构，外加一个**中立的 `task` 标记**：

```ts
interface PluginLlmRequest {
  task: 'parse' | 'teach' | 'quiz' | 'chat';
  responseFormat: 'json' | 'text';   // 这次该返回什么，不用猜
  messages: { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] }[];
  temperature?: number;
  maxTokens?: number;
}
```

四个任务的含义：

| `task` | `responseFormat` | 你要做的事 | 对应诊断流水线的哪一步 |
| --- | --- | --- | --- |
| `parse` | `json` | 把题目图片与学生的手写解答读成结构化数据（题干、公式、逐步对错、候选考点） | 第 2 步 题目理解 |
| `teach` | `json` | 分层讲解：引导提示 → 步骤详解 → 完整答案，答案必须在最后一级才出现 | 第 5 步 讲解 |
| `quiz` | `json` | 围绕指定知识点出 3 道变式复测题，每题带检查点 | 第 6 步 复测 |
| `chat` | `text` | 回答追问，直接返回 Markdown。上下文已锚定在归因结论上，不许跑题 | 追问 |

三点说明：

- **`task` 用通用动词，而不是流水线术语。** 内部叫 `analyze` / `explain` / `variants` / `followup`，
  这套名字对插件作者是黑话 —— 看到 `analyze` 你不知道该干什么、该返回什么。
  所以对外收敛成 `parse` / `teach` / `quiz` / `chat`，这个翻译只在插件边界上做一次。
- **`responseFormat` 由知树显式给出，请以它为准。** 允许带 ``` 围栏，知树会稳健抽取。
  与其让你去翻文档，不如每个请求都带上这个字段。
- **`teach` 返回的是 JSON，不是 Markdown。** 讲解是结构化的三级内容（hint / steps / answer），
  答案必须落在最后一级，所以整包是 JSON；**里面的正文字段才是 Markdown**。
  只有 `chat` 直接返回 Markdown 文本。
  （这条是被实测纠出来的：最初文档按直觉写成「讲解当然是 Markdown」，实测直接解析失败。）

**最重要的边界**：`parse` 只负责**读懂题目**并指出学生的哪一步错了；
**「这道题卡在哪个知识点」永远由知树沿依赖图算出，模型说了不算。**
这是本作品的核心主张 —— 换掉模型，产品的判断力不下降。

### 2.3 状态读取与触发

| 方法 | 说明 |
| --- | --- |
| `getMastery()` | 当前课程的掌握度记录数组 |
| `getActiveCourse()` | 当前选中的 courseId |
| `getDiagnoses()` | 本机历史诊断记录 |
| `diagnose(dataUrl, name?)` | 传入题目图片 dataUrl，触发一次完整诊断 |
| `on(event, cb)` | 订阅事件，返回取消订阅函数 |

事件列表：

| 事件名 | 触发时机 | detail |
| --- | --- | --- |
| `knowtree:ready` | 接口挂载完成 | `{ version }` |
| `knowtree:diagnosis` | 一次诊断完成 | `{ diagnosisId, courseId }` |
| `knowtree:course` | 课程注册 / 注销 | `{ courseId, action }` |
| `knowtree:adapter` | 模型调用器变更 | `{ label }` |

**注意**：如果脚本在知树挂载前执行，请监听 `knowtree:ready` 再操作：

```js
if (window.KnowTree) {
  register();
} else {
  window.addEventListener('knowtree:ready', register, { once: true });
}
```

---

## 三、知识树的硬性要求

归因引擎对知识树的形状有硬性假设。**不满足的树会被拒绝注册**——
这是刻意的：形状不对的树不会报错，只会给出荒唐的归因结论，那比崩溃更危险。

| 要求 | 原因 |
| --- | --- |
| 每个节点必须有 `id` / `name` / `chapter` | 渲染、排序、跳转都要用 |
| `id` 在课程内唯一 | 掌握度、错误记录、错题本都以 id 为主键 |
| 每个节点必须有 `misconceptions`（非空） | **归因质量的根基**。没有典型误概念，归因就退化成"模型自由发挥" |
| 每个节点必须有 `sources`（非空） | 结论要能溯源到教材，老师才敢采信 |
| `prerequisites` 里的 id 必须真实存在 | 悬空引用会让依赖闭包算错 |
| 不能有环（必须是 DAG） | 有环就无法做拓扑回溯，归因会死循环 |
| 不能自指（`prerequisites` 不含自身） | 同上 |

关于 `chapter` 的一个约定：**章节号请写成「第N章 ……」的形式**。
知树按 `localeCompare(..., { numeric: true })` 排序，所以「第10章」会正确地排在「第9章」之后；
但如果写成「第十章」这种中文数字，排序就会错乱。

---

## 四、字段详解

### 4.1 `CoursePluginInput`

```ts
interface CoursePluginInput {
  tree: KnowledgeTree;        // 必需：知识树本体
  name?: string;              // 课程显示名，默认用 courseId
  audience?: string;          // 面向专业/学期，显示在下拉与页脚
  description?: string;       // 一句话说明
  demoCases?: DemoCase[];     // 可选：自带演示样例（见 4.3）
  mastery?: MasteryRecord[];  // 可选：自带学情画像（见 4.4）
}
```

### 4.2 `KnowledgeNode`

```ts
interface KnowledgeNode {
  id: string;                 // 稳定标识，如 'phy.dyn.friction'。写入错题记录后不得变更
  courseId: string;           // 必须等于所属树的 courseId
  name: string;               // 知识点名称
  chapter: string;            // 章节，如 '第2章 牛顿运动定律'
  summary: string;            // 一句话定义 —— 归因时会被引用给学生看
  difficulty: 1 | 2 | 3 | 4 | 5;
  cognitive: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  prerequisites: string[];    // 边方向：prerequisite -> this
  misconceptions: string[];   // 典型误概念（非空）
  sources: string[];          // 教材出处（非空）
}
```

**`misconceptions` 是整个插件里最值得花时间的字段。**
以物理插件为例，`摩擦力` 这个节点写的是：

```js
misconceptions: [
  '把 f = μN 套到静摩擦上，认为静摩擦也恒等于 μN',
  '认为摩擦力方向总与运动方向相反（实际是与相对运动方向相反）',
]
```

正是因为写清了这两条，归因才能把「整体方程漏了摩擦力」精确落到这个节点，
而不是含糊地说一句「你对力学不熟」。

### 4.3 `DemoCase`（可选）

带了 `demoCases`，这门课在**演示模式下**（不接任何模型）也能离线回放，
这在比赛答辩、离线演示、评委点开链接第一秒的体验上非常关键。
不带的话，这门课只能用真实模型诊断，演示模式下会明确提示而不假装工作。

```ts
interface DemoCase {
  id: string;
  label: string;                                    // 样例卡标题
  courseId: string;
  brief: string;                                    // 一句话说明这道题考什么
  photoCaption: string;
  photo: string;                                    // 题目图片（可以是 SVG data URL）
  bundle: {
    id: string;
    label: string;
    responses: {
      analyze: { parsed: {...}; candidates: {...}[] };  // 第 2 步：题目理解
      explain: { hint; steps; answer; reasoning; evidence }; // 第 5 步：讲解
      variants: { questions: {...}[] };                  // 第 6 步：变式复测
    };
    followups?: { match: string[]; reply: string }[];
    defaultReply?: string;
    suggestedFollowups?: string[];
  };
}
```

**关键认知**：`bundle` 里**不需要**（也**不应该**）指定「这道题卡在哪个知识点」。
归因是算出来的，不是说的：

1. `analyze.parsed.steps[]` 只负责指出学生的**哪一步错了**（`correct: false`）；
2. 知树拿这些错误步骤对应的 `nodeIds`，沿 `prerequisites` 回溯找失效边界；
3. 得出结论、因果链、波及范围。

所以写演示样例时，请把精力放在「准确描述学生的错误步骤」，而不是替算法写结论。
（一个真实教训：不要预设链条。作者曾认定某道题会回溯到「换元法」，
结果算法停在中间某一环，导致横幅说"卡在 A"、正文说"A 你是清楚的"，自相矛盾。）

### 4.4 `MasteryRecord`（可选）

```ts
{ nodeId: string; score: number /*0-100*/; attempts: number; updatedAt: string }
```

不带的话，知树用**中性基线**（每个知识点 70 分）填充。
不要给空数组——空画像会让归因一路回溯到最上游根节点，
凭空造出「你连最基础的都不会」这种结论。

---

## 五、校验失败时会看到什么

知树会拒绝非法知识树，并指出具体位置：

| 错误信息 | 原因 |
| --- | --- |
| `缺少有效的 courseId` | `tree.courseId` 为空 |
| `nodes 为空或不是数组` | 没给节点 |
| `节点缺少 id/name/chapter（位置：xxx）` | 三要素不全 |
| `节点 id 重复：xxx` | id 撞了 |
| `节点 xxx 自指依赖` | prerequisites 含自身 |
| `节点 xxx 缺少典型误概念（归因质量的数据基础）` | misconceptions 为空 |
| `节点 xxx 缺少教材出处（归因可溯源）` | sources 为空 |
| `节点 xxx 的前置依赖 yyy 不存在` | 悬空引用 |
| `没有根节点（所有节点都有前置依赖，存在环）` | 成环 |
| `节点 xxx 无法到达根节点（可能存在环）` | 成环 |
| `知识树索引失败：知识树前置依赖存在环：a -> b -> ... -> a` | 成环，并给出环路径 |

---

## 六、做成 LearnBuddy / WorkBuddy skill 的形态

知识模块插件可以封装成一个 skill：skill 的 `SKILL.md` 教 Agent 如何把一门学科
整理成知识树，`scripts/` 里放一棵已经校对好的树，运行时通过 `registerCourse` 注入。

推荐的 skill 目录：

```
skills/knowtree-physics/
├── SKILL.md                 # 什么时候用、怎么生成知识树、注意事项
├── data/
│   └── mechanics.json       # 校对过的知识树（可被 Agent 读取后注入）
└── scripts/
    ├── register.js          # 把 data/*.json 通过 window.KnowTree.registerCourse 注入
    └── validate.js          # 离线自检：用 Node 跑一遍同样的校验规则，提前发现问题
```

`validate.js` 的价值在于**离线自检**：知识树动辄几十个节点，
在浏览器控制台里逐个排查不现实。把第五节的校验规则在 Node 侧复现一份，
写树时就能立刻发现问题，不用等到注入失败。

---

## 七、设计边界（诚实说明）

- **跨课程依赖目前不支持。** 一门课的知识树自成闭包，`prerequisites` 只能指向同课程内的节点。
  「英语语法」前置依赖「语文基础」这种跨学科链条，现阶段请建模成一门课内的两个章节。
- **插件课程的数据只存在内存。** 刷新页面后需要重新注入（由容器/skill 负责）。
  诊断记录、掌握度、错题本则是持久化的，不受影响。
- **归因引擎不接受模型覆盖。** 模型只负责「读懂题目」和「组织讲解」，
  「卡在哪个知识点」永远由依赖图上的确定性算法给出。这是本作品的核心主张，
  也是它能在教师端被采信的原因。
