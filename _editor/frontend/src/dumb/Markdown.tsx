import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { slotted } from './markdown';

/** What a fence kind renders as, given its info string, its code and its place among that kind's fences here. */
export type FenceRenderer = (info: string, code: string, index: number) => ReactNode;

type Props = {
  source: string;
  className?: string;
  /** fenced code blocks rendered by the caller instead, by the first word of their info string */
  fences?: Record<string, FenceRenderer>;
};

/** Markdown as HTML, with the caller's components in place of some fences. */
export function Markdown({ source, className = '', fences }: Props) {
  const kinds = useMemo(() => Object.keys(fences ?? {}), [fences]);
  const html = useMemo(() => slotted(source, kinds), [source, kinds]);
  const box = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<HTMLElement[]>([]);
  // the slots of this html: new elements whenever it changes
  useLayoutEffect(() => {
    setSlots(kinds.length && box.current ? [...box.current.querySelectorAll<HTMLElement>('[data-fence]')] : []);
  }, [html, kinds]);

  const counts: Record<string, number> = {};
  return (
    <>
      <div ref={box} className={className} dangerouslySetInnerHTML={{ __html: html }} />
      {slots.map((el, i) => {
        const kind = el.dataset.fence ?? '';
        const render = fences?.[kind];
        const index = counts[kind] = (counts[kind] ?? -1) + 1;
        return render && el.isConnected ? createPortal(render(el.dataset.info ?? '', el.dataset.code ?? '', index), el, `${kind}-${i}`) : null;
      })}
    </>
  );
}
