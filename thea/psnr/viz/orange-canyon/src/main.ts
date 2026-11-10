import katex from 'katex';
import './katex.css';
import './style.css';

type Part = { title: string; text: string };

const PARTS: Record<string, Part> = {
  mse: { title: 'Mean squared error', text: 'The average squared difference between the original and the distorted image. 0 means the images are identical.' },
  norm: { title: 'Average over all pixels', text: 'Dividing by m·n — the total number of pixels — turns the summed error into a mean.' },
  m: { title: 'm — image height', text: 'Number of pixel rows in the image.' },
  n: { title: 'n — image width', text: 'Number of pixel columns in the image.' },
  sumi: { title: 'Sum over rows', text: 'Row index i runs from 0 to m − 1, visiting every row of the image.' },
  sumj: { title: 'Sum over columns', text: 'Column index j runs from 0 to n − 1, visiting every pixel in the current row.' },
  sq: { title: 'Squared error', text: 'Squaring makes every error positive and penalises large deviations far more than small ones.' },
  diff: { title: 'Pixel error', text: 'How far the distorted pixel is from the original pixel at the same position.' },
  I: { title: 'I(i, j) — original image', text: 'Value of the pixel at row i, column j in the reference (noise-free) image.' },
  K: { title: 'K(i, j) — distorted image', text: 'Value of the same pixel in the noisy or compressed approximation of I.' },
};

const d = (part: string, tex: string): string => `\\htmlData{part=${part}}{${tex}}`;

const tex = [
  d('mse', '\\mathit{MSE}'),
  '=',
  d('norm', `\\frac{1}{${d('m', 'm')}\\,${d('n', 'n')}}`),
  d('sumi', '\\sum_{i=0}^{m-1}'),
  d('sumj', '\\sum_{j=0}^{n-1}'),
  d('sq', `\\left[ ${d('diff', `${d('I', 'I(i,j)')} - ${d('K', 'K(i,j)')}`)} \\right]^{2}`),
].join(' ');

const app = document.getElementById('app') as HTMLElement;
const formula = document.createElement('div');
formula.className = 'formula';
katex.render(tex, formula, { displayMode: true, trust: true, throwOnError: false, output: 'html' });

const tip = document.createElement('div');
tip.className = 'tip';
tip.setAttribute('role', 'tooltip');
tip.id = 'formula-tip';
tip.hidden = true;
const tipTitle = document.createElement('strong');
const tipText = document.createElement('span');
tip.append(tipTitle, tipText);

app.append(formula, tip);

const parts = Array.from(formula.querySelectorAll<HTMLElement>('[data-part]'));
for (const el of parts) {
  el.classList.add('part');
  el.tabIndex = 0;
  el.setAttribute('aria-describedby', tip.id);
  el.setAttribute('aria-label', PARTS[el.dataset.part ?? '']?.title ?? '');
}

let active: HTMLElement | null = null;

function show(el: HTMLElement | null): void {
  if (el === active) return;
  active?.classList.remove('active');
  active = el;
  if (!el) {
    tip.hidden = true;
    formula.classList.remove('has-active');
    return;
  }
  const info = PARTS[el.dataset.part ?? ''];
  if (!info) return;
  el.classList.add('active');
  formula.classList.add('has-active');
  tipTitle.textContent = info.title;
  tipText.textContent = info.text;
  tip.hidden = false;
  place();
}

function place(): void {
  if (!active) return;
  const host = app.getBoundingClientRect();
  const r = active.getBoundingClientRect();
  const tw = tip.offsetWidth;
  let left = r.left + r.width / 2 - host.left - tw / 2;
  left = Math.max(0, Math.min(left, host.width - tw));
  tip.style.left = `${left}px`;
  tip.style.top = `${r.bottom - host.top + 8}px`;
}

const partAt = (t: EventTarget | null): HTMLElement | null =>
  t instanceof Element ? t.closest<HTMLElement>('[data-part]') : null;

formula.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') show(partAt(e.target)); });
formula.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') show(null); });
formula.addEventListener('click', (e) => {
  const el = partAt(e.target);
  show(el === active ? null : el);
});
formula.addEventListener('focusin', (e) => show(partAt(e.target)));
formula.addEventListener('focusout', (e) => { if (!formula.contains(e.relatedTarget as Node | null)) show(null); });
document.addEventListener('pointerdown', (e) => { if (!formula.contains(e.target as Node)) show(null); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') show(null); });
new ResizeObserver(place).observe(app);
