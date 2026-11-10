import katex from 'katex';
import 'katex/dist/katex.min.css';
import './style.css';

interface Part { name: string; text: string }

const PARTS: Record<string, Part> = {
  psnr: { name: 'PSNR', text: 'Peak Signal-to-Noise Ratio, in decibels (dB). Higher means the reconstruction K is closer to the original I; ∞ when the images are identical.' },
  ten: { name: 'Factor 10', text: 'Converts the base-10 logarithm (bels) into decibels. Written as 20·log₁₀(MAX_I / √MSE) it is the same quantity.' },
  log: { name: 'Base-10 logarithm', text: 'Puts the ratio on a logarithmic scale, so a 10× smaller error gives +10 dB.' },
  ratio: { name: 'Peak-to-noise power ratio', text: 'Squared peak signal power divided by the noise power (mean squared error).' },
  max: { name: 'MAX_I²', text: 'Peak signal power: the maximum possible pixel value, squared — MAX_I is 255 for 8-bit images, 1.0 for floating-point images in [0, 1].' },
  pow: { name: 'Squared peak', text: 'The peak value is squared so it is a power, comparable with the squared errors in MSE.' },
  mse: { name: 'MSE', text: 'Mean Squared Error: the average of the squared pixel differences between the original image I and the noisy or compressed approximation K — the noise power.' },
};

const h = (part: string, tex: string): string => `\\htmlData{part=${part}}{${tex}}`;

const psnrTex =
  `${h('psnr', '\\mathrm{PSNR}')} = ${h('ten', '10')} \\cdot ${h('log', '\\log_{10}')}` +
  h('ratio', `\\left( \\frac{${h('max', `\\mathit{MAX}_I^{${h('pow', '2')}}`)}}{${h('mse', '\\mathrm{MSE}')}} \\right)`);

const opts = { displayMode: true, throwOnError: false, trust: true, strict: false, output: 'html' as const };

const app = document.getElementById('app') as HTMLElement;
const tip = document.getElementById('tip') as HTMLElement;
const tipName = tip.querySelector('.tip-name') as HTMLElement;
const tipText = tip.querySelector('.tip-text') as HTMLElement;

katex.render(psnrTex, document.getElementById('eq-psnr') as HTMLElement, opts);

const partEls = Array.from(app.querySelectorAll<HTMLElement>('[data-part]'));
for (const el of partEls) {
  const p = PARTS[el.dataset.part ?? ''];
  el.classList.add('part');
  el.tabIndex = 0;
  if (p) el.setAttribute('aria-label', `${p.name}: ${p.text}`);
}

let active: HTMLElement | null = null;

function show(el: HTMLElement): void {
  const key = el.dataset.part ?? '';
  const p = PARTS[key];
  if (!p) return;
  active = el;
  for (const e of partEls) e.classList.toggle('on', e.dataset.part === key);
  app.classList.add('hovering');
  tipName.textContent = p.name;
  tipText.textContent = p.text;
  tip.hidden = false;

  const box = app.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const cx = r.left + r.width / 2 - box.left;
  const left = Math.max(0, Math.min(box.width - tw, cx - tw / 2));
  const top = Math.max(0, Math.min(box.height - th, r.bottom - box.top + 8));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hide(): void {
  active = null;
  tip.hidden = true;
  app.classList.remove('hovering');
  for (const e of partEls) e.classList.remove('on');
}

const partFrom = (t: EventTarget | null): HTMLElement | null =>
  t instanceof Element ? t.closest<HTMLElement>('[data-part]') : null;

app.addEventListener('pointerover', (e) => {
  const el = partFrom(e.target);
  if (el) { if (el !== active) show(el); } else if (e.pointerType === 'mouse') hide();
});
app.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
app.addEventListener('focusin', (e) => { const el = partFrom(e.target); if (el) show(el); });
app.addEventListener('focusout', (e) => { if (!app.contains(e.relatedTarget as Node | null)) hide(); });
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  const el = partFrom(e.target);
  if (el && app.contains(el)) show(el); else hide();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hide(); (document.activeElement as HTMLElement | null)?.blur(); } });
window.addEventListener('resize', () => { if (active) show(active); });
