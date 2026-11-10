import './style.css';

const NS = 'http://www.w3.org/2000/svg';
const input = document.getElementById('num') as HTMLInputElement;
const out = document.getElementById('db') as HTMLOutputElement;
const svg = document.getElementById('chart') as unknown as SVGSVGElement;

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const decadeLabel = (d: number): string =>
  d >= 0 && d <= 3 ? String(10 ** d) : d === -1 ? '0.1' : '10' + String(d).split('').map((c) => SUP[c]).join('');

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  svg.appendChild(e);
  return e;
}

function fmtDb(db: number): string {
  const r = Math.abs(db) >= 100 ? db.toFixed(0) : db.toFixed(1);
  return `${r.replace('-', '−')} dB`;
}

let value = 250000;

function render(): void {
  const W = Math.max(280, svg.clientWidth || 600);
  const H = 150;
  const mL = 14, mR = 30;
  const yTop = 34, yBot = 116;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', String(H));
  svg.replaceChildren();

  const valid = Number.isFinite(value) && value > 0;
  const lg = valid ? Math.log10(value) : 0;
  const hi = Math.min(15, Math.max(6, Math.ceil(lg - 1e-9)));
  const lo = Math.max(-15, Math.min(0, Math.floor(lg + 1e-9)));
  const maxLin = 10 ** hi;
  const xLin = (v: number) => mL + (v / maxLin) * (W - mL - mR);
  const xDb = (db: number) => mL + ((db - lo * 10) / ((hi - lo) * 10)) * (W - mL - mR);

  // fan lines between matching decades
  for (let d = lo; d <= hi; d++) {
    const x1 = xLin(10 ** d), x2 = xDb(d * 10);
    el('path', { class: 'fan', d: `M${x1},${yTop} C${x1},${(yTop + yBot) / 2} ${x2},${(yTop + yBot) / 2} ${x2},${yBot}` });
  }

  // axes
  el('line', { class: 'axis', x1: mL, x2: W - mR + 8, y1: yTop, y2: yTop });
  el('line', { class: 'axis', x1: mL, x2: W - mR + 8, y1: yBot, y2: yBot });

  // linear ticks: decades (labelled right-to-left while they fit) plus 0
  let lastX = Infinity;
  for (let d = hi; d >= lo; d--) {
    const x = xLin(10 ** d);
    el('line', { class: 'tick', x1: x, x2: x, y1: yTop - 4, y2: yTop + 4 });
    if (lastX - x >= 36 && x - mL >= 22) {
      el('text', { x, y: yTop - 10, 'text-anchor': 'middle' }, decadeLabel(d));
      lastX = x;
    }
  }
  el('line', { class: 'tick', x1: mL, x2: mL, y1: yTop - 6, y2: yTop + 6 });
  el('text', { x: mL, y: yTop - 10, 'text-anchor': 'middle' }, '0');

  // dB ticks
  const step = (xDb(10) - xDb(0)) >= 30 ? 1 : (xDb(10) - xDb(0)) >= 15 ? 2 : 5;
  for (let d = lo; d <= hi; d++) {
    const x = xDb(d * 10);
    el('line', { class: 'tick', x1: x, x2: x, y1: yBot - 4, y2: yBot + 4 });
    if ((d - lo) % step === 0 || d === hi) {
      if (d === hi && (d - lo) % step !== 0 && (d - lo) % step < step / 2 + 0.5) continue;
      el('text', { x, y: yBot + 20, 'text-anchor': 'middle' }, String(d * 10).replace('-', '−'));
    }
  }
  el('text', { class: 'unit', x: W - mR + 12, y: yBot + 4 }, 'dB');

  if (valid) {
    const db = 10 * lg;
    const x1 = xLin(value), x2 = xDb(db);
    el('path', { class: 'link', d: `M${x1},${yTop} C${x1},${(yTop + yBot) / 2} ${x2},${(yTop + yBot) / 2} ${x2},${yBot}` });
    el('circle', { class: 'dot', cx: x1, cy: yTop, r: 5 });
    el('circle', { class: 'dot', cx: x2, cy: yBot, r: 5 });
  }
}

function update(): void {
  const raw = input.value.trim();
  const v = raw === '' ? NaN : Number(raw);
  const ok = Number.isFinite(v) && v >= 1e-15 && v < 1e15;
  const zero = v === 0;
  input.classList.toggle('bad', raw !== '' && !ok && !zero);
  if (ok || zero) value = v;
  out.textContent = ok ? fmtDb(10 * Math.log10(v)) : zero ? '−∞ dB' : '';
  render();
}

input.addEventListener('input', update);
new ResizeObserver(() => render()).observe(svg);
update();
