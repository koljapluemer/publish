// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { slotted } from './markdown';

describe('Markdown preview', () => {
  it('highlights a language fence while preserving Thea fence slots', () => {
    const html = slotted('```py\ndef square(x):\n    return x * x\n```\n\n```thea\nA chart.\n```', ['thea']);
    expect(html).toContain('<code class="hljs language-py">');
    expect(html).toContain('<span class="hljs-keyword">def</span>');
    expect(html).toContain('data-fence="thea"');
    expect(html).toContain('data-code="A chart."');
  });

  it('renders inline and display TeX with KaTeX', () => {
    const html = slotted('Inline $x^2$.\n\n$$\n\\sum_{i=1}^n i\n$$', []);
    expect(html).toContain('<span class="katex">');
    expect(html).toContain('<span class="katex-display">');
    expect(html).toContain('<math');
  });
});
