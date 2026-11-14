// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { chunked } from './markdown';

const slotted = (...args: Parameters<typeof chunked>) => chunked(...args).map((c) => c.html).join('');

describe('Markdown preview', () => {
  it('highlights a language fence while preserving Thea fence slots', () => {
    const html = slotted('```py\ndef square(x):\n    return x * x\n```\n\n```thea\nA chart.\n```', ['thea']);
    expect(html).toContain('<code class="hljs language-py">');
    expect(html).toContain('<span class="hljs-keyword">def</span>');
    expect(html).toContain('<div data-fence="thea"></div>');
    expect(html).not.toContain('A chart.');
  });

  it('renders inline and display TeX with KaTeX', () => {
    const html = slotted('Inline $x^2$.\n\n$$\n\\sum_{i=1}^n i\n$$', []);
    expect(html).toContain('<span class="katex">');
    expect(html).toContain('<span class="katex-display">');
    expect(html).toContain('<math');
  });

  it('renders local video and audio image references from their MIME types', () => {
    const html = slotted(
      '![Demo|480](demo.mp4 "A demo")\n\n![Narration](voice.mp3)\n\n![Photo](photo.jpg)',
      [], '/files/', { 'demo.mp4': 'video/mp4', 'voice.mp3': 'audio/mpeg', 'photo.jpg': 'image/jpeg' },
    );
    expect(html).toContain('<video src="/files/demo.mp4" controls="" aria-label="Demo" title="A demo" style="max-width: min(480px, 100%)"></video>');
    expect(html).toContain('<audio src="/files/voice.mp3" controls="" aria-label="Narration"></audio>');
    expect(html).toContain('<img src="/files/photo.jpg" alt="Photo">');
  });

  it('renders the gif attribute as a muted looping autoplay video', () => {
    const html = slotted('![Demo|320](demo.mp4){.gif}', [], '/files/', { 'demo.mp4': 'video/mp4' });
    expect(html).toContain('<video src="/files/demo.mp4" autoplay="" loop="" muted="" playsinline="" class="gif" role="button" tabindex="0" aria-label="Demo" style="max-width: min(320px, 100%)"></video>');
    expect(html).not.toContain('controls');
  });
});

describe('Markdown blocks', () => {
  const keys = (s: string) => chunked(s, ['thea']).map((c) => c.key);

  it('makes one chunk per top-level block', () => {
    const chunks = chunked('# Title\n\nA paragraph.\n\n- a\n- b\n\n```thea\nA chart.\n```', ['thea']);
    expect(chunks.map((c) => c.html.trim().slice(0, 4))).toEqual(['<h1>', '<p>A', '<ul>', '<div']);
    expect(chunks[3].fences).toEqual([{ kind: 'thea', info: 'thea', code: 'A chart.' }]);
  });

  it('keeps a ??? … !!! section, nested, as one chunk with its fences', () => {
    const chunks = chunked('before\n\n??? More\ntext\n???\n```thea\nA chart.\n```\n!!!\n!!!\n\nafter', ['thea']);
    expect(chunks).toHaveLength(3);
    expect(chunks[1].html).toMatch(/^<details>[\s\S]*<details>[\s\S]*<\/details>\s*<\/details>\s*$/);
    expect(chunks[1].fences.map((f) => f.code)).toEqual(['A chart.']);
  });

  it("keeps a fence's key when only its spec changes, not when its name does", () => {
    expect(keys('```thea\nA chart.\n```')).toEqual(keys('```thea\nA bar chart.\n```'));
    expect(keys('```thea brave-otter\nA chart.\n```')).not.toEqual(keys('```thea\nA chart.\n```'));
  });

  it('keeps the keys of unchanged blocks and tells identical ones apart', () => {
    const before = keys('Same.\n\nSame.\n\nOther.');
    const after = keys('Same.\n\nSame.\n\nOther, edited.');
    expect(new Set(before).size).toBe(3);
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
    expect(after[2]).not.toBe(before[2]);
  });

  it('resolves reference links across blocks', () => {
    const chunks = chunked('See [the site][s].\n\n[s]: https://example.com', []);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].html).toContain('href="https://example.com"');
  });
});
