/**
 * 知识模块插件样例：把《大学物理 · 力学》作为一门插件课程接入知树。
 *
 * 用法（三种任选其一）：
 *   1. 浏览器控制台：把本文件内容粘贴进去回车。
 *   2. 页面里加 <script src="plugin-physics.js"></script>，接口就绪后自动注册。
 *   3. 在 LearnBuddy / WorkBuddy 的 skill 里，让 Agent 读取本文件并执行。
 *
 * 关键点：知树不认识物理，但它认识**知识树**。
 * 只要按知识树的形状把物理的概念依赖画出来，归因引擎立刻就能诊断这门课。
 *
 * 一个知识模块插件要提供两样东西：
 *   - tree      ：知识树（必需）。这是插件的本体。
 *   - demoCases ：演示样例（可选）。带了才能在「演示模式」下离线回放；
 *                 不带的话，这门课只能用真实模型诊断。
 *   - mastery   ：学情画像（可选）。不带的话知树用中性基线填充。
 *
 * 知识树的硬性要求（不符合会被 registerCourse 拒绝，并告诉你错在哪）：
 *   - 每个节点必须有 id / name / chapter
 *   - id 全局唯一、不自杀依赖（prerequisites 不含自身）
 *   - prerequisites 里出现的 id 必须真的存在
 *   - 必须有 misconceptions（典型误概念）与 sources（教材出处）
 *     —— 前者是归因质量的根基，后者让结论可溯源，缺了归因会退化成瞎猜
 *   - 不能有环（必须是 DAG）
 */

(function () {
  /* ------------------------------------------------------------------ */
  /* 1. 知识树本体                                                       */
  /* ------------------------------------------------------------------ */

  const COURSE = 'physics-mechanics';

  /**
   * 造节点的辅助函数，只是为了让下面的知识树读起来像一份大纲。
   * 注意 prerequisites 写的是「同课程内的节点 id」——
   * 跨课程依赖目前不支持（一门课的知识树自成闭包）。
   */
  function node(id, name, chapter, prerequisites, summary, misconceptions, sources, extra) {
    return {
      id: `${COURSE}.${id}`,
      courseId: COURSE,
      name,
      chapter,
      summary,
      difficulty: extra?.difficulty ?? 3,
      cognitive: extra?.cognitive ?? 'apply',
      prerequisites: prerequisites.map((p) => `${COURSE}.${p}`),
      misconceptions,
      sources,
    };
  }

  const tree = {
    courseId: COURSE,
    version: 'physics-mechanics@1.0.0',
    nodes: [
      /* ---- 第 1 章 质点运动学 ---- */
      node(
        'kin.desc',
        '质点·参考系·位移与路程',
        '第1章 质点运动学',
        [],
        '把物体抽象成有质量无体积的点，并在选定参考系中用位置矢量描述其运动。',
        [
          '把「位移」与「路程」混为一谈，认为绕一圈回到原点位移不为零',
          '默认必须选地面作参考系，忽视参考系可任选',
        ],
        ['《大学物理》第1章 1.1 质点 参考系'],
        { difficulty: 1, cognitive: 'understand' },
      ),
      node(
        'kin.velocity',
        '速度与加速度的矢量性',
        '第1章 质点运动学',
        ['kin.desc'],
        '速度是位置矢量对时间的变化率，加速度是速度对时间的变化率，二者均为矢量，方向各自独立。',
        [
          '认为「加速度为负就是减速」，忽视减速只发生在加速度与速度反向时',
          '认为加速度方向总与速度方向一致',
        ],
        ['《大学物理》第1章 1.2 速度 加速度'],
        { difficulty: 2 },
      ),
      node(
        'kin.projectile',
        '抛体运动与运动叠加',
        '第1章 质点运动学',
        ['kin.velocity'],
        '平抛与斜抛是水平匀速与竖直匀变速两种独立运动的叠加，两个方向互不干扰。',
        [
          '把斜抛的时间算成「上升时间 + 下降时间」两段而非对称求解',
          '认为「最高点速度为零」，实际只有竖直分量为零',
        ],
        ['《大学物理》第1章 1.3 抛体运动'],
      ),
      node(
        'kin.circular',
        '圆周运动·角量与线量',
        '第1章 质点运动学',
        ['kin.velocity'],
        '用角位移、角速度、角加速度描述转动，与线量的关系是 v = ωr、a_t = αr。',
        [
          '做圆周运动时漏掉法向加速度，只算切向',
          '把 ω 与 v 当成同一量纲混用',
        ],
        ['《大学物理》第1章 1.4 圆周运动'],
      ),

      /* ---- 第 2 章 牛顿定律 ---- */
      node(
        'dyn.newton1',
        '牛顿第一定律与惯性',
        '第2章 牛顿运动定律',
        ['kin.velocity'],
        '不受外力（或合外力为零）时物体保持静止或匀速直线运动，惯性是维持运动状态的内在属性。',
        ['认为「运动需要力来维持」，把匀速运动也说成有力在推'],
        ['《大学物理》第2章 2.1 牛顿第一定律'],
        { difficulty: 2, cognitive: 'understand' },
      ),
      node(
        'dyn.force-analysis',
        '受力分析与隔离体法',
        '第2章 牛顿运动定律',
        ['dyn.newton1'],
        '把研究对象单独隔离出来，逐一画出它受到的所有外力，再在选定方向上列方程。',
        [
          '漏画摩擦力或凭空多画「向前的冲力」',
          '把「物体对其他物体的反作用力」也画到自己身上',
        ],
        ['《大学物理》第2章 2.2 常见力与受力分析'],
      ),
      node(
        'dyn.newton2',
        '牛顿第二定律 F = ma',
        '第2章 牛顿运动定律',
        ['dyn.force-analysis', 'kin.velocity'],
        '合外力等于质量与加速度的乘积，矢量方程，可在任意方向分解后各自成立。',
        [
          '把 F 理解成「某个力」而不是「合外力」',
          '在非惯性系里直接套 F = ma 而不引入惯性力',
        ],
        ['《大学物理》第2章 2.3 牛顿第二定律'],
        { difficulty: 2 },
      ),
      node(
        'dyn.friction',
        '摩擦力·静摩擦与滑动摩擦',
        '第2章 牛顿运动定律',
        ['dyn.newton2'],
        '静摩擦力是被动力，大小随外力变化但有上限 f_max = μN；滑动摩擦力方向与相对运动方向相反。',
        [
          '把 f = μN 套到静摩擦上，认为静摩擦也恒等于 μN',
          '认为摩擦力方向总与运动方向相反（实际是与**相对**运动方向相反）',
        ],
        ['《大学物理》第2章 2.4 摩擦力'],
      ),
      node(
        'dyn.newton3',
        '牛顿第三定律与相互作用',
        '第2章 牛顿运动定律',
        ['dyn.newton1'],
        '作用力与反作用力等大反向、作用在不同物体上、性质相同、同时存在同时消失。',
        ['把一对作用力与反作用力当成平衡力，误以为可以互相抵消'],
        ['《大学物理》第2章 2.5 牛顿第三定律'],
        { difficulty: 1, cognitive: 'understand' },
      ),

      /* ---- 第 3 章 动量与角动量 ---- */
      node(
        'mom.impulse',
        '冲量与动量定理',
        '第3章 动量与角动量',
        ['dyn.newton2'],
        '合外力的冲量等于动量的变化量，是牛顿第二定律对时间的累积形式。',
        [
          '把冲量直接当成力的大小，忽视作用时间',
          '认为动量定理只对恒力成立',
        ],
        ['《大学物理》第3章 3.1 冲量与动量定理'],
      ),
      node(
        'mom.conservation',
        '动量守恒定律',
        '第3章 动量与角动量',
        ['mom.impulse'],
        '系统所受合外力为零时总动量守恒，内力只改变动量在各部分的分配。',
        [
          '认为「碰撞时间很短所以动量守恒」，忽视守恒的真实条件是合外力为零',
          '在动量守恒中忽略各动量的矢量方向，直接做标量相加',
        ],
        ['《大学物理》第3章 3.2 动量守恒'],
        { difficulty: 3 },
      ),

      /* ---- 第 4 章 功与能 ---- */
      node(
        'work.theorem',
        '功·动能定理',
        '第4章 功能原理与能量守恒',
        ['dyn.newton2', 'kin.velocity'],
        '合外力做的功等于动能的变化量，是牛顿第二定律对空间的累积形式。',
        [
          '把「功」当成矢量相加，忽视功是标量但有正负',
          '对摩擦力做功直接用 f·s，忽视摩擦力方向与位移的夹角',
        ],
        ['《大学物理》第4章 4.1 功与动能定理'],
      ),
      node(
        'work.potential',
        '保守力与势能',
        '第4章 功能原理与能量守恒',
        ['work.theorem'],
        '做功与路径无关的力叫保守力，可引入只与位置有关的势能，重力势能、弹性势能是典型例子。',
        [
          '认为「所有力都能定义势能」，把摩擦力也说成有势能',
          '混淆势能零点的选取与势能差的实际意义',
        ],
        ['《大学物理》第4章 4.2 保守力与势能'],
      ),
      node(
        'work.conservation',
        '机械能守恒及其条件',
        '第4章 功能原理与能量守恒',
        ['work.potential'],
        '只有保守力做功（或非保守力做功为零）时，动能与势能之和保持不变。',
        [
          '只要没有摩擦力就断言机械能守恒，忽视其他外力做功',
          '先判守恒再列式，反了——应先检验条件成立',
        ],
        ['《大学物理》第4章 4.3 机械能守恒'],
      ),
      node(
        'work.energy-general',
        '功能原理与普遍能量守恒',
        '第4章 功能原理与能量守恒',
        ['work.potential', 'work.theorem'],
        '非保守力做功等于机械能的变化；推广到所有形式能量，即普遍的能量守恒定律。',
        ['把能量守恒与机械能守恒当成同一件事，忽视能量可以向内能转化'],
        ['《大学物理》第4章 4.4 能量守恒定律'],
        { difficulty: 4, cognitive: 'analyze' },
      ),
    ],
  };

  /* ------------------------------------------------------------------ */
  /* 2. 演示样例（可选，但强烈建议带）                                   */
  /* ------------------------------------------------------------------ */

  /*
   * 演示样例里藏着一件重要的事：归因不是模型说的，是知识树算的。
   * 下面的 analyze 只负责「读懂题目 + 指出学生的哪一步错了」，
   * 剩下「这个错该归到哪个知识点」由知树沿 prerequisites 回溯决定。
   *
   * 这道题的设计意图：「连接体问题」表面考牛顿第二定律，
   * 但学生真正的洞在**受力分析漏掉了摩擦力**（第2章）——
   * 而摩擦力之所以被漏，往往是因为没先做隔离体（更靠前的节点）。
   */
  const demoCases = [
    {
      id: 'phy-connect-friction',
      label: '斜面上连接体的加速度',
      courseId: COURSE,
      brief: '表面考牛顿第二定律，实际卡在「受力分析漏了摩擦力」。',
      photoCaption: '一道力学作业照片',
      photo:
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300">
            <rect width="420" height="300" fill="#f7f4ec"/>
            <line x1="0" y1="66" x2="420" y2="66" stroke="#d9d2bf"/>
            <text x="24" y="44" font-family="'Kaiti SC','KaiTi',serif" font-size="19" fill="#23231f">3. 如图所示，质量 m₁ 的物块 A 沿倾角 θ 的</text>
            <text x="24" y="96" font-family="'Kaiti SC','KaiTi',serif" font-size="19" fill="#23231f">   粗糙斜面下滑，用轻绳跨过定滑轮与质量 m₂</text>
            <text x="24" y="128" font-family="'Kaiti SC','KaiTi',serif" font-size="19" fill="#23231f">   的物块 B 相连，斜面与 A 间动摩擦因数 μ。</text>
            <text x="24" y="160" font-family="'Kaiti SC','KaiTi',serif" font-size="19" fill="#23231f">   求系统的加速度 a。</text>
            <text x="24" y="212" font-family="'Kaiti SC','KaiTi',serif" font-size="18" fill="#1b3f8b" transform="rotate(-1 24 212)">解：对整体用牛顿第二定律：</text>
            <text x="24" y="244" font-family="'Kaiti SC','KaiTi',serif" font-size="18" fill="#1b3f8b" transform="rotate(-0.6 24 244)">m₂g - m₁g·sinθ = (m₁+m₂)a</text>
            <text x="24" y="276" font-family="'Kaiti SC','KaiTi',serif" font-size="18" fill="#1b3f8b">得 a = (m₂g - m₁g sinθ)/(m₁+m₂)</text>
          </svg>`,
        ),
      bundle: {
        id: 'phy-connect-friction',
        label: '斜面上连接体的加速度',
        responses: {
          analyze: {
            parsed: {
              statement:
                '质量 $m_1$ 的物块 A 沿倾角 $\\theta$ 的粗糙斜面下滑，用轻绳跨过定滑轮与质量 $m_2$ 的物块 B 相连，斜面与 A 间动摩擦因数为 $\\mu$，求系统加速度 $a$。',
              studentWork:
                '学生对「整体」直接套牛顿第二定律：$m_2g - m_1g\\sin\\theta = (m_1+m_2)a$，得出 $a = \\dfrac{m_2g - m_1g\\sin\\theta}{m_1+m_2}$。全程没有出现 $\\mu$。',
              formulas: ['$m_2g - m_1g\\sin\\theta = (m_1+m_2)a$', '$\\mu$', '$a$'],
              known: ['斜面粗糙，动摩擦因数 $\\mu$', '轻绳跨过定滑轮', '两物块质量 $m_1$、$m_2$'],
              goal: '求系统的加速度 $a$',
              clues: ['粗糙斜面', '连接体', '动摩擦因数 μ'],
              steps: [
                {
                  index: 1,
                  content: '把 A、B 当作一个整体列方程，思路方向是对的（连接体可以先整体后隔离）',
                  correct: true,
                  nodeIds: [`${COURSE}.dyn.newton2`],
                },
                {
                  index: 2,
                  content:
                    '整体方程里漏掉了斜面摩擦力：粗糙斜面说明 A 受滑动摩擦力 $\\mu m_1g\\cos\\theta$，方向沿斜面向上',
                  correct: false,
                  nodeIds: [`${COURSE}.dyn.friction`],
                },
                {
                  index: 3,
                  content:
                    '更没有单独隔离 A、B 分析各自的受力，因此无从检查是否有力被漏掉',
                  correct: false,
                  nodeIds: [`${COURSE}.dyn.force-analysis`],
                },
                {
                  index: 4,
                  content: '最后把结果写成与 $\\mu$ 无关的式子，与题设「粗糙」自相矛盾',
                  correct: false,
                  nodeIds: [`${COURSE}.work.potential`],
                },
              ],
            },
            candidates: [
              {
                nodeId: `${COURSE}.dyn.friction`,
                confidence: 0.9,
                reason: '题干明确给出动摩擦因数，而学生解答中完全没有出现摩擦力',
              },
              {
                nodeId: `${COURSE}.dyn.newton2`,
                confidence: 0.62,
                reason: '本题核心是连接体在牛顿第二定律下的整体与隔离分析',
              },
              {
                nodeId: `${COURSE}.dyn.force-analysis`,
                confidence: 0.55,
                reason: '漏力的根因是没有做隔离体受力分析',
              },
            ],
          },
          explain: {
            hint: '先别改方程。做一件事：**把 A 单独拎出来画一遍受力图。**\n\nA 身上一共受几个力？重力、支持力、绳的拉力……还有呢？\n\n题干里那个 $\\mu$ 是白给的吗？',
            steps: [
              {
                title: '题干里的每个量，都必须在方程里有位置',
                body: '这道题给了 $\\mu$。这是一个很强的信号：**它必须出现在某处**。\n\n如果最后答案里没有 $\\mu$，那只有两种可能：要么题目多给了条件（几乎不可能），要么你漏掉了某个力。',
                nodeId: `${COURSE}.dyn.force-analysis`,
              },
              {
                title: '隔离 A：漏掉的正是摩擦力',
                body: 'A 受四个力：重力 $m_1g$、斜面支持力 $N$、绳拉力 $T$、以及**沿斜面向上的滑动摩擦力** $f = \\mu N = \\mu m_1 g\\cos\\theta$。\n\n因为 A 沿斜面下滑，摩擦力方向沿斜面向上，所以在「沿斜面向下」这个正方向上是**减项**。',
                nodeId: `${COURSE}.dyn.friction`,
              },
              {
                title: '把摩擦力放回整体方程',
                body: '修正后的整体方程是：\n\n$$m_2g - m_1g\\sin\\theta - \\mu m_1 g\\cos\\theta = (m_1+m_2)a$$\n\n所以 $a = \\dfrac{m_2g - m_1g\\sin\\theta - \\mu m_1g\\cos\\theta}{m_1+m_2}$。',
                nodeId: `${COURSE}.dyn.newton2`,
              },
              {
                title: '自己验一遍边界',
                body: '令 $\\mu = 0$（光滑），答案退化成你原来写的式子 —— 说明你原来的思路没白费，只是少了这一项。\n\n再令 $m_2 = 0$ 且 $\\mu > \\tan\\theta$，加速度应当为 0（A 卡住不动），用新式子验一下。',
              },
            ],
            answer:
              '正确的解法是「先隔离、再整体」：\n\n**隔离 A**（沿斜面方向，向下为正）：\n$$m_1g\\sin\\theta - T - \\mu m_1g\\cos\\theta = m_1 a$$\n\n**隔离 B**（竖直方向，向下为正）：\n$$m_2g - T = m_2 a$$\n\n两式消去 $T$：\n$$a = \\frac{m_2g - m_1g\\sin\\theta - \\mu m_1g\\cos\\theta}{m_1+m_2}$$\n\n结论：**只要斜面上有摩擦，整体法就不能跳过摩擦项。**',
            reasoning:
              '你的思路方向是对的 —— 连接体问题确实可以整体处理。问题出在**整体方程漏了一项**：你写了 B 的重力驱动、A 的重力沿斜面分量阻碍，却漏掉了 A 与斜面之间的滑动摩擦力。\n\n根子不在牛顿第二定律，而在**受力分析**：你没有把 A 单独隔离出来逐一数它的力，所以「漏没漏」这件事就没法自查。而摩擦力之所以格外容易被漏，是因为它是接触力、由接触面状态决定，不像重力那样"天然存在"。',
            evidence: [
              {
                kind: 'node-definition',
                ref: `${COURSE}.dyn.friction`,
                quote:
                  '静摩擦力是被动力，大小随外力变化但有上限；滑动摩擦力方向与相对运动方向相反。',
              },
              {
                kind: 'student-step',
                ref: '2',
                quote: '整体方程里漏掉了斜面摩擦力 μ m₁g cosθ',
              },
              {
                kind: 'node-definition',
                ref: `${COURSE}.dyn.force-analysis`,
                quote:
                  '把研究对象单独隔离出来，逐一画出它受到的所有外力，再在选定方向上列方程。',
              },
            ],
          },
          variants: {
            questions: [
              {
                id: 'v1',
                nodeId: `${COURSE}.dyn.force-analysis`,
                prompt:
                  '一个物块静止在倾角 $\\theta$ 的斜面上，与斜面之间的静摩擦因数为 $\\mu_s$。请**单独画出该物块的受力图**，并写出它受到的静摩擦力大小与方向（用 $m$、$g$、$\\theta$ 表示）。\n\n写完后回答：这里的静摩擦力为什么不能直接用 $\\mu_s N$ 来算？',
                checkpoints: [
                  '受力图包含重力、支持力、静摩擦力三个力',
                  '静摩擦力大小等于 $mg\\sin\\theta$，方向沿斜面向上',
                  '能说明静摩擦力是被动力，只有达到临界状态时才等于 $\\mu_s N$',
                ],
              },
              {
                id: 'v2',
                nodeId: `${COURSE}.dyn.friction`,
                prompt:
                  '把上题改成：物块**正在**沿斜面下滑。请说明此时摩擦力大小与方向各是什么，并解释它与「静止在斜面上」时那一问的答案为什么不同。',
                checkpoints: [
                  '滑动摩擦力大小为 $\\mu m g\\cos\\theta$（注意这里是 $\\mu$ 而非 $\\mu_s$，且带 cosθ）',
                  '方向沿斜面向上，与相对运动方向相反',
                  '能说清「静摩擦随外力变化」与「滑动摩擦由 μN 决定」的本质区别',
                ],
              },
              {
                id: 'v3',
                nodeId: `${COURSE}.dyn.newton2`,
                prompt:
                  '回到原题：若把 $\\mu$ 逐渐增大，系统加速度 $a$ 会怎样变化？请给出 $a = 0$ 的临界条件，并说明这个临界条件对应的物理情景是什么。',
                checkpoints: [
                  '$a$ 随 $\\mu$ 增大而单调减小',
                  '临界条件为 $m_2g = m_1g\\sin\\theta + \\mu m_1g\\cos\\theta$',
                  '能指出此时系统（刚好）保持静止，绳中张力与两边重力平衡',
                ],
              },
            ],
          },
        },
        followups: [
          {
            match: ['整体', '整体法', '为什么不能整体', '连接体'],
            reply:
              '整体法**可以用**，但有一个前提：**你已经知道系统受到的每一个外力。**\n\n整体法的本质是把内力（这里是绳的张力 $T$）消掉。它省的是「消 $T$」这一步，**不是省「数力」这一步**。\n\n所以正确的顺序是：\n\n1. 先隔离 A、B 各自画受力图 —— 这一步用来**查漏**；\n2. 确认没有漏力之后，如果题目只问整体加速度，再合并成一个方程 —— 这一步用来**省事**。\n\n你跳过第 1 步直接做第 2 步，就等于在"不知道有哪些力"的前提下写方程，漏掉摩擦力几乎是必然。',
          },
          {
            match: ['μ', '摩擦', '摩擦力', '为什么要减'],
            reply:
              '因为摩擦力**与 A 沿斜面下滑的运动方向相反**，所以在「沿斜面向下为正」的方向上是阻力、是减项。\n\n$$f = \\mu N = \\mu m_1 g\\cos\\theta$$\n\n注意两处容易错的地方：\n\n- 支持力 $N$ 是 $m_1g\\cos\\theta$，不是 $m_1g$ —— 因为重力垂直于斜面的分量才被斜面接住；\n- 用的是动摩擦因数 $\\mu$，不是静摩擦因数 $\\mu_s$ —— 因为物体在**滑动**。\n\n一个自查办法：把 $\\mu = 0$ 代回去，答案应该退化成光滑斜面的结果。',
          },
          {
            match: ['隔离', '受力图', '隔离体', '怎么画'],
            reply:
              '隔离体法的三步，一步都不能跳：\n\n1. **选定对象**：这一题先选 A。**一次只看一个物体**，这是纪律。\n2. **逐个数力**：按「场力 → 接触力」的顺序过一遍。场力只有重力 $m_1g$；接触力有三处接触 —— 斜面（支撑力 $N$ + 摩擦力 $f$）、绳子（拉力 $T$）、无其他。\n3. **建坐标、定方向**：沿斜面与垂直斜面建两个轴，把不在轴上的力分解。\n\n第 2 步是关键。很多人漏力，是因为凭印象画，而不是按「有哪些接触」逐一清点。**接触点是清单，不是回忆。**',
          },
        ],
        defaultReply:
          '好问题。这一题的核心是：题设给了 $\\mu$，那么 $\\mu$ 必须出现在答案里。你的式子里没有 $\\mu$，说明漏了斜面的滑动摩擦力 $f = \\mu m_1g\\cos\\theta$（方向沿斜面向上）。\n\n补上后在整体方程里就是减项：$m_2g - m_1g\\sin\\theta - \\mu m_1g\\cos\\theta = (m_1+m_2)a$。\n\n想让我讲更细的地方，可以具体问我，比如「为什么 N 是 $m_1g\\cos\\theta$」或者「隔离体到底怎么画」。',
        suggestedFollowups: [
          '为什么不能直接用整体法？',
          '摩擦力为什么要减掉？',
          '隔离体受力图到底怎么画？',
        ],
      },
    },
  ];

  /* ------------------------------------------------------------------ */
  /* 3. 学情画像（可选，但强烈建议带）                                   */
  /* ------------------------------------------------------------------ */

  /*
   * 不带画像会怎样（这是实测出来的，不是推测）：
   * 知树会用中性基线（每个知识点 70 分）填 —— 那是安全的默认值，
   * 但代价是「哪里都没塌」，归因只能停在考点自身。
   * 这道斜面连接体题于是得到「问题就在摩擦力本身 · 波及 0 个 · 错因＝读题失误」。
   * 结论没错，但完全没讲出这道题真正的教学意义。
   *
   * 带上画像后：摩擦力（58）与它的前置受力分析（52）都低于 60，
   * 归因沿依赖链回溯，停在最靠前的失效边界「受力分析与隔离体法」，
   * 因果链变成「受力分析 → 摩擦力」—— 这才是这道题想说的那句话。
   *
   * 注意：画像必须覆盖**所有**节点。缺失的节点会被当成「没掌握」（这是对的行为：
   * 没数据就是没掌握），而不是回退到某个默认分。
   */
  const OVERRIDES = {
    'dyn.force-analysis': 52,
    'dyn.friction': 58,
  };

  const mastery = tree.nodes.map((n) => ({
    nodeId: n.id,
    score: OVERRIDES[n.id.replace(`${COURSE}.`, '')] ?? 74,
    attempts: 1,
    updatedAt: '2026-09-25T00:00:00.000Z',
  }));

  /* ------------------------------------------------------------------ */
  /* 4. 注册                                                            */
  /* ------------------------------------------------------------------ */

  function register() {
    const result = window.KnowTree.registerCourse({
      tree,
      name: '大学物理 · 力学（插件）',
      audience: '理工科 · 大一上',
      description: `知识模块插件示例：4 章 ${tree.nodes.length} 个知识点，自带 1 道演示样例与学情画像。`,
      demoCases,
      mastery,
    });

    if (result.ok) {
      console.log(
        `[物理插件] 已接入《大学物理 · 力学》，共 ${tree.nodes.length} 个知识点。` +
          '请到页面右上角的课程下拉菜单里选择它。',
      );
    } else {
      console.error('[物理插件] 接入失败：' + result.error);
    }
    return result;
  }

  if (window.KnowTree) {
    register();
  } else {
    // 接口要等 React 挂载后才出现，等一次 knowtree:ready 事件再注册。
    window.addEventListener('knowtree:ready', register, { once: true });
    console.log('[物理插件] 等待知树接口就绪……');
  }
})();
