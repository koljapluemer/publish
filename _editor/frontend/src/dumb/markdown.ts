import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import markedKatex from 'marked-katex-extension';
import { resolveImage } from './resolve';
import { withoutFrontmatter } from './frontmatter';
import { imageWidth, withDetails } from './mdext';

// External links open in a new tab.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener');
  }
});

export const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

let slotKinds: readonly string[] = [];
let imageBase = '';
let mediaTypes: Readonly<Record<string, string>> = {};


/** Fences whose info string starts with one of `slotKinds` become empty slots for the caller to fill. */
const slotting = new Marked({
  renderer: {
    code({ text, lang }) {
      const info = lang ?? '';
      const kind = info.split(/\s+/)[0];
      if (slotKinds.includes(kind)) {
        return `<div data-fence="${escapeHtml(kind)}" data-info="${escapeHtml(info)}" data-code="${escapeHtml(text)}"></div>\n`;
      }
      const code = kind && hljs.getLanguage(kind)
        ? hljs.highlight(text, { language: kind }).value
        : escapeHtml(text);
      const language = kind
        ? ` class="${hljs.getLanguage(kind) ? 'hljs ' : ''}language-${escapeHtml(kind)}"`
        : '';
      return `<pre><code${language}>${code}\n</code></pre>`;
    },
    image(token) {
      const width = (token as { maxWidth?: number }).maxWidth;
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
      const style = width === undefined ? '' : ` style="max-width: min(${width}px, 100%)"`;
      const kind = (token as { mediaKind?: string }).mediaKind;
      if (kind === 'video' || kind === 'audio') {
        return `<${kind} src="${escapeHtml(token.href)}" controls aria-label="${escapeHtml(token.text)}"${title}${style}></${kind}>`;
      }
      if (width === undefined) return false;
      return `<img src="${escapeHtml(token.href)}" alt="${escapeHtml(token.text)}"${title}${style}>`;
    },
  },
  walkTokens(token) {
    if (token.type !== 'image') return;
    const localName = token.href.split(/[?#]/, 1)[0].replace(/^\.\//, '');
    const mime = mediaTypes[decodeURIComponent(localName)];
    if (mime?.startsWith('video/')) (token as { mediaKind?: string }).mediaKind = 'video';
    if (mime?.startsWith('audio/')) (token as { mediaKind?: string }).mediaKind = 'audio';
    token.href = resolveImage(token.href, imageBase);
    const sized = imageWidth(token.text);
    if (sized) [token.text, (token as { maxWidth?: number }).maxWidth] = sized;
  },
});

// KaTeX renders locally; its CSS and fonts are bundled by Vite.
slotting.use(markedKatex({ throwOnError: false }));

/** `s` as sanitized HTML, each fence of one of `kinds` a `[data-fence]` slot, relative image paths resolved against `base`. */
export function slotted(s: string, kinds: readonly string[], base = '', media: Readonly<Record<string, string>> = {}) {
  slotKinds = kinds;
  imageBase = base;
  mediaTypes = media;
  try {
    return DOMPurify.sanitize(slotting.parse(withDetails(withoutFrontmatter(s)), { async: false }));
  } finally {
    slotKinds = [];
    imageBase = '';
    mediaTypes = {};
  }
}
