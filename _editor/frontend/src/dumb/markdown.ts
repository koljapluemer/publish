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

type MediaToken = { href: string; text: string; title?: string | null; maxWidth?: number; mediaKind?: string; gif?: boolean };

const prepareMedia = (token: MediaToken) => {
  const localName = token.href.split(/[?#]/, 1)[0].replace(/^\.\//, '');
  const mime = mediaTypes[decodeURIComponent(localName)];
  if (mime?.startsWith('video/')) token.mediaKind = 'video';
  if (mime?.startsWith('audio/')) token.mediaKind = 'audio';
  token.href = resolveImage(token.href, imageBase);
  const sized = imageWidth(token.text);
  if (sized) [token.text, token.maxWidth] = sized;
};

const renderMedia = (token: MediaToken) => {
  const width = token.maxWidth;
  const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
  const style = width === undefined ? '' : ` style="max-width: min(${width}px, 100%)"`;
  const gif = token.gif && token.mediaKind === 'video';
  if (token.mediaKind === 'video' || token.mediaKind === 'audio') {
    const behavior = gif
      ? ' autoplay loop muted playsinline class="gif" role="button" tabindex="0"'
      : ' controls';
    return `<${token.mediaKind} src="${escapeHtml(token.href)}"${behavior} aria-label="${escapeHtml(token.text)}"${title}${style}></${token.mediaKind}>`;
  }
  return width === undefined ? false : `<img src="${escapeHtml(token.href)}" alt="${escapeHtml(token.text)}"${title}${style}>`;
};


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
      return renderMedia(token as MediaToken);
    },
  },
  walkTokens(token) {
    if (token.type === 'image' || token.type === 'gifMedia') prepareMedia(token as unknown as MediaToken);
  },
});

slotting.use({ extensions: [{
  name: 'gifMedia', level: 'inline',
  start: (src) => src.indexOf('!['),
  tokenizer(src) {
    const m = /^!\[([^\]\n]*)\]\((?:<([^>\n]+)>|([^\s)\n]+))(?:[ \t]+"([^"\n]*)")?\)\{[ \t]*\.gif[ \t]*\}/.exec(src);
    if (!m) return;
    return { type: 'gifMedia', raw: m[0], text: m[1], href: m[2] || m[3], title: m[4] || null, gif: true };
  },
  renderer(token) { return renderMedia(token as unknown as MediaToken) || token.raw; },
}] });

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
