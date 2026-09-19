/**
 * 合成「习题册照片」的工具。
 *
 * 演示模式下不能让评委去看一张空白的题目图 —— 那看不出学生到底错在哪。
 * 因此这里用 SVG 合成一张带手写痕迹的习题册页面，
 * 好处是完全不依赖外部图片资源，构建产物里也不多一个二进制文件。
 */

const FONT_STACK =
  "'Segoe UI', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";

export interface PhotoLine {
  text: string;
  /** print 为印刷体题目，hand 为蓝色手写痕迹 */
  kind: 'print' | 'hand';
  indent?: number;
}

export function notebookPhoto(caption: string, lines: PhotoLine[]): string {
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
  <text x="56" y="72" font-family="${FONT_STACK}" font-size="13" fill="#8a8579">${escapeXml(caption)}</text>
  ${rows}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
