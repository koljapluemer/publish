import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { chunked } from './markdown';
import type { DocFile } from '@/api';

/** What a fence kind renders as, given its info string, its code and its place among that kind's fences here. */
export type FenceRenderer = (info: string, code: string, index: number) => ReactNode;

type Props = {
  source: string;
  className?: string;
  /** fenced code blocks rendered by the caller instead, by the first word of their info string */
  fences?: Record<string, FenceRenderer>;
  /** what relative image paths resolve against */
  base?: string;
  /** local files and their server-classified MIME types */
  files?: readonly DocFile[];
};

/** A block's nodes in the preview, and its fence slots among them. */
type Mounted = { nodes: ChildNode[]; slots: HTMLElement[] };

/**
 * Markdown as HTML, with the caller's components in place of some fences.
 * Each top-level block keeps its DOM nodes until its own output changes, so an edit
 * never reloads the media, iframes or open `<details>` of the blocks around it.
 */
export function Markdown({ source, className = '', fences, base = '', files = [] }: Props) {
  const kinds = useMemo(() => Object.keys(fences ?? {}), [fences]);
  const media = useMemo(() => Object.fromEntries(files.map((file) => [file.name, file.mime])), [files]);
  const chunks = useMemo(() => chunked(source, kinds, base, media), [source, kinds, base, media]);
  const box = useRef<HTMLDivElement>(null);
  // by chunk key; the box's children are these nodes only, never React's
  const mounted = useRef(new Map<string, Mounted>());
  // re-renders once new blocks are in the box, so their fences get portals
  const [, placed] = useReducer((n: number) => n + 1, 0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const before = mounted.current;
    const after = new Map<string, Mounted>();
    for (const chunk of chunks) {
      const kept = before.get(chunk.key);
      if (kept) { after.set(chunk.key, kept); continue; }
      const parsed = document.createElement('div');
      parsed.innerHTML = chunk.html;
      after.set(chunk.key, { nodes: [...parsed.childNodes], slots: [...parsed.querySelectorAll<HTMLElement>('[data-fence]')] });
    }
    // gone blocks first, so that the kept ones never move (a moved iframe reloads)
    for (const [key, { nodes }] of before) if (!after.has(key)) nodes.forEach((node) => node.remove());
    let cursor = el.firstChild;
    for (const { nodes } of after.values()) {
      for (const node of nodes) {
        if (node === cursor) cursor = node.nextSibling;
        else el.insertBefore(node, cursor);
      }
    }
    mounted.current = after;
    if (chunks.some((chunk) => chunk.fences.length && !before.has(chunk.key))) placed();
  }, [chunks]);

  // gif-style videos play and pause on click, Space and Enter
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const gif = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLVideoElement>('video.gif') : null);
    const toggle = (video: HTMLVideoElement) => (video.paused ? void video.play() : video.pause());
    const click = (e: MouseEvent) => { const video = gif(e); if (video) toggle(video); };
    const keydown = (e: KeyboardEvent) => {
      const video = gif(e);
      if (!video || (e.key !== ' ' && e.key !== 'Enter')) return;
      e.preventDefault();
      toggle(video);
    };
    el.addEventListener('click', click);
    el.addEventListener('keydown', keydown);
    return () => { el.removeEventListener('click', click); el.removeEventListener('keydown', keydown); };
  }, []);

  const counts: Record<string, number> = {};
  return (
    <>
      <div ref={box} className={className} />
      {chunks.flatMap((chunk) => chunk.fences.map((fence, i) => {
        const index = counts[fence.kind] = (counts[fence.kind] ?? -1) + 1;
        const slot = mounted.current.get(chunk.key)?.slots[i];
        const render = fences?.[fence.kind];
        return render && slot ? createPortal(render(fence.info, fence.code, index), slot, `${chunk.key}:${i}`) : null;
      }))}
    </>
  );
}
