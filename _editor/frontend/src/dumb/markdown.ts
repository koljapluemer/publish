import { Marked, type Token } from 'marked';
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

/** A fence rendered by the caller: its kind (the first word of `info`), its info string and its code. */
export type Fence = { kind: string; info: string; code: string };
/** A top-level block of the preview: its sanitized HTML, the caller's fences in it in order, and a key that's the same exactly when its output is. */
export type Chunk = { key: string; html: string; fences: Fence[] };

let slotKinds: readonly string[] = [];
// the slot fences rendered so far, in order
let slotFences: Fence[] = [];
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


/** Fences whose info string starts with one of `slotKinds` become empty slots for the caller to fill, collected in `slotFences`. */
const slotting = new Marked({
  renderer: {
    code({ text, lang }) {
      const info = lang ?? '';
      const kind = info.split(/\s+/)[0];
      if (slotKinds.includes(kind)) {
        // no info or code here: a spec edit leaves the slot's HTML, and so its DOM, as it is
        slotFences.push({ kind, info, code: text });
        return `<div data-fence="${escapeHtml(kind)}"></div>\n`;
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

const DETAILS_OPEN = /^<details><summary>/;
const DETAILS_CLOSE = /^<\/details>/;

/** The top-level tokens grouped into blocks: one each, but a whole `???` … `!!!` section (see `withDetails`) as one. */
function blocks(tokens: readonly Token[]): Token[][] {
  const out: Token[][] = [];
  let open: Token[] | null = null;
  let depth = 0;
  for (const token of tokens) {
    if (token.type === 'space' || token.type === 'def') continue;
    const html = token.type === 'html' ? token.raw.trim() : '';
    if (DETAILS_OPEN.test(html)) depth++;
    else if (depth && DETAILS_CLOSE.test(html)) depth--;
    if (open) open.push(token);
    else if (depth) out.push(open = [token]);
    else out.push([token]);
    if (!depth) open = null;
  }
  return out;
}

/**
 * `s` as sanitized HTML in top-level blocks, each fence of one of `kinds` an empty `[data-fence]` slot,
 * relative image paths resolved against `base`, and local files classified by `media`.
 */
export function chunked(s: string, kinds: readonly string[], base = '', media: Readonly<Record<string, string>> = {}): Chunk[] {
  slotKinds = kinds;
  imageBase = base;
  mediaTypes = media;
  try {
    // lexed whole, so reference links resolve across blocks
    const tokens = slotting.lexer(withDetails(withoutFrontmatter(s)));
    const walk = slotting.defaults.walkTokens;
    if (walk) slotting.walkTokens(tokens, walk);
    const seen: Record<string, number> = {};
    const out: Chunk[] = [];
    for (const group of blocks(tokens)) {
      slotFences = [];
      const html = DOMPurify.sanitize(slotting.parser(group));
      if (!html.trim()) continue;
      const fences = slotFences;
      const same = `${html}\0${fences.map((f) => f.info).join('\0')}`;
      const n = seen[same] = (seen[same] ?? -1) + 1;
      out.push({ key: `${same}#${n}`, html, fences });
    }
    return out;
  } finally {
    slotKinds = [];
    slotFences = [];
    imageBase = '';
    mediaTypes = {};
  }
}
