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

  it('renders local video and audio image references from their MIME types', () => {
    const html = slotted(
      '![Demo|480](demo.mp4 "A demo")\n\n![Narration](voice.mp3)\n\n![Photo](photo.jpg)',
      [], '/files/', { 'demo.mp4': 'video/mp4', 'voice.mp3': 'audio/mpeg', 'photo.jpg': 'image/jpeg' },
    );
    expect(html).toContain('<video src="/files/demo.mp4" controls="" aria-label="Demo" title="A demo" style="max-width: min(480px, 100%)"></video>');
    expect(html).toContain('<audio src="/files/voice.mp3" controls="" aria-label="Narration"></audio>');
    expect(html).toContain('<img src="/files/photo.jpg" alt="Photo">');
  });
});
