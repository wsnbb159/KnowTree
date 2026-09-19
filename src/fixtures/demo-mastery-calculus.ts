/**
 * 《高等数学》演示掌握度画像。
 *
 * 刻意构造出一条**跨模块的断层链**，这是高数不同于数据结构的地方：
 *
 *   第 5 章「定积分换元」失守（42 分）
 *     → 第 7 章「极坐标变换」跟着塌（因为 Jacobi 因子本质就是换元）
 *       → 第 7 章「二重积分」整体偏低
 *
 * 同时让第 1、2 章基础健康 —— 说明这个学生不是「不用功」，
 * 而是某一个方法没建立起来，导致整条下游链条受损。
 *
 * 这与《数据结构》那份画像（栈失守导致树塌方）是同一类命题在不同课程上的体现。
 *
 * 分数约定：< 60 判定为断层，60–74 薄弱，75–89 基本掌握，>= 90 扎实。
 */

import type { MasteryRecord } from '@/domain/types';

const AT = '2026-09-19T20:10:00+08:00';

function m(nodeId: string, score: number, attempts: number): MasteryRecord {
  return { nodeId, score, attempts, updatedAt: AT };
}

export const calculusMastery: MasteryRecord[] = [
  /* 第1章 函数与极限：基础扎实 */
  m('calc.func.concept', 91, 5),
  m('calc.limit.concept', 84, 8),
  m('calc.limit.infinitesimal', 72, 6),
  m('calc.limit.rules', 68, 9),
  m('calc.limit.methods', 70, 7),
  // 62 分：薄弱，但**刻意不设成断层**（阈值 60）。
  // 理由：一旦它成了断层，归因会一路顶到第 1 章「连续性」，
  // 结论变成「你卡在连续性」—— 链条过长且对学生没有指导价值。
  // 把断层收敛到第 5 章「定积分换元」，故事才聚焦、才可行动。
  m('calc.continuous.concept', 62, 6),
  m('calc.continuous.closed', 66, 4),

  /* 第2章 导数与微分：求导这一手是最熟的 */
  m('calc.deriv.definition', 86, 7),
  m('calc.deriv.rules', 90, 12),
  m('calc.deriv.higher', 74, 8),
  m('calc.deriv.differential', 76, 5),

  /* 第3章 中值定理与导数应用：能用，但中值定理本身偏弱 */
  m('calc.deriv.mean', 62, 6),
  m('calc.deriv.lhopital', 75, 10),
  m('calc.deriv.monotone', 72, 9),
  m('calc.deriv.concavity', 68, 5),

  /* 第4章 不定积分：三项都是基本功，练得不少但仍然漏 C */
  m('calc.integral.antiderivative', 74, 11),
  m('calc.integral.substitution', 70, 10),
  m('calc.integral.byparts', 66, 8),

  /* 第5章 定积分：这里是断层的起点 */
  m('calc.integral.definite', 72, 7),
  m('calc.integral.newton', 76, 9),
  m('calc.integral.substitution-def', 42, 6), // ← 唯一的源头：换元时微元不跟着换
  m('calc.integral.improper', 55, 3),
  m('calc.integral.geometry', 60, 4),

  /* 第9章 多元微分：概念层还行，需要画路径的链式法则就崩 */
  m('calc.multivar.concept', 70, 4),
  m('calc.multivar.partial', 68, 8),
  m('calc.multivar.total', 54, 3), // ← 偏弱：可微与可偏导的关系记不清
  m('calc.multivar.chain', 50, 5), // ← 偏弱：复合路径漏项
  m('calc.multivar.extremum', 48, 4), // ← 偏弱：判别式与乘数法

  /* 第10章 重积分：因第5章换元失守而连带塌方 */
  m('calc.multint.definite', 66, 5),
  m('calc.multint.iteration', 58, 7),
  m('calc.multint.symmetry', 52, 4), // ← 对称性不会用，导致硬算犯错
  m('calc.multint.polar', 44, 6), // ← 直接受换元法牵连

  /* 第7章 微分方程：整体健康 —— 再次证明问题不是「全面学不好」 */
  m('calc.ode.concept', 76, 5),
  m('calc.ode.separable', 72, 8),
  m('calc.ode.homogeneous', 68, 6),
  m('calc.ode.firstlinear', 64, 7),
  m('calc.ode.reducible', 70, 4),
  m('calc.ode.secondlinear', 58, 5), // ← 特征方程是公认难点，这里确实没吃透

  /* 第10章 三重积分：极坐标的下游，必然被牵连 */
  m('calc.triple.concept', 64, 4),
  m('calc.triple.cartesian', 56, 6), // ← 空间区域定限不过关
  m('calc.triple.cylindrical', 46, 4), // ← 同一个 Jacobi 因子问题再次发生
  m('calc.triple.spherical', 42, 3), // ← 链条末端
  m('calc.triple.application', 60, 3),

  /* 第12章 无穷级数：中间的审敛法失守，后面整片跟着塌 */
  m('calc.series.concept', 68, 5),
  m('calc.series.positive', 58, 8), // ← 级数模块的源头
  m('calc.series.alternating', 62, 4),
  m('calc.series.power', 54, 6),
  m('calc.series.taylor', 50, 5),
  m('calc.series.fourier', 48, 3),
];
