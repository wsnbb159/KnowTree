import type { Course, CourseId, KnowledgeTree } from '@/domain/types';
import { dataStructureTree } from './data-structure';
import { calculusTree } from './calculus';

/**
 * 课程注册表。
 *
 * 《数据结构》与《高等数学》已完成建模，线代与概率论保留入口但标注为规划中 ——
 * 与其把四门课都做成半成品，不如把两门课做到能被当众验证。
 * 这个取舍会在作品介绍里如实说明。
 */
export const courses: Course[] = [
  {
    id: 'data-structure',
    name: '数据结构',
    audience: '计算机类 · 大二上',
    description: '已完整建模：7 章 38 个知识点，含跨章节的隐式前置依赖。',
  },
  {
    id: 'calculus',
    name: '高等数学',
    audience: '理工科 · 大一',
    description: '已完整建模：12 章 62 个知识点，含跨模块的隐式前置依赖（第 8 章贯通多元微分与曲面积分、第 11 章三大公式串起曲线/曲面/重积分）。',
  },
  {
    id: 'linear-algebra',
    name: '线性代数',
    audience: '理工科 · 大一',
    description: '规划中：矩阵运算、向量空间、特征值三大模块。',
  },
  {
    id: 'probability',
    name: '概率论与数理统计',
    audience: '理工科 · 大二',
    description: '规划中：随机变量、分布、参数估计与假设检验。',
  },
];

const trees: Partial<Record<CourseId, KnowledgeTree>> = {
  'data-structure': dataStructureTree,
  calculus: calculusTree,
};

export function getCourse(courseId: CourseId): Course | undefined {
  return courses.find((course) => course.id === courseId);
}

export function getTree(courseId: CourseId): KnowledgeTree | undefined {
  return trees[courseId];
}

export function isCourseReady(courseId: CourseId): boolean {
  return trees[courseId] !== undefined;
}

export const readyCourses = courses.filter((course) => isCourseReady(course.id));
