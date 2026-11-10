import { fenceEnd } from './fence';

/**
 * The repo's Markdown extensions; mirrors _editor/mdext.py.
 * - A line `???` (optionally `??? label`) opens a collapsed `<details>`, a line `!!!` closes it.
 *   Sections nest; one left open closes at the end. Lines inside fenced code are left alone.
 * - `![alt|500](src)` shows the image at most 500 px wide (see `imageWidth`).
 */

const OPEN = /^[ \t]{0,3}\?\?\?(?:[ \t]+(.*?))?[ \t]*$/;
const CLOSE = /^[ \t]{0,3}!!![ \t]*$/;

const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** `text` with each `???` … `!!!` section as a `<details>` HTML block around its Markdown. */
export function withDetails(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const end = fenceEnd(lines, i);
    if (end >= 0) {
      out.push(...lines.slice(i, end + 1));
      i = end;
      continue;
    }
    const open = OPEN.exec(lines[i]);
    if (open) {
      out.push('', `<details><summary>${open[1] ? escapeHtml(open[1]) : 'Details'}</summary>`, '');
      depth++;
    } else if (depth && CLOSE.test(lines[i])) {
      out.push('', '</details>', '');
      depth--;
    } else {
      out.push(lines[i]);
    }
  }
  for (; depth > 0; depth--) out.push('', '</details>', '');
  return out.join('\n');
}

/** An image's alt text `alt|500` split into the alt and the width, or null without one. */
export function imageWidth(alt: string): [string, number] | null {
  const m = /^(.*?)[ \t]*\|[ \t]*(\d+)[ \t]*$/.exec(alt);
  return m ? [m[1], Number(m[2])] : null;
}
