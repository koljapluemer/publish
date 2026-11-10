import './style.css';

const NS = 'http://www.w3.org/2000/svg';
const form = document.getElementById('form') as HTMLFormElement;
const input = document.getElementById('num') as HTMLInputElement;
const svg = document.getElementById('chart') as unknown as SVGSVGElement;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  text?: string,
  parent: Element = svg,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

const minus = (s: string) => s.replace(/-/g, '−');

function fmtVal(v: number): string {
  if (v >= 1e7 || v < 1e-3) {
    const [m, e] = v.toExponential(2).split('e');
    return `${String(parseFloat(m))}e${minus(String(Number(e)))}`;
  }
  return v.toLocaleString('en-US', { maximumSignificantDigits: 6 }).replace(/,/g, ' ');
}

function fmtDb(db: number): string {
  const r = Math.abs(db) >= 100 ? db.toFixed(1) : db.toFixed(2);
  return `${minus(String(parseFloat(r)))} dB`;
}

const toDb = (v: number) => 10 * Math.log10(v);

// Single source of truth: only numbers the user has submitted, in memory until reload.
interface State {
  readonly values: readonly number[];
  readonly lastIndex: number | null;
}
let state: State = { values: [], lastIndex: null };

function addValue(s: State, v: number): State {
  const idx = s.values.indexOf(v);
  if (idx !== -1) return { ...s, lastIndex: idx };
  return { values: [...s.values, v], lastIndex: s.values.length };
}

/** Axis domain in dB, snapped to whole decades (10 dB) around the submitted values. */
function domain(values: readonly number[]): { lo: number; hi: number } {
  const lgs = values.map(Math.log10);
  const lo = Math.min(0, Math.floor(Math.min(0, ...lgs) + 1e-9));
  const hi = Math.max(3, Math.ceil(Math.max(3, ...lgs) - 1e-9));
  return { lo: lo * 10, hi: hi * 10 };
}

function parse(): number | null {
  const raw = input.value.trim();
  if (raw === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 1e-15 && v <= 1e15 ? v : NaN;
}

function render(): void {
  const W = Math.max(280, svg.clientWidth || 600);
  const mL = 18, mR = 18;
  const { values, lastIndex } = state;
  const { lo, hi } = domain(values);
  const x = (db: number) => mL + ((db - lo) / (hi - lo)) * (W - mL - mR);

  type Item = { v: number; x: number; w: number; row: number; isNew: boolean };
  const items: Item[] = values.map((v, i) => ({
    v, x: x(toDb(v)), w: Math.max(fmtVal(v).length, fmtDb(toDb(v)).length) * 7 + 10, row: 0,
    isNew: i === lastIndex,
  }));
  const rows: { l: number; r: number }[][] = [];
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    const l = Math.max(0, Math.min(W - it.w, it.x - it.w / 2)), r = l + it.w;
    let row = 0;
    while (rows[row]?.some((s) => !(r <= s.l || l >= s.r))) row++;
    (rows[row] ??= []).push({ l, r });
    it.row = row;
  }
  const rowH = 36;
  const nRows = rows.length;
  const axisY = nRows ? 14 + nRows * rowH + 10 : 14;
  const hasValues = values.length > 0;
  const H = axisY + (hasValues ? 32 : 14);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', String(H));
  svg.replaceChildren();

  el('line', { class: 'axis', x1: mL - 8, x2: W - mR + 8, y1: axisY, y2: axisY });

  if (hasValues) {
    for (const [db, ex, anchor] of [[lo, mL, 'start'], [hi, W - mR, 'end']] as const) {
      el('line', { class: 'end', x1: ex, x2: ex, y1: axisY - 6, y2: axisY + 6 });
      el('text', { class: 'range', x: ex + (anchor === 'start' ? -8 : 8), y: axisY + 24, 'text-anchor': anchor }, fmtDb(db));
    }
  }

  for (const it of [...items].sort((a, b) => b.row - a.row || (a.isNew ? 1 : -1))) {
    const g = el('g', { class: it.isNew ? 'pt new' : 'pt' });
    const ly = 14 + (nRows - 1 - it.row) * rowH;
    const cx = Math.max(it.w / 2, Math.min(W - it.w / 2, it.x));
    el('line', { class: 'stem', x1: it.x, x2: it.x, y1: ly + 28, y2: axisY }, undefined, g);
    el('text', { class: 'v', x: cx, y: ly + 10, 'text-anchor': 'middle' }, fmtVal(it.v), g);
    el('text', { class: 'd', x: cx, y: ly + 24, 'text-anchor': 'middle' }, fmtDb(toDb(it.v)), g);
    el('circle', { class: 'dot', cx: it.x, cy: axisY, r: 5 }, undefined, g);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = parse();
  if (v === null || Number.isNaN(v)) {
    input.classList.toggle('bad', v !== null);
    return;
  }
  input.classList.remove('bad');
  state = addValue(state, v);
  input.value = '';
  input.focus();
  render();
});

input.addEventListener('input', () => input.classList.remove('bad'));
new ResizeObserver(() => render()).observe(svg);
render();
