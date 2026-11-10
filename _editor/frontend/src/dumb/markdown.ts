import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { resolveImage } from './resolve';
import { withoutFrontmatter } from './frontmatter';

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


/** Fences whose info string starts with one of `slotKinds` become empty slots for the caller to fill. */
const slotting = new Marked({
  renderer: {
    code({ text, lang }) {
      const info = lang ?? '';
      const kind = info.split(/\s+/)[0];
      if (!slotKinds.includes(kind)) return false;
      return `<div data-fence="${escapeHtml(kind)}" data-info="${escapeHtml(info)}" data-code="${escapeHtml(text)}"></div>\n`;
    },
  },
  walkTokens(token) {
    if (token.type === 'image') token.href = resolveImage(token.href, imageBase);
  },
});

/** `s` as sanitized HTML, each fence of one of `kinds` a `[data-fence]` slot, relative image paths resolved against `base`. */
export function slotted(s: string, kinds: readonly string[], base = '') {
  slotKinds = kinds;
  imageBase = base;
  try {
    return DOMPurify.sanitize(slotting.parse(withoutFrontmatter(s), { async: false }));
  } finally {
    slotKinds = [];
    imageBase = '';
  }
}
