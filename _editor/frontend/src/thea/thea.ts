import type { EditorView } from '@codemirror/view';
import { fenceEnd } from '@/dumb/fence';
import { newName } from './words';

/** ```thea fences: a viz block's spec (see _editor/README.md); mirrors _editor/thea.py. */
const HEADER = /^([ \t]{0,3}(?:`{3,}|~{3,}))[ \t]*thea(?:[ \t]+(\S+))?[ \t]*$/;
const NAME = /^[a-z]+-[a-z]+$/;

export type TheaBlock = {
  /** its place among the doc's viz blocks */
  index: number;
  /** the line of its opening fence */
  line: number;
  /** its identity (the folder of its build), given on its first generation; null until then */
  name: string | null;
  spec: string;
};

/** Every closed thea fence, in order; fences inside other fences don't count. */
export function theaBlocks(text: string): TheaBlock[] {
  if (!text.includes('thea')) return [];
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const out: TheaBlock[] = [];
  for (let i = 0; i < lines.length;) {
    const end = fenceEnd(lines, i);
    if (end < 0) { i++; continue; }
    const m = HEADER.exec(lines[i]);
    if (m) {
      const name = m[2] && NAME.test(m[2]) ? m[2] : null;
      out.push({ index: out.length, line: i, name, spec: lines.slice(i + 1, end).join('\n').trim() });
    }
    i = end + 1;
  }
  return out;
}

/** `text` with `block`'s header naming a new, unused name (given on its first generation), and that name. */
export function withNewName(text: string, block: TheaBlock): [string, string] {
  const used = new Set(theaBlocks(text).map((b) => b.name).filter((n): n is string => !!n));
  const name = newName(used);
  const lines = text.split('\n');
  const m = HEADER.exec(lines[block.line].replace(/\r$/, ''));
  if (m) lines[block.line] = `${m[1]}thea ${name}`;
  return [lines.join('\n'), name];
}

const PLACEHOLDER = 'Describe the visualization.';

/** Inserts an empty viz block on its own lines at the cursor, its placeholder spec selected. */
export function insertViz(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const before = from === line.from ? '' : '\n';
  const opener = '```thea\n';
  const insert = `${before}${opener}${PLACEHOLDER}\n\`\`\`\n`;
  const start = from + before.length + opener.length;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: start, head: start + PLACEHOLDER.length } });
  view.focus();
}
