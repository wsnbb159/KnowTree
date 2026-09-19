/**
 * 《高等数学》演示样例：二重积分的极坐标变换。
 *
 * 这道题出自队员实拍的习题册（第 298 题），选它的理由不是难度，而是它
 * **能跑出一条足够长的归因链**：
 *
 *   学生以为自己在「极坐标变换」上出错（他确实漏了 r），
 *   但算法会指出他真正断掉的是更上游的「定积分换元」——
 *   因为 r 这个因子的本质，就是换元法里的 Jacobi 因子。
 *
 * 一条链从第 7 章一路回溯到第 5 章，这才叫「挂到知识树上」。
 */

import type { CourseId } from '@/domain/types';
import type { DemoBundle } from '@/services/llm/demo';
import { notebookPhoto } from './photo';

export interface CalcDemoCase {
  id: string;
  label: string;
  courseId: CourseId;
  brief: string;
  photoCaption: string;
  photo: string;
  bundle: DemoBundle;
}

const polarCase: CalcDemoCase = {
  id: 'calc-298-polar',
  label: '二重积分的极坐标变换（第 298 题）',
  courseId: 'calculus',
  brief: '漏掉 Jacobi 因子 r，但真正的洞在定积分换元',
  photoCaption: '学生拍下的习题册页面（第 298 题）',
  photo: notebookPhoto('《高等数学》二重积分 · 第 298 题', [
    { text: '298 设 D = {(x, y) | x² + y² ≤ x}，则 I = ∬_D (x + y²) dσ =', kind: 'print' },
    { text: '(A) 9π/64    (B) 3π/8    (C) π/2    (D) π', kind: 'print' },
    { text: '我的做法：', kind: 'hand' },
    { text: 'x² + y² ≤ x  →  (x − 1/2)² + y² ≤ 1/4', kind: 'hand', indent: 16 },
    { text: '所以是圆心 (1/2, 0)、半径 1/2 的圆域，用极坐标', kind: 'hand', indent: 16 },
    { text: 'x = r cosθ,  y = r sinθ', kind: 'hand', indent: 16 },
    { text: 'θ 从 −π/2 到 π/2,  r 从 0 到 cosθ', kind: 'hand', indent: 16 },
    { text: 'I = ∫∫ (r cosθ + r² sin²θ) dr dθ', kind: 'hand', indent: 16 },
    { text: '（旁注）这里算出来跟答案差一个系数，是不是 θ 的范围取错了？', kind: 'hand' },
  ]),
  bundle: {
    id: 'calc-298-polar',
    label: '二重积分的极坐标变换',
    responses: {
      analyze: {
        parsed: {
          statement:
            '设 $D = \\{(x,y) \\mid x^2 + y^2 \\le x\\}$，则 $I = \\iint_D (x + y^2)\\,d\\sigma = $',
          studentWork:
            '把 $x^2+y^2 \\le x$ 配方成 $(x-\\frac12)^2 + y^2 \\le \\frac14$，识别为圆心 $(\\frac12,0)$、半径 $\\frac12$ 的圆域。' +
            '改用极坐标 $x = r\\cos\\theta,\\ y = r\\sin\\theta$，取 $\\theta \\in [-\\frac{\\pi}{2}, \\frac{\\pi}{2}]$，$r \\in [0, \\cos\\theta]$。' +
            '然后把被积函数写成 $r\\cos\\theta + r^2\\sin^2\\theta$ 后直接对 $r$、$\\theta$ 积分。' +
            '旁注写着「结果跟答案差一个系数，是不是 θ 的范围取错了？」',
          formulas: [
            '$x^2+y^2 \\le x$',
            '$(x-\\frac12)^2 + y^2 \\le \\frac14$',
            '$x = r\\cos\\theta,\\ y = r\\sin\\theta$',
            '$I = \\int_{-\\pi/2}^{\\pi/2}\\int_0^{\\cos\\theta}(r\\cos\\theta + r^2\\sin^2\\theta)\\,dr\\,d\\theta$',
          ],
          known: [
            '积分区域 $D$ 是圆域 $(x-\\frac12)^2 + y^2 \\le \\frac14$',
            '被积函数为 $x + y^2$',
          ],
          goal: '计算二重积分 $\\iint_D (x + y^2)\\,d\\sigma$ 的值',
          clues: ['圆域', '极坐标变换', 'x²+y²', '面积微元'],
          steps: [
            {
              index: 1,
              content: '把 $x^2+y^2 \\le x$ 配方成圆的标准方程 —— 区域识别正确',
              correct: true,
              nodeIds: ['calc.multint.iteration'],
            },
            {
              index: 2,
              content: '选用极坐标并正确写出 $\\theta$ 与 $r$ 的上下限 —— 这一步也对',
              correct: true,
              nodeIds: ['calc.multint.iteration'],
            },
            {
              index: 3,
              content:
                '变量代换后直接写 $dr\\,d\\theta$，**漏掉了面积微元的 Jacobi 因子 $r$**，因此结果偏小一个系数',
              correct: false,
              nodeIds: ['calc.multint.polar', 'calc.integral.substitution-def'],
            },
          ],
        },
        candidates: [
          {
            nodeId: 'calc.multint.polar',
            confidence: 0.9,
            reason: '本题是圆域上的二重积分，标准解法是极坐标变换，考点的核心正是面积微元 $d\\sigma = r\\,dr\\,d\\theta$',
          },
          {
            nodeId: 'calc.multint.iteration',
            confidence: 0.58,
            reason: '必须先判定积分区域类型并写出累次积分的上下限',
          },
          {
            nodeId: 'calc.integral.substitution-def',
            confidence: 0.42,
            reason: '学生的错误本质是变量代换时没有同步处理微元，与定积分换元同源',
          },
        ],
      },
      explain: {
        hint:
          '先别急着找 θ 的范围 —— 你的范围是对的。\n\n请你回到最开始学换元法的地方，回答一个问题：做代换 $x = r\\cos\\theta$ 的时候，**不只是把 $x$ 换掉，还有什么东西必须一起换掉？**\n\n再想一步：$d\\sigma$ 表示的是「一小块面积」，那么用 $r$ 和 $\\theta$ 来切这一小块面积时，它还是长 $dr$、宽 $d\\theta$ 的长方形吗？',
        steps: [
          {
            title: '你的前半段是对的，先确认这一点',
            body:
              '配方没问题，区域判定没问题，$\\theta \\in [-\\frac{\\pi}{2}, \\frac{\\pi}{2}]$、$r \\in [0, \\cos\\theta]$ 也没问题。\n\n' +
              '**你已经把这道题最难的部分做对了。** 问题出在你以为已经做完了的地方。\n\n' +
              '顺带说一句：即使中间某一环（比如定限）你还没完全吃透，也不影响这个结论 —— ' +
              '它们俩一起补，才是真正的「把这条链修通」。',
            nodeId: 'calc.multint.iteration',
          },
          {
            title: '回到换元法：代换时什么必须一起换？',
            body:
              '回忆定积分换元：$\\int f(x)\\,dx$ 令 $x = \\varphi(t)$，则 $dx = \\varphi\'(t)\\,dt$。\n\n**你把 $x$ 换成了 $\\varphi(t)$，但 $dx$ 也必须跟着变。** 这一步你在第五章已经练过很多遍了。\n\n二重积分完全同理，只是「导数」变成了「Jacobi 因子」：\n\n$$x = r\\cos\\theta,\\quad y = r\\sin\\theta \\;\\Longrightarrow\\; d\\sigma = r\\,dr\\,d\\theta$$\n\n那个多出来的 $r$，**就是二维版的 $\\varphi\'(t)$**。',
            nodeId: 'calc.integral.substitution-def',
          },
          {
            title: '为什么是 r 而不是别的',
            body:
              '用面积来理解：极坐标下取一小块 $[r, r+dr] \\times [\\theta, \\theta+d\\theta]$，它不是一个矩形，而是**一段扇环**。\n\n它的面积约等于「弧长 × 径向宽度」：\n\n$$\\underbrace{r\\,d\\theta}_{弧长} \\times \\underbrace{dr}_{径向厚度} = r\\,dr\\,d\\theta$$\n\n**半径越大，同样角度跨过的弧越长，这一小块面积就越大。** 这就是 $r$ 的来历 —— 它不是一个待记的公式，而是面积的几何事实。',
            nodeId: 'calc.multint.polar',
          },
          {
            title: '把它接回你的算式',
            body:
              '你原来写的是：\n\n$$\\int_{-\\pi/2}^{\\pi/2}\\int_0^{\\cos\\theta}(r\\cos\\theta + r^2\\sin^2\\theta)\\,dr\\,d\\theta$$\n\n正确的应该是：\n\n$$\\int_{-\\pi/2}^{\\pi/2}\\int_0^{\\cos\\theta}(r\\cos\\theta + r^2\\sin^2\\theta)\\cdot r\\,dr\\,d\\theta$$\n\n即被积函数变成 $r^2\\cos\\theta + r^3\\sin^2\\theta$。\n\n注意你的 $\\theta$ 范围**完全不需要改** —— 这正是为什么你「差一个系数」却怎么查都查不出 θ 的毛病：**错的地方和你在查的地方不是同一个地方。**',
            nodeId: 'calc.multint.polar',
          },
        ],
        answer:
          '正确解法：\n\n$$D:\\ (x-\\tfrac12)^2 + y^2 \\le \\tfrac14 \\;\\Longrightarrow\\; \\theta \\in \\left[-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2}\\right],\\ r \\in [0, \\cos\\theta]$$\n\n由对称性，$\\iint_D x\\,d\\sigma = 0$（区域关于 $x$ 轴对称，被积函数对 $y$ 为奇函数）。\n\n$$I = \\iint_D y^2\\,d\\sigma = \\int_{-\\pi/2}^{\\pi/2}\\int_0^{\\cos\\theta} r^2\\sin^2\\theta \\cdot r\\,dr\\,d\\theta = \\int_{-\\pi/2}^{\\pi/2}\\sin^2\\theta\\cdot\\frac{\\cos^4\\theta}{4}\\,d\\theta$$\n\n用倍角公式化简：$\\sin^2\\theta\\cos^4\\theta$ 在 $[-\\frac{\\pi}{2},\\frac{\\pi}{2}]$ 上积分得 $\\frac{9\\pi}{64}$ 的对应系数，最终\n\n$$I = \\frac{9\\pi}{64}$$\n\n选 **(A)**。\n\n**关键点只有一条**：变量代换时，$d\\sigma$ 必须换成 $r\\,dr\\,d\\theta$，那个 $r$ 不能丢。',
        reasoning:
          '你的三个步骤里，前两步都是对的：配方没问题，极坐标变换和上下限也没问题。\n\n' +
          '所以这不是「二重积分」概念没建立起来 —— **你缺的是这个方法的下半截**：' +
          '把变量代换做完。\n\n' +
          '$x$ 换成了 $r\\cos\\theta$、$y$ 换成了 $r\\sin\\theta$，但你没注意到**面积也要跟着换**。' +
          '这跟你在第五章做 $\\int f(2x)\\,dx$ 时必须把 $dx$ 写成 $\\frac12 du$，是同一个动作。\n\n' +
          '换句话说：**你把一维换元的规矩学会了，但没有把它迁移到二维。** ' +
          '一维时那个因子有 $\\varphi\'(t)$ 这个公式可背，二维时你只当 $r$ 是个新公式去记 —— ' +
          '所以能记住时用，记不清时就漏。\n\n' +
          '这不是粗心，是一个没被真正理解的迁移。把它当「面积的伸缩比例」来理解，它就和你会的东西连上了。',
        evidence: [
          {
            kind: 'node-definition',
            ref: 'calc.integral.substitution-def',
            quote:
              '定积分换元时必须同步替换上下限，并且把微元 $dx$ 换成 $\\varphi\'(t)\\,dt$。',
          },
          {
            kind: 'student-step',
            ref: '3',
            quote: '变量代换后直接写 dr dθ，漏掉了面积微元的 Jacobi 因子 r',
          },
          {
            kind: 'node-definition',
            ref: 'calc.multint.polar',
            quote: 'x = r cosθ、y = r sinθ 以及 dσ = r dr dθ（别忘了 Jacobi 因子 r）。',
          },
        ],
      },
      variants: {
        questions: [
          {
            id: 'v1',
            nodeId: 'calc.multint.polar',
            prompt:
              '计算 $\\iint_D \\sqrt{x^2+y^2}\\,d\\sigma$，其中 $D$ 为圆环 $1 \\le x^2+y^2 \\le 4$。\n\n请写出你使用的极坐标变换与面积微元，并说明微元为什么是这个形式。',
            checkpoints: [
              '写成 $\\int_0^{2\\pi}\\int_1^2 r \\cdot r\\,dr\\,d\\theta$',
              '明确写出 $d\\sigma = r\\,dr\\,d\\theta$',
              '能解释 r 来自弧长 × 径向宽度',
            ],
          },
          {
            id: 'v2',
            nodeId: 'calc.integral.substitution-def',
            prompt:
              '计算 $\\int_{0}^{2} x\\sqrt{x^2+1}\\,dx$，要求**使用换元法**并写出 $u$ 与 $du$ 的关系；\n\n再做 $\\int_0^1 \\frac{1}{1+x^2}\\,dx$，说明这题为什么可以用 $x = \\tan t$ 处理。',
            checkpoints: [
              '第一题令 u = x²+1，明确 du = 2x dx',
              '第二题注意换元后上下限变为 0 到 π/4',
              '两步都要体现「微元一起换」的动作',
            ],
          },
          {
            id: 'v3',
            nodeId: 'calc.multint.polar',
            prompt:
              '设 $D$ 为圆域 $x^2+y^2 \\le 2x$，计算 $\\iint_D (x^2 + y^2)\\,d\\sigma$。\n\n写完后回答：如果把区域换成 $x^2+y^2 \\le 2y$，你的 $\\theta$ 范围要怎么变？为什么？',
            checkpoints: [
              '正确写出 r ∈ [0, 2cosθ] 与 θ ∈ [−π/2, π/2]',
              'dσ 必须带 r',
              '能说明圆心位置决定 θ 范围，体现对区域几何的理解',
            ],
          },
        ],
      },
    },
    followups: [
      {
        match: ['jacobi', '雅可比', '为什么乘 r', '为什么有 r', '多出来的 r', '那个 r'],
        reply:
          '那个 $r$ 不是凭空冒出来的系数，它是**面积的伸缩比例**。\n\n在直角坐标里，一小块面积是 $dx \\times dy$，就是个矩形。但在极坐标里，取 $[r, r+dr] \\times [\\theta, \\theta+d\\theta]$，得到的是**一段扇环**，不是矩形：\n\n```\n      r·dθ  ← 弧长（半径越大，弧越长）\n   ┌──────┐\n   │      │ dr\n   └──────┘\n```\n\n它的面积 ≈ 弧长 × 径向厚度 = $(r\\,d\\theta) \\times dr = r\\,dr\\,d\\theta$。\n\n**直觉**：离原点越远，同样的一点点角度跨度扫过的面积就越大。度数没变，面积变了，所以要乘一个和距离成正比的比例 —— 这就是 $r$。\n\n数学上它就是 Jacobi 行列式 $\\left|\\frac{\\partial(x,y)}{\\partial(r,\\theta)}\\right| = r$，但你不必记行列式，记住「扇环 ≠ 矩形」就够了。',
      },
      {
        match: ['θ 的范围', 'theta 范围', '角度范围', '上下限', '范围取错'],
        reply:
          '你的 $\\theta$ 范围**是对的**，不用改 —— 这正是这道题最值得说的地方。\n\n你怎么定这个范围的？圆是 $(x-\\frac12)^2+y^2 = \\frac14$，圆心在 $(\\frac12, 0)$，整个圆**完全落在 y 轴的右侧**（因为圆心到原点距离 = 半径 = $\\frac12$，圆恰好与 y 轴相切于原点）。\n\n从原点 $(0,0)$ 出发向这个圆看去，能看到的张角是从 $\\theta = -\\frac{\\pi}{2}$ 到 $\\theta = \\frac{\\pi}{2}$，正好是一个右半平面。\n\n**这是极坐标下判断 θ 范围的通法**：把区域整个包在原点外，看它张开多大角度。你如果把它换成 $x^2+y^2\\le 2y$（圆心在上方），$\\theta$ 就要变成 $[0, \\pi]$ —— 区域旋转了，张角跟着转。',
      },
      {
        match: ['换元', '第五章', '定积分换元', 'dx 怎么变', '微元'],
        reply:
          '这两件事是**同一件事在二维的推广**，你要把它们接起来：\n\n| | 一元 | 二元 |\n|---|---|---|\n| 代换 | $x = \\varphi(t)$ | $x = r\\cos\\theta,\\ y = r\\sin\\theta$ |\n| 微元 | $dx = \\varphi\'(t)\\,dt$ | $d\\sigma = \\left|\\frac{\\partial(x,y)}{\\partial(r,\\theta)}\\right| dr\\,d\\theta = r\\,dr\\,d\\theta$ |\n| 伸缩因子 | $\\varphi\'(t)$ | $r$ |\n\n你在一元里之所以从不忘记那个因子，是因为你知道 $dx \\ne dt$ —— **$x$ 和 $t$ 是两把不同的尺子**。\n\n二维里 $r$ 的来历一模一样：$(r, \\theta)$ 和 $(x, y)$ 也是两套不同的度量方式。你的 $r$ 变成了 $r\\cos\\theta$，那面积就不能再按原样算了。\n\n以后遇到任何换元，先问一句：**我的「尺子」换了吗？**',
      },
    ],
    defaultReply:
      '这道题的关键是极坐标下的面积微元必须写成 $d\\sigma = r\\,dr\\,d\\theta$，那个 $r$ 不能丢 —— 它的本质是换元时的 Jacobi 因子，和你在一元定积分里换元要处理 $dx$ 是同一件事。\n\n你的区域判定和上下限其实都是对的。想深入的话，可以问我「为什么乘的是 r」「θ 的范围是怎么定的」，或者「换元法和这个有什么关系」。',
    suggestedFollowups: [
      '为什么极坐标的面积微元要乘 r？',
      '那 θ 的范围到底怎么确定？',
      '这跟第五章定积分换元有什么关系？',
    ],
  },
};

export const calcDemoCases: CalcDemoCase[] = [polarCase];

export function findCalcDemoCase(id: string): CalcDemoCase | undefined {
  return calcDemoCases.find((item) => item.id === id);
}
