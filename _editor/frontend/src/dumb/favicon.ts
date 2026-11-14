import { useEffect, useRef } from 'react';
import { withoutFrontmatter } from './frontmatter';

/** One row of a doc's minimap: what the line is, and how far across the page it runs (0–1). */
export type Row = { kind: 'heading' | 'text' | 'code' | 'figure' | 'gap'; width: number };

const COLS = 60; // characters to a full-width row
const MAX_ROWS = 14; // more than ever fits, so a long line can't starve the rest

/** The first rows of `source` as a heuristic minimap: headings, wrapped text, code, figures (images, viz blocks). */
export function minimap(source: string, lang: 'markdown' | 'typst'): Row[] {
  const rows: Row[] = [];
  const push = (row: Row) => {
    if (row.kind === 'gap' && (!rows.length || rows.at(-1)!.kind === 'gap')) return;
    rows.push(row);
  };
  const text = lang === 'markdown' ? withoutFrontmatter(source) : source;
  let fence: string | null = null; // the open fence's info string
  let fenceLines = 0;
  for (const raw of text.split('\n')) {
    if (rows.length >= MAX_ROWS) break;
    const line = raw.trim();
    const fenceMatch = lang === 'markdown' && /^(`{3,}|~{3,})\s*(\S*)/.exec(line);
    if (fence !== null) {
      if (fenceMatch) { fence = null; continue; }
      // a viz is one figure however long its spec; code shows its first few lines
      if (fence !== 'thea' && fenceLines++ < 4) push({ kind: 'code', width: span(raw) });
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[2];
      fenceLines = 0;
      if (fence === 'thea') push({ kind: 'figure', width: 1 });
      continue;
    }
    if (!line) { push({ kind: 'gap', width: 0 }); continue; }
    if (lang === 'typst' && /^#(set|show|import|include|let)\b/.test(line)) continue; // preamble, not content
    const heading = lang === 'markdown' ? /^#{1,6}\s+(.*)/.exec(line) : /^=+\s+(.*)/.exec(line);
    if (heading) { push({ kind: 'heading', width: Math.min(1, 0.15 + heading[1].length / 30) }); continue; }
    if (lang === 'markdown' ? line.startsWith('![') : /^#(image|figure)\(/.test(line)) { push({ kind: 'figure', width: 1 }); continue; }
    if (/^(---+|\*\*\*+|___+)$/.test(line)) { push({ kind: 'gap', width: 0 }); continue; }
    // a paragraph line wraps into full rows, then a partial one
    const indent = /^\s*([-*+]|\d+\.)\s/.test(raw) ? 4 : 0;
    let left = Math.max(1, line.length + indent);
    while (left > 0 && rows.length < MAX_ROWS) {
      push({ kind: 'text', width: Math.min(1, left / COLS) });
      left -= COLS;
    }
  }
  while (rows.at(-1)?.kind === 'gap') rows.pop();
  return rows;
}

const span = (line: string) => Math.min(1, Math.max(0.1, line.trimEnd().length / COLS));

const SIZE = 64; // drawn at 2x for hidpi tab bars
const PAD = 7;
const HEIGHT: Record<Row['kind'], number> = { heading: 6, text: 3, code: 3, figure: 12, gap: 2 };

/** A page with `rows` drawn on it, as a PNG data URL; null without a canvas. */
export function drawFavicon(rows: Row[]): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // the page: white with a dark edge, so it reads on light and dark tab bars alike
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(4.5, 1.5, SIZE - 9, SIZE - 3, 6);
  ctx.fill();
  ctx.stroke();
  const inner = SIZE - 2 * PAD - 4;
  let y = PAD;
  for (const row of rows) {
    const h = HEIGHT[row.kind];
    if (y + h > SIZE - PAD) break;
    if (row.kind !== 'gap') {
      ctx.fillStyle = { heading: '#18181b', text: '#a1a1aa', code: '#0d9488', figure: '#f59e0b' }[row.kind];
      const w = Math.max(4, Math.round(row.width * inner));
      if (row.kind === 'figure') {
        ctx.beginPath();
        ctx.roundRect(PAD + 2, y, w, h, 2);
        ctx.fill();
      } else ctx.fillRect(PAD + 2 + (row.kind === 'code' ? 3 : 0), y, Math.min(w, inner - (row.kind === 'code' ? 3 : 0)), h);
    }
    y += h + 2;
  }
  return canvas.toDataURL('image/png');
}

/**
 * Points the tab's icon at `href`. Firefox may ignore an icon link's `href` changing in place, and keeps a
 * removed link's icon showing, so each change appends a fresh link (in the document before its `href` is
 * set) and then drops the old ones.
 */
function setFavicon(href: string | null) {
  if (!href) return;
  const old = document.querySelectorAll('link[rel~="icon"]');
  if (old.length === 1 && (old[0] as HTMLLinkElement).href === href) return;
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  document.head.append(link);
  link.href = href;
  old.forEach((l) => l.remove());
}

/** Shows a minimap of `source` as the tab's icon, redrawn once typing pauses; a blank page once the editor goes. */
export function useDocFavicon(source: string, lang: 'markdown' | 'typst', delayMs = 1500) {
  const drawn = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      drawn.current = true;
      setFavicon(drawFavicon(minimap(source, lang)));
    }, drawn.current ? delayMs : 0);
    return () => clearTimeout(t);
  }, [source, lang, delayMs]);
  // removing the link wouldn't clear the icon in Firefox, so the last doc's preview would stay
  useEffect(() => () => setFavicon(drawFavicon([])), []);
}
