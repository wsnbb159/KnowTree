/**
 * 演示样例。
 *
 * 选这道题不是随意的：
 * 「求二叉树第 k 层结点个数」表面考的是树，但学生真正的困难几乎总是
 * 「搞不清递归调用时参数是怎么随着栈帧往下传的」——也就是第 3 章的栈。
 *
 * 一个第 4 章的题，考出了第 3 章的洞。这正是知树存在的意义。
 */

import type { CourseId } from '@/domain/types';
import type { DemoBundle } from '@/services/llm/demo';

export interface DemoCase {
  id: string;
  label: string;
  courseId: CourseId;
  /** 一句话说明这道题考什么，展示在样例选择卡上 */
  brief: string;
  /** 推荐使用的模型档位，纯展示 */
  photoCaption: string;
  /** 合成一张「习题册照片」，让演示画面有真实感 */
  photo: string;
  bundle: DemoBundle;
}

const FONT_STACK =
  "'Segoe UI', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";

/** 合成一张带手写痕迹的习题册照片（SVG 转 data URL），避免依赖外部图片资源 */
function notebookPhoto(lines: { text: string; kind: 'print' | 'hand'; indent?: number }[]): string {
  const rows = lines
    .map((line, index) => {
      const y = 96 + index * 34;
      const indent = line.indent ?? 0;
      if (line.kind === 'print') {
        return `<text x="${56 + indent}" y="${y}" font-family="${FONT_STACK}" font-size="17" fill="#23231f">${escapeXml(line.text)}</text>`;
      }
      return `<text x="${56 + indent}" y="${y}" font-family="'Kaiti SC','KaiTi','STKaiti',cursive" font-size="18" fill="#1b3f8b" transform="rotate(-0.5 ${56 + indent} ${y})">${escapeXml(line.text)}</text>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${130 + lines.length * 34}">
  <rect width="100%" height="100%" fill="#f3efe4"/>
  <g stroke="#d8d2c2" stroke-width="1">${Array.from({ length: Math.ceil((150 + lines.length * 34) / 34) }, (_, i) => `<line x1="40" y1="${126 + i * 34}" x2="700" y2="${126 + i * 34}"/>`).join('')}</g>
  <rect x="40" y="40" width="660" height="${60 + lines.length * 34}" fill="#fffdf7" stroke="#e2dccb"/>
  <text x="56" y="72" font-family="${FONT_STACK}" font-size="13" fill="#8a8579">《数据结构》课后习题 · 第 4 章</text>
  ${rows}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const treeLevelCase: DemoCase = {
  id: 'ds-tree-kth-level',
  label: '二叉树第 k 层结点数',
  courseId: 'data-structure',
  brief: '表面考树，实际卡在第 3 章的栈',
  photoCaption: '学生拍下的习题册页面',
  photo: notebookPhoto([
    { text: '3. 已知二叉树采用二叉链表存储，试编写算法', kind: 'print' },
    { text: '求二叉树中第 k 层结点的个数。', kind: 'print' },
    { text: '我的答案：', kind: 'hand' },
    { text: 'int CountLevel(BTNode *T, int k) {', kind: 'hand', indent: 16 },
    { text: '    if (T == NULL) return 0;', kind: 'hand', indent: 16 },
    { text: '    if (k == 1) return 1;', kind: 'hand', indent: 16 },
    { text: '    return CountLevel(T->lchild, k)', kind: 'hand', indent: 16 },
    { text: '         + CountLevel(T->rchild, k);', kind: 'hand', indent: 16 },
    { text: '}', kind: 'hand', indent: 16 },
    { text: '（旁注）k 到底该不该减 1？减了左子树不就少一层？', kind: 'hand' },
  ]),
  bundle: {
    id: 'ds-tree-kth-level',
    label: '二叉树第 k 层结点数',
    responses: {
      analyze: {
        parsed: {
          statement:
            '已知二叉树采用二叉链表存储，试编写算法求二叉树中第 $k$ 层结点的个数。',
          studentWork:
            '写了递归函数 CountLevel(T, k)：空树返回 0，$k=1$ 返回 1，否则返回 CountLevel(T->lchild, k) + CountLevel(T->rchild, k)。旁注写着「k 到底该不该减 1？减了左子树不就少一层？」',
          formulas: ['$k$', '$k=1$', '$CountLevel(T,k)$'],
          known: ['二叉树采用二叉链表存储', '要求第 $k$ 层结点个数'],
          goal: '设计算法返回第 $k$ 层的结点个数',
          clues: ['第 k 层', '递归', '左右子树'],
          steps: [
            {
              index: 1,
              content: '空树返回 0 —— 递归出口正确',
              correct: true,
              nodeIds: ['ds.tree.recursive-thinking'],
            },
            {
              index: 2,
              content: '$k=1$ 时返回 1 —— 这是「当前这棵子树的第 1 层」，出口正确',
              correct: true,
              nodeIds: ['ds.tree.recursive-thinking'],
            },
            {
              index: 3,
              content:
                '向下递归时沿用原 $k$ 而没有减 1，导致永远触不到 $k=1$ 的出口，也数不出真正的第 $k$ 层',
              correct: false,
              nodeIds: ['ds.stack.callstack'],
            },
          ],
        },
        candidates: [
          {
            nodeId: 'ds.tree.recursive-thinking',
            confidence: 0.88,
            reason: '本题要求把「第 k 层」分解到左右子树求解，属树问题的递归分解',
          },
          {
            nodeId: 'ds.tree.traversal',
            confidence: 0.54,
            reason: '需要遍历整棵树才能统计某一层的结点',
          },
          {
            nodeId: 'ds.stack.callstack',
            confidence: 0.41,
            reason: '学生的错误出在递归参数随调用栈下传的环节',
          },
        ],
      },
      explain: {
        hint: '先别看代码。拿一张纸画一棵只有 3 个结点的树：根 $A$，左孩子 $B$，右孩子 $C$。把 $k$ 设成 2。\n\n然后做一件事：**画出 `CountLevel(A, 2)` 被调用的那一瞬间，函数栈里有什么。**\n\n再回答我一个问题：当递归走到左子树 $B$ 里的时候，$B$ 这棵子树自己的「第 1 层」是谁？它跟整棵树里的第 1 层，是同一层吗？',
        steps: [
          {
            title: '「第 k 层」是相对的，不是绝对的',
            body: '题目说的「第 $k$ 层」是从整棵树的根往下数的。但当递归走进左子树时，**那棵子树已经是一棵独立的树了**，它的根就是 $B$。\n\n在 $B$ 这棵子树里，整棵树的第 2 层，对应的正是**子树自己的第 1 层**。所以每往下走一层，我们要找的相对层数就少 1 —— 这就是 `k - 1` 的全部含义。',
            nodeId: 'ds.tree.recursive-thinking',
          },
          {
            title: '把栈画出来，答案就自己浮出来了',
            body: '调用 `CountLevel(A, 2)` 时，栈里是：\n\n```\n[ A, k=2 ]\n```\n\n进入左孩子 $B$，需要求「$B$ 子树里的第 1 层」，于是压栈：\n\n```\n[ A, k=2 ]\n[ B, k=1 ]\n```\n\n现在 `k == 1` 成立，直接返回 1 —— 这正是你写的那个出口。\n\n**你原来的写法之所以错，是因为栈帧里 $k$ 永远是 2，`k == 1` 这条出口一辈子也走不到，函数只能一路压栈直到空指针。**',
            nodeId: 'ds.stack.callstack',
          },
          {
            title: '从「值」改成「数量」',
            body: '上面证明了：走到子树时层数要减 1。但题目要的是**个数**，所以要改成「当前这棵子树的第 $k-1$ 层有多少个结点」，然后把左右子树的结果相加。\n\n注意出口 $k=1$ 的含义也变了：它返回的不是「第 1 层有多少个」，而是「**当前这棵子树的根，就是我要数的那个结点**」，所以贡献 1 个。',
            nodeId: 'ds.tree.recursive-thinking',
          },
          {
            title: '自己验证一遍',
            body: '还是那棵 3 个结点的树，求 $k=2$：\n\n`CountLevel(A,2) = CountLevel(B,1) + CountLevel(C,1) = 1 + 1 = 2`\n\n而第 2 层确实是 $B$ 和 $C$ 两个结点。对了。',
          },
        ],
        answer: '正确的递归写法是让层数随递归深度递减：\n\n```c\nint CountLevel(BTNode *T, int k) {\n    if (T == NULL) return 0;     // 空树没有结点\n    if (k == 1)   return 1;      // 当前子树的根正是要找的那一层\n    if (k < 1)    return 0;      // 层次不合法\n    return CountLevel(T->lchild, k - 1)\n         + CountLevel(T->rchild, k - 1);\n}\n```\n\n要点只有一条：**进入子树后，要找的相对层数减 1**。\n\n时间复杂度 $O(n)$，每个结点最多访问一次；空间复杂度 $O(h)$，即递归深度，最坏为树高 $h$。',
        reasoning: '你写的两个出口都是对的，说明你知道递归要有出口。问题出在**递归参数怎么往下传**：你下意识把 $k$ 当成一个固定不变的值（"整棵树的第 2 层"），而不是一个随子树动态变化的相对层次。\n\n这不是树的错，是**函数调用栈**没吃透 —— 你还没建立起「每压一次栈，就进入了一个新环境，参数在新环境里必须重新解读」这个直觉。把栈画出来，这个坎就过去了。',
        evidence: [
          {
            kind: 'node-definition',
            ref: 'ds.stack.callstack',
            quote:
              '每次函数调用压入一个栈帧，保存返回地址与局部变量；递归的本质就是栈的自动管理。',
          },
          {
            kind: 'student-step',
            ref: '3',
            quote: '向下递归时沿用原 k 而没有减 1，导致永远触不到 k=1 的出口',
          },
          {
            kind: 'node-definition',
            ref: 'ds.tree.recursive-thinking',
            quote: '把树的问题拆成「左子树的结果 + 右子树的结果 + 根结点」，只关注单层逻辑。',
          },
        ],
      },
      variants: {
        questions: [
          {
            id: 'v1',
            nodeId: 'ds.stack.callstack',
            prompt:
              '已知 `int f(int n) { return n <= 1 ? 1 : n * f(n - 1); }`。请写出调用 `f(4)` 的过程中，函数栈帧里参数 $n$ 的取值序列（按压栈顺序），并说明第一次「出栈返回」发生在哪一步。',
            checkpoints: [
              '压栈序列为 4 → 3 → 2 → 1',
              '明确 n=1 时不再压栈，函数开始返回',
              '理解返回值是自内向外逐层相乘',
            ],
          },
          {
            id: 'v2',
            nodeId: 'ds.stack.callstack',
            prompt:
              '已知 `void g(int n) { if (n == 0) return; g(n - 1); printf("%d", n); }`。调用 `g(3)` 的输出是什么？\n\n请说明为什么输出不是 `123`，并用栈帧画出 `printf` 的执行顺序。',
            checkpoints: [
              '输出为 123',
              '关键在 printf 位于递归调用之后，要等内层返回后才执行',
              '能画出 1、2、3 依次出栈执行的顺序',
            ],
          },
          {
            id: 'v3',
            nodeId: 'ds.stack.callstack',
            prompt:
              '对一棵采用二叉链表存储的二叉树，写出求其高度的递归函数。\n\n写完后回答：这个函数的**递归深度**与**树高**是什么关系？为什么？',
            checkpoints: [
              '返回 max(左子树高, 右子树高) + 1',
              '递归深度等于树高',
              '能说明「每深入一层压一次栈」是这一结论的原因',
            ],
          },
        ],
      },
    },
    followups: [
      {
        match: ['k-1', 'k - 1', '减 1', '减一', '为什么要减'],
        reply:
          '因为「第几层」是一个**相对于根**的说法，而递归每往下走一层，根本身就换人了。\n\n整棵树里数第 2 层 → 在左子树里就是数它的第 1 层。所以 `k - 1` 描述的不是「层数变少了」，而是「**参照系换了一层**」。\n\n你可以这样验算：假如不减 1，那左子树里还是找第 2 层；可左子树的总高度已经比原来少 1，你找的其实是整棵树的第 3 层。',
      },
      {
        match: ['迭代', '非递归', '循环', '不用递归'],
        reply:
          '改成迭代反而更好理解：用队列做层序遍历，一层一层数。\n\n```c\nint CountLevel(BTNode *T, int k) {\n    if (T == NULL || k < 1) return 0;\n    Queue q; InitQueue(&q); EnQueue(&q, T);\n    int level = 1, count = 0;\n    while (!QueueEmpty(q)) {\n        int size = QueueLength(q);\n        count = 0;\n        for (int i = 0; i < size; i++) {\n            BTNode *p; DeQueue(&q, &p);\n            count++;\n            if (p->lchild) EnQueue(&q, p->lchild);\n            if (p->rchild) EnQueue(&q, p->rchild);\n        }\n        if (level == k) return count;\n        level++;\n    }\n    return 0;\n}\n```\n\n注意这里的关键：**用 `size` 把「当前这一层」框出来**。这和递归里 `k - 1` 解决的是同一个问题 —— 怎么知道「我现在在第几层」。理解了这个，两种写法你就都通了。',
      },
      {
        match: ['栈', '栈帧', '调用栈', '怎么压栈'],
        reply:
          '栈帧 = 一次函数调用在内存里的「全套行李」：参数、局部变量、以及**返回后该回到哪一行**。\n\n关键在于它是**先进后出**：\n\n```\nCountLevel(A, 2)\n  └─ 需要知道左子树结果 → 先压栈，去算 CountLevel(B, 1)\n       └─ k==1 命中，返回 1  ← 最先返回\n  └─ 凑齐左右结果，相加，返回  ← 最后返回\n```\n\n你可以拿一个具体例子手推：算 `f(4) = 4 * f(3)`，而 `f(3) = 3 * f(2)`……在 `f(1)` 返回之前，内存里同时挂着 4 个互不干扰的 `n`。**它们不是同一个变量，只是恰好同名。** 想通这一句，递归就通了。',
      },
    ],
    defaultReply:
      '好问题。简单说：这道题的正确解法是让层数随递归深度递减（`k - 1`），因为进入子树后「第 k 层」的参照系变了。\n\n如果你是想问更细的地方，可以试着具体一点问我，比如「为什么减 1 而不是减 2」或者「迭代怎么实现」，我可以讲得更透。',
    suggestedFollowups: [
      '为什么进入子树后 k 要减 1？',
      '不想用递归，迭代怎么写？',
      '栈帧到底是什么意思？',
    ],
  },
};

export const demoCases: DemoCase[] = [treeLevelCase];

export function findDemoCase(id: string): DemoCase | undefined {
  return demoCases.find((item) => item.id === id);
}
