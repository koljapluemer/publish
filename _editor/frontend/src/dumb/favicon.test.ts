import { describe, expect, it } from 'vitest';
import { minimap } from './favicon';

const kinds = (s: string, lang: 'markdown' | 'typst' = 'markdown') => minimap(s, lang).map((r) => r.kind);

describe('minimap', () => {
  it('maps markdown to headings, wrapped text, gaps and figures', () => {
    expect(kinds('---\ntitle: T\n---\n# Hi\n\n\n' + 'x'.repeat(130) + '\n\n![a](a.png)\n')).toEqual(
      ['heading', 'gap', 'text', 'text', 'text', 'gap', 'figure']);
  });
  it('draws a viz as one figure and only the start of code', () => {
    expect(kinds('```thea brisk-river\nspec\nmore spec\n```\n```py\n1\n2\n3\n4\n5\n6\n```\nend')).toEqual(
      ['figure', 'code', 'code', 'code', 'code', 'text']);
  });
  it('skips the typst preamble', () => {
    expect(kinds('#set page(a4)\n#import "x": y\n= Title\nbody\n#image("a.png")', 'typst')).toEqual(['heading', 'text', 'figure']);
  });
  it('caps the rows', () => {
    expect(minimap('x'.repeat(10_000), 'markdown').length).toBeLessThanOrEqual(14);
  });
});
