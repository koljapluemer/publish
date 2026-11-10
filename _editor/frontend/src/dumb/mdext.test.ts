import { describe, expect, it } from 'vitest';
import { Marked } from 'marked';
import { imageWidth, withDetails } from './mdext';

describe('withDetails', () => {
  it('turns ??? … !!! into nested details, leaving fences alone; mirrors _editor/mdext.py', () => {
    const html = new Marked().parse(withDetails('???\n# A\ntext\n??? More <b>\ninner\n!!!\n!!!\n???\n```\n!!!\n```'), { async: false });
    expect(html.replace(/\n+/g, '')).toBe(
      '<details><summary>Details</summary><h1>A</h1><p>text</p><details><summary>More &lt;b&gt;</summary><p>inner</p></details></details>'
      + '<details><summary>Details</summary><pre><code>!!!</code></pre></details>',
    );
  });

  it('leaves a stray !!! as text', () => {
    expect(withDetails('a\n!!!')).toBe('a\n!!!');
  });
});

describe('imageWidth', () => {
  it('splits alt|width', () => {
    expect(imageWidth('original|500')).toEqual(['original', 500]);
    expect(imageWidth('a | 20 ')).toEqual(['a', 20]);
    expect(imageWidth('plain')).toBeNull();
  });
});
