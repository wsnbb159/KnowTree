#!/usr/bin/env python3
"""生成知树专家头像（纯标准库实现，无第三方依赖）。

为什么不用图像生成模型：
    头像只是一个 512×512 的卡片图标，用几何图形表达「知识树」这个概念
    反而比生成式图像更准确、更可控，也不消耗额度。

图形含义：
    深绿圆底 = 课程知识树这棵「树」
    白色节点与连线 = 知识点与它的前置依赖边
    三层结构 = 前置依赖的层级关系（根 → 中层 → 下游）

用法：python scripts/make-expert-avatar.py [输出路径]
"""

import os
import struct
import sys
import zlib

SIZE = 512
BG = (243, 247, 245)
DISC = (15, 110, 86)
INK = (255, 255, 255)

# (x, y, 半径) —— 一棵三层二叉树，居于圆内
NODES = [
    (256, 134, 27),
    (166, 228, 22),
    (346, 228, 22),
    (106, 332, 17),
    (216, 332, 17),
    (296, 332, 17),
    (406, 332, 17),
]
EDGES = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)]


def blend(buf, x, y, color, alpha):
    if not (0 <= x < SIZE and 0 <= y < SIZE) or alpha <= 0:
        return
    if alpha >= 1:
        buf[y][x] = color
        return
    old = buf[y][x]
    buf[y][x] = tuple(int(old[i] + (color[i] - old[i]) * alpha) for i in range(3))


def fill_disc(buf, cx, cy, r, color):
    """画实心圆，边缘做 1px 抗锯齿。"""
    y0, y1 = max(0, cy - r - 1), min(SIZE, cy + r + 2)
    x0, x1 = max(0, cx - r - 1), min(SIZE, cx + r + 2)
    for y in range(y0, y1):
        for x in range(x0, x1):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= r - 0.5:
                buf[y][x] = color
            elif d < r + 0.5:
                blend(buf, x, y, color, r + 0.5 - d)


def draw_edge(buf, p, q, width):
    """用密集圆点铺一条有宽度的线。"""
    (x0, y0), (x1, y1) = p, q
    steps = int(max(abs(x1 - x0), abs(y1 - y0))) * 2 + 1
    for i in range(steps + 1):
        t = i / steps
        fill_disc(buf, int(round(x0 + (x1 - x0) * t)),
                  int(round(y0 + (y1 - y0) * t)), width, INK)


def build():
    buf = [[BG for _ in range(SIZE)] for _ in range(SIZE)]
    fill_disc(buf, 256, 256, 233, DISC)

    centers = [(x, y) for x, y, _ in NODES]
    for a, b in EDGES:
        draw_edge(buf, centers[a], centers[b], 5)
    for x, y, r in NODES:
        fill_disc(buf, x, y, r, INK)
    return buf


def write_png(path, buf):
    raw = bytearray()
    for row in buf:
        raw.append(0)
        for px in row:
            raw.extend(px)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(png)
    return len(png)


if __name__ == "__main__":
    default = os.path.join(
        os.path.expanduser("~"), ".learnbuddy", "plugins", "marketplaces",
        "my-experts", "plugins", "knowtree", "avatars", "knowtree.png",
    )
    out = sys.argv[1] if len(sys.argv) > 1 else default
    size = write_png(out, build())
    print(f"已生成头像：{out}（{size / 1024:.1f} KB，{SIZE}×{SIZE}）")
