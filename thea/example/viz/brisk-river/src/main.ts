import './style.css';

const SVG_NS = 'http://www.w3.org/2000/svg';

const DATA: { short: string; long: string; mm: number }[] = [
  { short: 'Jan', long: 'January', mm: 42 },
  { short: 'Feb', long: 'February', mm: 33 },
  { short: 'Mar', long: 'March', mm: 41 },
  { short: 'Apr', long: 'April', mm: 37 },
  { short: 'May', long: 'May', mm: 54 },
  { short: 'Jun', long: 'June', mm: 69 },
  { short: 'Jul', long: 'July', mm: 56 },
  { short: 'Aug', long: 'August', mm: 58 },
  { short: 'Sep', long: 'September', mm: 45 },
  { short: 'Oct', long: 'October', mm: 37 },
  { short: 'Nov', long: 'November', mm: 44 },
  { short: 'Dec', long: 'December', mm: 55 },
];

const figure = document.querySelector<HTMLElement>('.rain');
const chart = document.getElementById('chart');
const tip = document.getElementById('tip');

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.appendChild(node);
  return node;
}

let active = -1;

function render(): void {
  if (!chart || !tip || !figure) return;
  const width = chart.clientWidth;
  const height = chart.clientHeight;
  if (width === 0 || height === 0) return;

  const narrow = width < 480;
  const m = { top: 22, right: 4, bottom: 24, left: 30 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const yMax = 80;
  const ticks = [0, 20, 40, 60, 80];
  const y = (v: number): number => m.top + ih - (v / yMax) * ih;
  const band = iw / DATA.length;
  const pad = narrow ? 0.22 : 0.28;
  const bw = band * (1 - pad);

  const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'false' });

  const grid = el('g', { class: 'grid' }, svg);
  for (const t of ticks) {
    const yy = Math.round(y(t)) + 0.5;
    el('line', { x1: m.left, x2: width - m.right, y1: yy, y2: yy }, grid);
    const lbl = el('text', { class: 'axis-label', x: m.left - 6, y: yy, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg);
    lbl.textContent = String(t);
  }
  const unit = el('text', { class: 'unit', x: 0, y: m.top - 12, 'text-anchor': 'start' }, svg);
  unit.textContent = 'mm';

  const bars = el('g', {}, svg);
  DATA.forEach((d, i) => {
    const g = el('g', {
      class: 'bar-group' + (i === active ? ' active' : ''),
      tabindex: 0,
      role: 'img',
      'aria-label': `${d.long}: ${d.mm} mm`,
    }, bars);
    const x = m.left + i * band + (band - bw) / 2;
    const top = y(d.mm);
    const r = Math.min(3, bw / 4);
    const h = m.top + ih - top;
    el('path', {
      class: 'bar',
      d: `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${top + h}Z`,
    }, g);
    el('rect', { class: 'hit', x: m.left + i * band, y: m.top, width: band, height: ih }, g);
    const lbl = el('text', {
      class: 'axis-label',
      x: m.left + i * band + band / 2,
      y: height - 6,
      'text-anchor': 'middle',
    }, svg);
    lbl.textContent = narrow ? d.short[0] : d.short;

    const show = (): void => setActive(i);
    g.addEventListener('pointerenter', show);
    g.addEventListener('focus', show);
    g.addEventListener('pointerleave', () => setActive(-1));
    g.addEventListener('blur', () => setActive(-1));
  });

  chart.replaceChildren(svg);
  positionTip();

  function setActive(i: number): void {
    active = i;
    svg.querySelectorAll('.bar-group').forEach((n, j) => n.classList.toggle('active', j === i));
    positionTip();
  }

  function positionTip(): void {
    if (!tip || !figure || !chart) return;
    figure.classList.toggle('has-active', active >= 0);
    if (active < 0) {
      tip.hidden = true;
      return;
    }
    const d = DATA[active];
    tip.innerHTML = `<span class="m">${d.long}</span><span class="v">${d.mm} mm</span>`;
    tip.hidden = false;
    const cx = m.left + active * band + band / 2;
    const tw = tip.offsetWidth;
    const left = Math.max(tw / 2, Math.min(width - tw / 2, cx));
    tip.style.left = `${chart.offsetLeft + left}px`;
    const minTop = tip.offsetHeight + 8 - chart.offsetTop;
    tip.style.top = `${chart.offsetTop + Math.max(minTop, y(d.mm))}px`;
  }
}

render();
if (chart) new ResizeObserver(() => render()).observe(chart);
