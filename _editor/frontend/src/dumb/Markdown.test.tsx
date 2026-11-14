// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DocFile } from '@/api';
import { Markdown, type FenceRenderer } from './Markdown';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const files: DocFile[] = [{ name: 'demo.mp4', mime: 'video/mp4', size: 0, mtime: 0 }];
let host: HTMLDivElement;
let root: Root;
let mounts = 0;

function Viz({ code }: { code: string }) {
  useEffect(() => { mounts++; }, []);
  return <span className="viz">{code}</span>;
}
const fences: Record<string, FenceRenderer> = { thea: (_info, code) => <Viz code={code} /> };
const show = (source: string) => act(() => root.render(<Markdown source={source} fences={fences} files={files} />));

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mounts = 0;
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('Markdown', () => {
  it("leaves a video's node alone when other blocks change", () => {
    show('Intro.\n\n![Demo](demo.mp4)\n\nOutro.');
    const video = host.querySelector('video');
    expect(video).not.toBeNull();
    show('Intro, edited.\n\n![Demo](demo.mp4)\n\nOutro.');
    expect(host.querySelector('video')).toBe(video);
    show('# New\n\nIntro, edited.\n\n![Demo](demo.mp4)');
    expect(host.querySelector('video')).toBe(video);
    expect([...host.firstElementChild!.children].map((el) => el.tagName)).toEqual(['H1', 'P', 'P']);
  });

  it("keeps a fence's component mounted while its code is edited", () => {
    show('Intro.\n\n```thea\nA chart.\n```');
    const slot = host.querySelector('[data-fence]');
    expect(host.querySelector('.viz')?.textContent).toBe('A chart.');
    show('Intro, edited.\n\n```thea\nA bar chart.\n```');
    expect(host.querySelector('[data-fence]')).toBe(slot);
    expect(host.querySelector('.viz')?.textContent).toBe('A bar chart.');
    expect(mounts).toBe(1);
  });
});
