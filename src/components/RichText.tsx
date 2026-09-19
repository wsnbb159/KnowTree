/**
 * 富文本渲染：Markdown + KaTeX 公式。
 *
 * F6 要求公式正确渲染，这对工科场景不是锦上添花 ——
 * 「$k-1$ 与 $k-2$ 的区别」用纯文本讲，学生根本看不出差别。
 *
 * 安全处理：模型输出属于不可信内容，因此在注入前先做一次清理，
 * 剥掉脚本、事件属性与 javascript: 协议，再注入本地生成的可信公式 HTML。
 */

import { useMemo } from 'react';
import katex from 'katex';
import { marked } from 'marked';
import 'katex/dist/katex.min.css';

const TOKEN = (index: number) => `%%KT${index}%%`;
const TOKEN_PATTERN = /%%KT(\d+)%%/g;

const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'form',
  'base',
]);

marked.setOptions({ gfm: true, breaks: true });

function renderFormula(expression: string, displayMode: boolean, sink: string[]): string {
  try {
    sink.push(
      katex.renderToString(expression, {
        displayMode,
        throwOnError: false,
        output: 'html',
        strict: false,
      }),
    );
    return TOKEN(sink.length - 1);
  } catch {
    // 公式写坏时退化成原文，不能让整段讲解渲染失败
    sink.push(expression);
    return TOKEN(sink.length - 1);
  }
}

function sanitize(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;

  const walk = (element: Element): void => {
    for (const child of Array.from(element.children)) {
      const tag = child.tagName.toLowerCase();
      if (BLOCKED_TAGS.has(tag)) {
        child.remove();
        continue;
      }
      for (const attribute of Array.from(child.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith('on')) {
          child.removeAttribute(attribute.name);
          continue;
        }
        if (
          (name === 'href' || name === 'src') &&
          /^\s*(javascript|data:text\/html):/i.test(attribute.value)
        ) {
          child.removeAttribute(attribute.name);
        }
      }
      walk(child);
    }
  };

  if (root) walk(root);
  return root ? root.innerHTML : '';
}

export function renderRich(source: string): string {
  const sink: string[] = [];
  let text = source.replace(/\r\n/g, '\n');

  // 先处理块级公式，再处理行内公式，避免 $$ 被行内规则截断
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expression: string) =>
    renderFormula(expression.trim(), true, sink),
  );
  text = text.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_, expression: string) =>
    renderFormula(expression.trim(), false, sink),
  );

  const markdownHtml = marked.parse(text, { async: false }) as string;
  const safeHtml = sanitize(markdownHtml);
  return safeHtml.replace(TOKEN_PATTERN, (_, index: string) => sink[Number(index)] ?? '');
}

interface RichTextProps {
  text: string;
  className?: string;
}

export function RichText({ text, className }: RichTextProps) {
  const html = useMemo(() => renderRich(text), [text]);
  return (
    <div
      className={`kt-prose ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
