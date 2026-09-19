/**
 * 多模态输入的图像工具。
 *
 * 三个职责，都是纯前端现实约束倒逼出来的：
 * 1. 大图先压到 1280px 再送模型 —— 手机随手一拍 4000×3000，
 *    不压缩的话既慢又容易超过模型请求体上限；
 * 2. localStorage 只有 5MB，诊断记录里只存缩略图，不存原图；
 * 3. PDF 在浏览器里渲染成页面图，让 PDF 和拍照走同一条链路。
 */

const MAX_MODEL_EDGE = 1280;
const THUMB_EDGE = 480;

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`无法读取文件 ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解码失败，请换一张或改用截图'));
    image.src = src;
  });
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function looksLikePdf(file: File): boolean {
  return isPdf(file);
}

/** 缩放到最长边不超过 maxEdge，JPEG 重编码。SVG（演示样例）原样返回 */
export async function downscaleDataUrl(
  dataUrl: string,
  maxEdge: number,
  quality = 0.85,
): Promise<string> {
  if (dataUrl.startsWith('data:image/svg')) return dataUrl;
  const image = await loadImage(dataUrl);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (longest <= maxEdge) return dataUrl;

  const ratio = maxEdge / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) return dataUrl;
  context.fillStyle = '#ffffff'; // PNG 透明底压成白底，习题册照片更接近真实观感
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** 送模型前统一走这一步 */
export function prepareForModel(dataUrl: string): Promise<string> {
  return downscaleDataUrl(dataUrl, MAX_MODEL_EDGE);
}

/** 持久化用的缩略图；任何失败都静默降级为「不存图」，不能影响诊断主流程 */
export async function makeThumbnail(dataUrl: string): Promise<string | undefined> {
  try {
    return await downscaleDataUrl(dataUrl, THUMB_EDGE, 0.72);
  } catch {
    return undefined;
  }
}

/**
 * 把 PDF 每页渲染成图片。pdfjs 采用动态导入：
 * 不用 PDF 的用户（大多数演示场景）完全不为它付出加载成本。
 */
export async function pdfToPageImages(
  file: File,
  maxPages = 5,
): Promise<{ pageNumber: number; dataUrl: string }[]> {
  const pdfjs = await import('pdfjs-dist');
  // Vite 打包约定：worker 用 new URL(...) 让构建器接管，避免运行时找 404 的假 worker
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: { pageNumber: number; dataUrl: string }[] = [];
  const count = Math.min(doc.numPages, maxPages);
  for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, Math.max(1, 1100 / baseViewport.width));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) continue;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    pages.push({ pageNumber, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
  }

  if (pages.length === 0) throw new Error('这个 PDF 没有渲染出任何页面');
  return pages;
}
