#!/usr/bin/env python3
"""知树 KnowTree 作品介绍 PPT 生成器。

为什么自己写生成器而不用现成工具：
    本机 SlideP 渲染服务（editor_sdk 8 月构建）与 CLI（0.4.4-alpha）版本不匹配，
    /localapi/keyframe 端点缺失导致无法渲染。改用 python-pptx 直接生成，
    完全可控、无外部依赖。

设计依据见同目录 DESIGN.md；叙事结构见 STORY.md。
"""

import os

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Pt

# ---------------------------------------------------------------- 设计常量

W, H = 1280, 720                      # 画布（px）
PX = 9525                             # 1px = 9525 EMU

BG = RGBColor.from_string("FBFAF7")   # 背景（暖白）
PRIMARY = RGBColor.from_string("0F6E56")   # 品牌深绿
LIGHT = RGBColor.from_string("5DCAA5")     # 浅绿
INK = RGBColor.from_string("1A1A1A")       # 文本
PALE = RGBColor.from_string("E1F5EE")      # 极浅绿
DEEP = RGBColor.from_string("04342C")      # 极深绿
ORANGE = RGBColor.from_string("C2410C")    # 强调（赭橙）
GREY = RGBColor.from_string("6B7280")      # 次要文本
WHITE = RGBColor.from_string("FFFFFF")
LINE = RGBColor.from_string("D6D3CB")

FONT_CN = "思源黑体"
FONT_NUM = "Inter"

IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resources", "images")


def px(v):
    return Emu(int(v * PX))


def blank(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = BG
    return slide


def rect(slide, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE,
         line_w=1.0, radius=None):
    s = slide.shapes.add_shape(shape, px(x), px(y), px(w), px(h))
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(line_w)
    s.shadow.inherit = False
    if radius is not None and shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = radius
    return s


def text(slide, x, y, w, h, paras, size=22, color=INK, bold=False,
         align=PP_ALIGN.LEFT, spacing=1.5, font=FONT_CN, anchor=MSO_ANCHOR.TOP,
         space_after=0):
    """paras: str 或 list。list 元素可为 str，或 [(片段, {样式}), ...]。"""
    box = slide.shapes.add_textbox(px(x), px(y), px(w), px(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0

    if isinstance(paras, str):
        paras = [paras]

    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        if space_after:
            p.space_after = Pt(space_after)
        runs = [(para, {})] if isinstance(para, str) else para
        for content, style in runs:
            r = p.add_run()
            r.text = content
            f = r.font
            f.size = Pt(style.get("size", size))
            f.bold = style.get("bold", bold)
            f.color.rgb = style.get("color", color)
            f.name = style.get("font", font)
    return box


def line_h(slide, x, y, w, color=LINE, weight=1.0):
    c = slide.shapes.add_connector(1, px(x), px(y), px(x + w), px(y))
    c.line.color.rgb = color
    c.line.width = Pt(weight)
    return c


def picture(slide, name, x, y, w=None, h=None):
    path = os.path.join(IMG, name)
    kw = {}
    if w:
        kw["width"] = px(w)
    if h:
        kw["height"] = px(h)
    return slide.shapes.add_picture(path, px(x), px(y), **kw)


def footer(slide, num, total=13):
    rect(slide, 0, 660, W, 60, fill=None)
    text(slide, 64, 678, 300, 24, "知树 KnowTree", size=14, color=GREY)
    text(slide, W - 200, 678, 136, 24, f"{num:02d} / {total}", size=14,
         color=GREY, align=PP_ALIGN.RIGHT, font=FONT_NUM)


def page_title(slide, title, sub=None):
    """A 区标题块（0–120px）。

    字号与位置按「中文单字宽 ≈ 字号 px」校准 —— 早期版本用 34pt 时，
    标题实际行高约 59px，会压到 y=88 的副标题上。现改为 30pt + 副标题下移到 96。
    """
    text(slide, 64, 34, 1120, 52, title, size=30, bold=True, color=PRIMARY)
    if sub:
        text(slide, 64, 96, 1120, 24, sub, size=14, color=GREY)
    else:
        line_h(slide, 64, 96, 60, PRIMARY, 3)


def card(slide, x, y, w, h, fill=WHITE, border=LINE, radius=0.06):
    return rect(slide, x, y, w, h, fill=fill, line=border,
                shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=radius)


# ---------------------------------------------------------------- 页面

def p01_cover(prs):
    slide = blank(prs)
    rect(slide, 0, 0, W, H, fill=DEEP)

    # 右侧知识树几何图形
    nodes = [(880, 150, 26), (770, 290, 21), (990, 290, 21),
             (700, 440, 16), (840, 440, 16), (940, 440, 16), (1070, 440, 16)]
    edges = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)]
    for a, b in edges:
        c = slide.shapes.add_connector(1, px(nodes[a][0]), px(nodes[a][1]),
                                       px(nodes[b][0]), px(nodes[b][1]))
        c.line.color.rgb = LIGHT
        c.line.width = Pt(2.5)
    for i, (nx, ny, r) in enumerate(nodes):
        rect(slide, nx - r, ny - r, r * 2, r * 2,
             fill=PALE if i < 3 else LIGHT, shape=MSO_SHAPE.OVAL)
    ring = nodes[0]
    rect(slide, ring[0] - 40, ring[1] - 40, 80, 80, fill=None, line=PALE,
         shape=MSO_SHAPE.OVAL, line_w=1.2)

    text(slide, 92, 150, 600, 30, "K N O W T R E E", size=17, color=LIGHT)
    text(slide, 92, 196, 660, 110, "知树 KnowTree", size=72, bold=True,
         color=WHITE, spacing=1.1)
    rect(slide, 92, 330, 96, 5, fill=LIGHT)
    text(slide, 92, 372, 620, 120,
         [ [("拍下不会的题，不只给答案 ——", {})],
           [("告诉你", {}), ("卡在哪", {"color": LIGHT, "bold": True}),
            ("、", {}), ("为什么卡", {"color": LIGHT, "bold": True}),
            ("、", {}), ("接下来补什么", {"color": LIGHT, "bold": True}),
            ("。", {})] ],
         size=24, color=WHITE, spacing=1.6)
    text(slide, 92, 560, 620, 60,
         ["粤港澳大湾区 AI Coding 创新大赛 · 作品介绍",
          "方向一「AI + 教学管理助手」· 多模态教学智能体"],
         size=15, color=RGBColor.from_string("9CB8AE"), spacing=1.7)


def p02_problem(prs):
    slide = blank(prs)
    page_title(slide, "只给答案，解决不了「反复错」",
               "拍题类产品已经很成熟 —— 但它们解决的不是这个问题")

    left_w = 620
    items = [
        ("现状", "拍照搜题早已成熟，学生能拿到每一道题的完整解答。"),
        ("困境", "可同一类题还是反复错。因为他始终不知道，自己缺的是哪个知识点。"),
        ("被忽略的事实", "知识点之间存在前置依赖 —— 一环断了，下游一整片都会跟着塌。"),
    ]
    y = 186
    for label, body in items:
        rect(slide, 64, y, 4, 92, fill=LIGHT if label != "被忽略的事实" else ORANGE)
        text(slide, 88, y + 2, 120, 26, label, size=15, bold=True,
             color=GREY if label != "被忽略的事实" else ORANGE)
        text(slide, 88, y + 30, left_w - 88, 74, body, size=18, color=INK,
             spacing=1.55)
        y += 124

    card(slide, 700, 170, 516, 340)
    picture(slide, "shot_capture.png", 716, 186, w=484)
    text(slide, 716, 452, 484, 48,
         "首页即入口：点「试这道题」就能走完整条诊断链路", size=14,
         color=GREY, spacing=1.5)

    rect(slide, 700, 540, 516, 76, fill=PALE)
    text(slide, 724, 558, 468, 44,
         "所以真正该回答的不是「这题怎么做」，而是「你到底缺什么」。",
         size=17, bold=True, color=PRIMARY, anchor=MSO_ANCHOR.MIDDLE)
    footer(slide, 2)


def p03_claim(prs):
    slide = blank(prs)
    page_title(slide, "不给答案，给诊断", "五步链路：模型负责读懂与讲清，算法负责判断卡在哪")

    rect(slide, 64, 152, 300, 464, fill=PRIMARY)
    text(slide, 96, 184, 240, 26, "主张", size=14, color=LIGHT)
    text(slide, 96, 224, 240, 56, "不给答案，", size=32, bold=True, color=WHITE)
    text(slide, 96, 288, 240, 56, "给诊断。", size=32, bold=True, color=WHITE)
    rect(slide, 96, 366, 72, 4, fill=LIGHT)
    text(slide, 96, 396, 236, 170,
         ["市面产品输出「解答」，", "知树输出「卡点 + 成因",
          "+ 补救路径」。", "", "输出物的不同，", "决定了它能答什么。"],
         size=14, color=RGBColor.from_string("BFE3D5"), spacing=1.7)

    steps = [
        ("01", "拍题", "拍照 / PDF"),
        ("02", "题目理解", "OCR + 公式"),
        ("03", "定位考点", "挂到知识树"),
        ("04", "卡点归因", "沿依赖链回溯"),
        ("05", "补救复测", "补课与验证"),
    ]
    bx, bw, gap = 404, 148, 10
    for i, (num, name, desc) in enumerate(steps):
        x = bx + i * (bw + gap)
        hi = i == 3
        card(slide, x, 218, bw, 208, fill=PALE if hi else WHITE,
             border=PRIMARY if hi else LINE, radius=0.08)
        text(slide, x + 14, 238, bw - 28, 20, num, size=12, bold=True,
             color=PRIMARY if hi else GREY, font=FONT_NUM)
        text(slide, x + 14, 266, bw - 28, 54, name, size=16, bold=True,
             color=PRIMARY if hi else INK, spacing=1.3)
        text(slide, x + 14, 328, bw - 28, 80, desc, size=12, color=GREY,
             spacing=1.5)
        if i < len(steps) - 1:
            text(slide, x + bw + 1, 306, gap, 24, "›", size=16, color=LIGHT,
                 align=PP_ALIGN.CENTER, bold=True)

    text(slide, 404, 452, 300, 28, "第 4 步由确定性算法完成", size=15,
         bold=True, color=ORANGE)
    text(slide, 404, 492, 780, 124,
         "前两步依赖模型的多模态理解能力，最后两步负责把结论讲明白、把练习安排上。\n"
         "而「他究竟卡在哪」这一判断交给可复现的图算法 —— 这正是知树与普通讲题工具的分界线。",
         size=15, color=INK, spacing=1.75)
    footer(slide, 3)


def p04_attribution(prs):
    slide = blank(prs)
    card(slide, 0, 0, W, 128, fill=WHITE, border=None)
    text(slide, 64, 40, 800, 48, "你卡住的不是这道题", size=34, bold=True,
         color=PRIMARY)
    text(slide, 64, 88, 900, 26,
         "一道「求二叉树第 k 层结点数」的错题，归因指向了更早的一个知识点",
         size=15, color=GREY)

    text(slide, 64, 168, 260, 150, "38", size=104, bold=True, color=ORANGE,
         font=FONT_NUM, spacing=1.0)
    text(slide, 64, 306, 340, 54,
         ["函数调用栈与递归展开", "当前掌握度"], size=13, color=GREY, spacing=1.55)

    chain = [("函数调用栈与递归展开", "38"), ("二叉树遍历", "45"),
             ("树问题的递归分解", "30")]
    cy = 380
    for i, (name, score) in enumerate(chain):
        yy = cy + i * 66
        hi = i == 0
        card(slide, 64, yy, 380, 52, fill=PALE if hi else WHITE,
             border=ORANGE if hi else LINE, radius=0.16)
        text(slide, 84, yy + 14, 240, 26, name, size=17, bold=True,
             color=PRIMARY if hi else INK)
        text(slide, 344, yy + 14, 80, 26, score, size=17, bold=True,
             color=ORANGE if hi else GREY, font=FONT_NUM, align=PP_ALIGN.RIGHT)
        if i < len(chain) - 1:
            text(slide, 232, yy + 52, 40, 14, "↓", size=14, color=LIGHT,
                 align=PP_ALIGN.CENTER, bold=True)

    card(slide, 484, 168, 732, 396, fill=WHITE)
    picture(slide, "shot_diagnosis.png", 500, 184, w=700)

    rect(slide, 484, 588, 732, 76, fill=PALE)
    text(slide, 508, 604, 684, 44,
         "学生以为自己在第 4 章出了问题 —— 其实第 3 章的栈就没通。",
         size=18, bold=True, color=PRIMARY, anchor=MSO_ANCHOR.MIDDLE)
    footer(slide, 4)


def p05_why(prs):
    slide = blank(prs)
    page_title(slide, "为什么这个结论可信", "把「判断」与「表达」分开，是这套设计的地基")

    card(slide, 64, 176, 760, 220, fill=WHITE)
    text(slide, 92, 200, 700, 28, "职责切分", size=15, bold=True, color=GREY)

    rect(slide, 92, 240, 340, 130, fill=PALE)
    text(slide, 116, 262, 292, 26, "模型负责", size=14, color=GREY)
    text(slide, 116, 292, 292, 66, "读懂题 · 讲明白", size=24, bold=True,
         color=PRIMARY, spacing=1.3)

    rect(slide, 460, 240, 336, 130, fill=RGBColor.from_string("FAEEDA"))
    text(slide, 484, 262, 288, 26, "算法负责", size=14, color=GREY)
    text(slide, 484, 292, 288, 66, "判断卡在哪", size=24, bold=True,
         color=ORANGE, spacing=1.3)

    text(slide, 92, 508, 780, 130,
         ["归因结论由确定性图算法给出，模型无权推翻 —— 它只能解释这个结论。",
          "因此同一个学生、同一道题，今天和明天得到的是同一个答案；",
          "换一个模型，判断力也不下降。"],
         size=16, color=INK, spacing=1.75)

    text(slide, 872, 176, 344, 28, "算法的四步", size=15, bold=True, color=GREY)
    algo = [("DAG 环检测", "保证依赖关系自洽"),
            ("前置闭包", "找出通往考点的全部前提"),
            ("失效边界搜索", "定位最早断裂的那一环"),
            ("根源收敛聚类", "把一堆断层归成几个源头")]
    y = 216
    for i, (name, desc) in enumerate(algo):
        rect(slide, 872, y, 344, 84, fill=WHITE, line=LINE)
        text(slide, 896, y + 16, 296, 26, f"{i+1}. {name}", size=17, bold=True,
             color=PRIMARY)
        text(slide, 896, y + 46, 296, 24, desc, size=14, color=GREY)
        y += 96

    rect(slide, 872, 596, 344, 68, fill=RGBColor.from_string("FCEBEB"))
    text(slide, 896, 610, 300, 44,
         ["对照：普通 AI 讲题的归因", "是自由生成，无法验证"],
         size=13.5, color=RGBColor.from_string("A32D2D"), spacing=1.45)
    footer(slide, 5)


def p06_explain(prs):
    slide = blank(prs)
    page_title(slide, "分级讲解，不抢答", "三级分开存，不是排版需要，是教学需要")

    card(slide, 64, 176, 700, 400, fill=WHITE)
    picture(slide, "shot_explain.png", 80, 192, w=668)

    x = 800
    text(slide, x, 176, 416, 28, "三级解锁", size=15, bold=True, color=GREY)
    levels = [("第 1 级", "引导提示", "只给方向和一个反问，不给做法", LIGHT),
              ("第 2 级", "步骤详解", "讲清方法，但仍不给最终结果", PRIMARY),
              ("第 3 级", "完整答案", "给出完整推导与结果", ORANGE)]
    y = 216
    for tag, name, desc, col in levels:
        rect(slide, x, y, 4, 92, fill=col)
        text(slide, x + 22, y + 2, 200, 24, tag, size=14, bold=True, color=col)
        text(slide, x + 22, y + 28, 380, 28, name, size=20, bold=True,
             color=INK)
        text(slide, x + 22, y + 60, 380, 24, desc, size=14, color=GREY)
        y += 108

    rect(slide, 800, 552, 416, 92, fill=PALE)
    text(slide, 824, 568, 368, 62,
         "如果提示和答案同屏出现，学生只会看答案 —— 所以数据结构上就分开。",
         size=15, color=PRIMARY, spacing=1.55)
    footer(slide, 6)


def p07_converge(prs):
    slide = blank(prs)
    page_title(slide, "13 个洞，其实只是 4 个", "把全树断层按真正的源头聚类之后")

    text(slide, 64, 170, 200, 130, "13", size=104, bold=True, color=GREY,
         font=FONT_NUM, spacing=1.0)
    text(slide, 64, 312, 220, 28, "个断层", size=17, color=GREY)

    text(slide, 244, 200, 120, 90, "→", size=64, bold=True, color=LIGHT,
         align=PP_ALIGN.CENTER)

    text(slide, 358, 170, 200, 130, "4", size=104, bold=True, color=ORANGE,
         font=FONT_NUM, spacing=1.0)
    text(slide, 358, 312, 220, 28, "个源头", size=17, bold=True, color=ORANGE)

    card(slide, 560, 168, 656, 388, fill=WHITE)
    text(slide, 588, 192, 600, 28, "最大源头：函数调用栈与递归展开（38 分）",
         size=17, bold=True, color=PRIMARY)
    text(slide, 588, 228, 600, 50,
         "一次修复，连带拖垮的下游 8 个知识点会一起恢复：", size=15,
         color=GREY)
    names = ["二叉树遍历", "树问题的递归分解", "层序遍历", "线索二叉树",
             "二叉排序树", "平衡二叉树 AVL", "深度优先遍历 DFS", "拓扑排序与关键路径"]
    for i, n in enumerate(names):
        cx = 588 + (i % 2) * 310
        cy = 282 + (i // 2) * 46
        rect(slide, cx, cy, 290, 34, fill=PALE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
             radius=0.24)
        text(slide, cx + 14, cy + 6, 262, 22, n, size=14, color=PRIMARY)

    text(slide, 588, 484, 600, 56,
         "这正是知树最想告诉学生的一句话：不是你不行，是你有 4 个洞 —— 先补最大的那个。",
         size=15, color=INK, spacing=1.5)
    footer(slide, 7)


def p08_tree(prs):
    slide = blank(prs)
    page_title(slide, "知识树是人工校对出来的",
               "归因可信度的地基，也是本项目最大的一笔工程投入")

    # 截图按原始比例缩放（shot_tree 为 1258×566 ≈ 2.222:1）。
    # 早期版本只给宽度 1120 → 高度算出 504px，直接把下方卡片盖住了。
    picture(slide, "shot_tree.png", 254, 144, w=772)
    text(slide, 254, 496, 772, 22, "知识树 SVG 实拍：章节分列 · 掌握度着色 · 断层源头红环",
         size=12, color=GREY, align=PP_ALIGN.CENTER)

    y = 530
    courses = [
        ("数据结构", "严蔚敏体系", "7 章 · 38 点 · 57 边", "授课教师已确认\n符合教学实际"),
        ("高等数学", "同济第七版", "12 章 · 67 点 · 118 边", "含曲线曲面积分\n三大公式"),
        ("线性代数", "同济第六版", "5 章 · 25 点 · 32 边", "行列式到二次型\n五章全覆盖"),
        ("概率论与数理统计", "浙大第四版", "8 章 · 32 点 · 43 边", "事件概率到\n统计推断八章"),
    ]
    for i, (name, book, stat, note) in enumerate(courses):
        x = 64 + i * 288
        rect(slide, x, y, 264, 118, fill=PALE if i == 0 else WHITE,
             line=PRIMARY if i == 0 else LINE)
        text(slide, x + 18, y + 12, 230, 26, name, size=16, bold=True,
             color=PRIMARY)
        text(slide, x + 18, y + 40, 230, 20, book, size=11.5, color=GREY)
        text(slide, x + 18, y + 62, 230, 22, stat, size=13, bold=True, color=INK)
        text(slide, x + 18, y + 84, 230, 32, note, size=10.5, color=GREY,
             spacing=1.3)
    footer(slide, 8)


def p09_teacher(prs):
    slide = blank(prs)
    page_title(slide, "这节课该讲什么", "作品落在「教学管理」方向而非纯学生工具的关键一页")

    rect(slide, 64, 176, 4, 100, fill=ORANGE)
    text(slide, 88, 178, 300, 100,
         "教师端把全班的断层按源头聚类，直接回答问题：下节课该从哪儿讲起。",
         size=19, color=INK, spacing=1.6)

    bullets = ["补一个源头，连带修复一片 —— 这是备课的杠杆点",
               "章节热力图指出问题集中在哪一章",
               "「单点严重」标记防止低分缺口被遗漏"]
    y = 300
    for b in bullets:
        rect(slide, 88, y + 8, 6, 6, fill=LIGHT, shape=MSO_SHAPE.OVAL)
        text(slide, 108, y, 330, 50, b, size=15, color=GREY, spacing=1.5)
        y += 56

    card(slide, 470, 172, 746, 420, fill=WHITE)
    picture(slide, "shot_teacher.png", 486, 188, w=714)
    footer(slide, 9)


def p10_dual(prs):
    slide = blank(prs)
    page_title(slide, "两种形态，同一套算法",
               "网页版看全局，智能体版直接追问 —— 结论完全一致")

    cards = [
        ("网页版", "可视化与全局视角",
         ["知识树 DAG 图：四门课共 162 个知识点一目了然",
          "学情雷达图与薄弱点 Top5",
          "错题本间隔重做（1 / 3 / 7 / 16 / 35 天）",
          "教师端班级卡点热力图"],
         "打开链接即可体验，演示模式无需任何配置"),
        ("LearnBuddy 智能体", "对话式诊断与追问",
         ["直接问「这道题我卡在哪」",
          "归因引擎以算法等价实现打包在内",
          "读取同一份知识树数据",
          "支持多轮追问，公式实时渲染"],
         "两版归因结论经实测逐项吻合"),
    ]
    for i, (title, sub, items, note) in enumerate(cards):
        x = 64 + i * 588
        card(slide, x, 180, 564, 400, fill=WHITE)
        rect(slide, x, 180, 564, 6, fill=PRIMARY if i == 0 else ORANGE)
        text(slide, x + 32, 212, 500, 34, title, size=25, bold=True,
             color=PRIMARY if i == 0 else ORANGE)
        text(slide, x + 32, 254, 500, 26, sub, size=15, color=GREY)
        y = 302
        for it in items:
            rect(slide, x + 34, y + 9, 6, 6, fill=LIGHT, shape=MSO_SHAPE.OVAL)
            text(slide, x + 54, y, 480, 30, it, size=15, color=INK)
            y += 42
        rect(slide, x + 32, 500, 500, 56, fill=PALE)
        text(slide, x + 48, 514, 468, 32, note, size=14, color=PRIMARY,
             anchor=MSO_ANCHOR.MIDDLE)
    footer(slide, 10)


def p11_engineering(prs):
    slide = blank(prs)
    page_title(slide, "工程严谨，边界诚实", "能被验证的部分做到可复现；没做完的部分如实说明")

    card(slide, 64, 176, 668, 388, fill=WHITE)
    text(slide, 92, 200, 600, 28, "工程严谨", size=19, bold=True, color=PRIMARY)
    rig = [("带断言的领域层验证脚本", "知识树一旦改动就复跑，退出码非零即失败"),
           ("端到端实测", "四门课的诊断链路、章节排序、渲染节点数逐项核对"),
           ("构建产物哈希比对", "线上与本地一致才算部署成功"),
           ("算法双实现互证", "网页版与智能体版结论逐项吻合")]
    y = 248
    for name, desc in rig:
        rect(slide, 92, y, 612, 68, fill=PALE)
        text(slide, 112, y + 12, 570, 24, name, size=16, bold=True, color=PRIMARY)
        text(slide, 112, y + 38, 570, 22, desc, size=13.5, color=GREY)
        y += 78

    card(slide, 760, 176, 456, 388, fill=WHITE, border=RGBColor.from_string("F0C9A8"))
    text(slide, 788, 200, 400, 28, "当前边界", size=19, bold=True, color=ORANGE)
    bounds = ["完整建模四门课，共 162 个知识点",
              "演示模式下只回放内置样例（线代/概率论样例在途）",
              "复测为自评制，不是自动判分",
              "教师端为演示数据，未接真实班级",
              "暂无移动端适配"]
    y = 248
    for b in bounds:
        rect(slide, 788, y + 10, 6, 6, fill=ORANGE, shape=MSO_SHAPE.OVAL)
        text(slide, 806, y, 390, 44, b, size=14, color=INK, spacing=1.45)
        y += 50

    text(slide, 64, 588, 1152, 56,
         "把没做完的部分写清楚，比把它们藏起来更可信 —— 这也是评委能快速判断项目真实状态的方式。",
         size=15, color=GREY, spacing=1.6)
    footer(slide, 11)


def p12_team(prs):
    slide = blank(prs)
    page_title(slide, "团队与分工")

    rect(slide, 64, 176, 300, 400, fill=PRIMARY)
    text(slide, 96, 216, 240, 60, "协作方式", size=15, color=LIGHT)
    text(slide, 96, 254, 240, 200,
         "队长负责方向、\n选题与验收；\nAI 作为技术搭档\n承担实现与验证。",
         size=19, bold=True, color=WHITE, spacing=1.7)
    text(slide, 96, 486, 240, 70,
         "全过程在 LearnBuddy 留痕，\n决策、返工与踩坑都有记录。",
         size=13.5, color=RGBColor.from_string("BFE3D5"), spacing=1.6)

    card(slide, 396, 176, 820, 400, fill=WHITE)
    text(slide, 428, 204, 700, 28, "团队成员", size=19, bold=True, color=PRIMARY)
    line_h(slide, 428, 246, 756, LINE)

    members = [
        ("队长", "项目负责人", "选题定方向、课程知识树校对、需求验收与最终提交"),
        ("成员", "（待补充）", "（请补充姓名与所负责的部分）"),
    ]
    y = 274
    for name, role, duty in members:
        rect(slide, 428, y, 756, 92, fill=PALE)
        text(slide, 452, y + 16, 200, 28, name, size=18, bold=True, color=PRIMARY)
        text(slide, 452, y + 50, 200, 24, role, size=14, color=GREY)
        text(slide, 660, y + 30, 500, 46, duty, size=15, color=INK, spacing=1.5)
        y += 108

    text(slide, 428, 494, 756, 60,
         "加分项说明：若队伍含 2 个及以上专业，可在本页补充专业构成（跨专业组队可加分）。",
         size=13.5, color=GREY, spacing=1.5)
    footer(slide, 12)


def p13_end(prs):
    slide = blank(prs)
    rect(slide, 0, 0, W, H, fill=DEEP)

    nodes = [(640, 130, 22), (540, 250, 17), (740, 250, 17),
             (480, 370, 13), (600, 370, 13), (680, 370, 13), (800, 370, 13)]
    edges = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)]
    for a, b in edges:
        c = slide.shapes.add_connector(1, px(nodes[a][0]), px(nodes[a][1]),
                                       px(nodes[b][0]), px(nodes[b][1]))
        c.line.color.rgb = RGBColor.from_string("1D7A61")
        c.line.width = Pt(2)
    for nx, ny, r in nodes:
        rect(slide, nx - r, ny - r, r * 2, r * 2, fill=RGBColor.from_string("1D7A61"),
             shape=MSO_SHAPE.OVAL)

    text(slide, 140, 414, 1000, 110, "不给答案，给诊断", size=60, bold=True,
         color=WHITE, align=PP_ALIGN.CENTER, spacing=1.2)
    rect(slide, 574, 550, 132, 4, fill=LIGHT)

    text(slide, 140, 576, 1000, 26, "体验入口", size=13, color=LIGHT,
         align=PP_ALIGN.CENTER)
    text(slide, 140, 606, 1000, 32,
         "https://7bb960eb955946b7a7dd531e14296d27.app.workbuddy.host",
         size=15, color=WHITE, align=PP_ALIGN.CENTER, font=FONT_NUM)
    text(slide, 140, 648, 1000, 26,
         "智能体入口：LearnBuddy 专家中心 → 我的专家 → 知树",
         size=13, color=RGBColor.from_string("9CB8AE"), align=PP_ALIGN.CENTER)


# ---------------------------------------------------------------- 主流程

def main():
    prs = Presentation()
    prs.slide_width = px(W)
    prs.slide_height = px(H)

    builders = [p01_cover, p02_problem, p03_claim, p04_attribution, p05_why,
                p06_explain, p07_converge, p08_tree, p09_teacher, p10_dual,
                p11_engineering, p12_team, p13_end]
    for fn in builders:
        fn(prs)

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deck.pptx")
    prs.save(out)
    print(f"已生成：{out}")
    print(f"  共 {len(prs.slides)} 页，{os.path.getsize(out)/1024:.0f} KB")


if __name__ == "__main__":
    main()
