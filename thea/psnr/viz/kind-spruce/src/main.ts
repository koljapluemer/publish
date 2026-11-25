import './style.css';

const NS = 'http://www.w3.org/2000/svg';
const X_MAX = 10;
const Y_MAX = 7;
const SLOPE = 0.5;
const INTERCEPT = 1;
const f = (x: number): number => SLOPE * x + INTERCEPT;

interface Pt { x: number; y: number }
const INITIAL: Pt[] = [
  { x: 2, y: 3.2 },
  { x: 5, y: 2.4 },
  { x: 8, y: 5.8 },
];
const pts: Pt[] = INITIAL.map((p) => ({ ...p }));
const COLORS = ['var(--c0)', 'var(--c1)', 'var(--c2)'];

const svg = document.getElementById('plot') as unknown as SVGSVGElement;
const wrap = svg.parentElement as HTMLElement;

const M = { l: 34, r: 12, t: 12, b: 34 };
let unit = 50;
let dragging = -1;
let active = -1;

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
};
const sx = (x: number): number => M.l + x * unit;
const sy = (y: number): number => M.t + (Y_MAX - y) * unit;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const fmt = (v: number): string => v.toFixed(2);

// persistent layers
let layers: { squares: SVGGElement; points: SVGGElement } | null = null;
const pointEls: SVGGElement[] = [];

function layout(): void {
  const w = Math.max(280, wrap.clientWidth);
  unit = (w - M.l - M.r) / X_MAX;
  const h = M.t + M.b + unit * Y_MAX;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.replaceChildren();
  pointEls.length = 0;

  const defs = el('defs', {}, svg);
  const clip = el('clipPath', { id: 'plot-clip' }, defs);
  el('rect', { x: M.l, y: M.t, width: unit * X_MAX, height: unit * Y_MAX }, clip);

  const step = unit < 34 ? 2 : 1;
  const grid = el('g', { class: 'grid' }, svg);
  for (let x = 0; x <= X_MAX; x++) el('line', { x1: sx(x), x2: sx(x), y1: sy(0), y2: sy(Y_MAX) }, grid);
  for (let y = 0; y <= Y_MAX; y++) el('line', { x1: sx(0), x2: sx(X_MAX), y1: sy(y), y2: sy(y) }, grid);

  const axis = el('g', { class: 'axis' }, svg);
  el('line', { x1: sx(0), x2: sx(X_MAX), y1: sy(0), y2: sy(0) }, axis);
  el('line', { x1: sx(0), x2: sx(0), y1: sy(0), y2: sy(Y_MAX) }, axis);
  for (let x = 0; x <= X_MAX; x += step) {
    const t = el('text', { class: 'tick', x: sx(x), y: sy(0) + 16, 'text-anchor': 'middle' }, axis);
    t.textContent = String(x);
  }
  for (let y = step; y < Y_MAX; y += step) {
    const t = el('text', { class: 'tick', x: sx(0) - 7, y: sy(y) + 4, 'text-anchor': 'end' }, axis);
    t.textContent = String(y);
  }
  el('text', { class: 'axis-label', x: sx(X_MAX), y: sy(0) + 30, 'text-anchor': 'end' }, axis).textContent = 'x';
  el('text', { class: 'axis-label', x: 10, y: sy(Y_MAX) + 4 }, axis).textContent = 'y';

  const squares = el('g', { 'clip-path': 'url(#plot-clip)' }, svg);

  el('line', { class: 'truth', x1: sx(0), y1: sy(f(0)), x2: sx(X_MAX), y2: sy(f(X_MAX)) }, svg);

  const points = el('g', {}, svg);
  pts.forEach((_, i) => {
    const g = el('g', { class: 'pt', tabindex: 0, role: 'slider', 'aria-label': `Point ${i + 1}` }, points);
    el('circle', { class: 'halo', r: 22 }, g);
    el('circle', { class: 'ring', r: 13, stroke: COLORS[i] }, g);
    el('circle', { class: 'dot', r: 7, fill: COLORS[i] }, g);
    g.addEventListener('pointerdown', (ev) => startDrag(ev, i));
    g.addEventListener('keydown', (ev) => onKey(ev, i));
    g.addEventListener('focus', () => setActive(i));
    g.addEventListener('blur', () => setActive(-1));
    g.addEventListener('pointerenter', () => setActive(i));
    g.addEventListener('pointerleave', () => { if (dragging !== i) setActive(-1); });
    pointEls.push(g);
  });
  layers = { squares, points };
  update();
}

function setActive(i: number): void {
  active = i;
  if (layers) {
    for (const [j, g] of Array.from(layers.squares.children).entries()) g.classList.toggle('g-active', j === active);
  }
}

function update(): void {
  if (!layers) return;
  const { squares } = layers;
  squares.replaceChildren();
  const errs = pts.map((p) => p.y - f(p.x));

  pts.forEach((p, i) => {
    const e = errs[i];
    const s = Math.abs(e);
    const g = el('g', {}, squares);
    if (i === active) g.classList.add('g-active');
    const c = COLORS[i];
    // place square on the side with more room
    const dir = p.x + s <= X_MAX || p.x - s < 0 ? 1 : -1;
    const x0 = dir === 1 ? p.x : p.x - s;
    const yTop = Math.max(p.y, f(p.x));
    el('rect', { class: 'sq', x: sx(x0), y: sy(yTop), width: s * unit, height: s * unit, fill: c, stroke: c }, g);
    el('line', { class: 'residual', x1: sx(p.x), y1: sy(p.y), x2: sx(p.x), y2: sy(f(p.x)), stroke: c }, g);
    if (s * unit > 34) {
      // label in the corner at the point, away from the line crossing the square
      const above = e > 0;
      const t = el('text', {
        class: 'side-label', fill: c, 'text-anchor': dir === 1 ? 'start' : 'end',
        x: sx(p.x) + dir * 6, y: above ? sy(p.y) + 15 : sy(p.y) - 6,
      }, g);
      t.textContent = fmt(e * e);
    }
  });

  pts.forEach((p, i) => {
    const g = pointEls[i];
    g.setAttribute('transform', `translate(${sx(p.x)} ${sy(p.y)})`);
    g.setAttribute('aria-valuetext', `x ${fmt(p.x)}, y ${fmt(p.y)}, error ${fmt(errs[i])}, squared error ${fmt(errs[i] ** 2)}`);
  });
}

function toData(ev: PointerEvent): Pt {
  const r = svg.getBoundingClientRect();
  const px = ev.clientX - r.left;
  const py = ev.clientY - r.top;
  return { x: (px - M.l) / unit, y: Y_MAX - (py - M.t) / unit };
}

function setPoint(i: number, x: number, y: number): void {
  pts[i] = { x: clamp(x, 0.2, X_MAX - 0.2), y: clamp(y, 0.1, Y_MAX - 0.1) };
  update();
}

function startDrag(ev: PointerEvent, i: number): void {
  ev.preventDefault();
  const g = pointEls[i];
  const start = toData(ev);
  const off = { x: pts[i].x - start.x, y: pts[i].y - start.y };
  dragging = i;
  setActive(i);
  g.classList.add('drag');
  g.setPointerCapture(ev.pointerId);
  (g as unknown as HTMLElement).focus({ preventScroll: true });
  const move = (e: PointerEvent): void => {
    const d = toData(e);
    setPoint(i, d.x + off.x, d.y + off.y);
  };
  const end = (): void => {
    dragging = -1;
    g.classList.remove('drag');
    g.removeEventListener('pointermove', move);
    g.removeEventListener('pointerup', end);
    g.removeEventListener('pointercancel', end);
  };
  g.addEventListener('pointermove', move);
  g.addEventListener('pointerup', end);
  g.addEventListener('pointercancel', end);
}

function onKey(ev: KeyboardEvent, i: number): void {
  const step = ev.shiftKey ? 0.5 : 0.1;
  const p = pts[i];
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
  };
  const m = moves[ev.key];
  if (!m) return;
  ev.preventDefault();
  setPoint(i, p.x + m[0], p.y + m[1]);
}

let lastW = -1;
new ResizeObserver(() => {
  const w = wrap.clientWidth;
  if (w !== lastW) {
    lastW = w;
    layout();
  }
}).observe(wrap);
layout();
