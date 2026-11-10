import './style.css';
import katex from 'katex';
import baseUrl from '../files/base_small.jpg';
import friedUrl from '../files/fried_small.jpg';

const N = 50; // image size
const KS = 5; // kernel size (and stride)
const STEPS = (N / KS) * (N / KS);
const SCALE = 8; // canvas px per image px

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const cvBase = $<HTMLCanvasElement>('cv-base');
const cvFried = $<HTMLCanvasElement>('cv-fried');
const cvDiff = $<HTMLCanvasElement>('cv-diff');
const pkBase = $<HTMLCanvasElement>('pk-base');
const pkFried = $<HTMLCanvasElement>('pk-fried');
const kgrid = $<HTMLDivElement>('kgrid');
const kpos = $<HTMLSpanElement>('kpos');
const btnPlay = $<HTMLButtonElement>('btn-play');
const btnReset = $<HTMLButtonElement>('btn-reset');
const speed = $<HTMLInputElement>('speed');
const speedOut = $<HTMLOutputElement>('speed-out');
const bar = $<HTMLDivElement>('progress-bar');
const status = $<HTMLDivElement>('status');
const fMse = $<HTMLDivElement>('f-mse');
const fPsnr = $<HTMLDivElement>('f-psnr');

const cells: { el: HTMLDivElement; fill: HTMLElement; txt: HTMLElement }[] = [];
for (let i = 0; i < KS * KS; i++) {
  const el = document.createElement('div');
  const fill = document.createElement('i');
  const txt = document.createElement('b');
  el.append(fill, txt);
  kgrid.append(el);
  cells.push({ el, fill, txt });
}

function loadPixels(url: string): Promise<{ img: HTMLImageElement; data: Uint8ClampedArray }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = N;
      c.height = N;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.drawImage(img, 0, 0, N, N);
      resolve({ img, data: ctx.getImageData(0, 0, N, N).data });
    };
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = url;
  });
}

const fmt = (v: number, d = 0) =>
  v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, '{,}');

function tex(el: HTMLElement, s: string) {
  katex.render(s, el, {
    displayMode: true,
    throwOnError: false,
    trust: (ctx) => ctx.command === '\\htmlClass',
    strict: false,
  });
}

async function main() {
  const [A, B] = await Promise.all([loadPixels(baseUrl), loadPixels(friedUrl)]);

  // per-pixel squared error, summed over R,G,B
  const err = new Float64Array(N * N);
  let maxErr = 1;
  for (let p = 0; p < N * N; p++) {
    let s = 0;
    for (let c = 0; c < 3; c++) {
      const d = A.data[p * 4 + c] - B.data[p * 4 + c];
      s += d * d;
    }
    err[p] = s;
  }
  // robust scale: 98th percentile, so a few outliers don't wash out the map
  const sorted = Array.from(err).sort((a, b) => a - b);
  maxErr = Math.max(1, sorted[Math.floor(sorted.length * 0.98)]);

  let step = 0; // number of kernel positions already collected
  let sse = 0;
  let playing = false;
  let acc = 0;
  let last = 0;

  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hlColor = () => getComputedStyle(document.getElementById('app') as HTMLElement).getPropertyValue('--hl').trim();

  const kernelAt = (s: number) => ({ x: (s % (N / KS)) * KS, y: Math.floor(s / (N / KS)) * KS });

  function drawKernel(ctx: CanvasRenderingContext2D, s: number) {
    if (s >= STEPS) return;
    const { x, y } = kernelAt(s);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeRect(x * SCALE + 1, y * SCALE + 1, KS * SCALE - 2, KS * SCALE - 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = hlColor();
    ctx.strokeRect(x * SCALE + 1, y * SCALE + 1, KS * SCALE - 2, KS * SCALE - 2);
  }

  function drawImage(cv: HTMLCanvasElement, img: HTMLImageElement, s: number) {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, N * SCALE, N * SCALE);
    drawKernel(ctx, s);
  }

  function heatAlpha(e: number) {
    return Math.min(1, 0.08 + 0.92 * Math.sqrt(e / maxErr));
  }

  function drawDiff(s: number) {
    const ctx = cvDiff.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cvDiff.width, cvDiff.height);
    const accent = css('--viz-accent');
    ctx.fillStyle = accent;
    const done = Math.min(s, STEPS);
    for (let k = 0; k < done; k++) {
      const { x, y } = kernelAt(k);
      for (let j = y; j < y + KS; j++)
        for (let i = x; i < x + KS; i++) {
          ctx.globalAlpha = heatAlpha(err[j * N + i]);
          ctx.fillRect(i * SCALE, j * SCALE, SCALE, SCALE);
        }
    }
    ctx.globalAlpha = 1;
    drawKernel(ctx, s);
  }

  function drawPatch(cv: HTMLCanvasElement, data: Uint8ClampedArray, x: number, y: number) {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const id = ctx.createImageData(KS, KS);
    for (let j = 0; j < KS; j++)
      for (let i = 0; i < KS; i++) {
        const src = ((y + j) * N + (x + i)) * 4;
        const dst = (j * KS + i) * 4;
        id.data[dst] = data[src];
        id.data[dst + 1] = data[src + 1];
        id.data[dst + 2] = data[src + 2];
        id.data[dst + 3] = 255;
      }
    ctx.putImageData(id, 0, 0);
  }

  function renderKernelDetail(s: number) {
    // show the kernel being collected; at the end keep showing the last one
    const ks = Math.min(s, STEPS - 1);
    const { x, y } = kernelAt(ks);
    drawPatch(pkBase, A.data, x, y);
    drawPatch(pkFried, B.data, x, y);
    let wsum = 0;
    for (let j = 0; j < KS; j++)
      for (let i = 0; i < KS; i++) {
        const e = err[(y + j) * N + (x + i)];
        wsum += e;
        const c = cells[j * KS + i];
        const a = heatAlpha(e);
        c.fill.style.opacity = String(a);
        c.el.classList.toggle('hot', a > 0.55);
        c.txt.textContent = String(Math.round(e / 3));
      }
    kpos.textContent = `rows ${y}–${y + KS - 1}, cols ${x}–${x + KS - 1} · Σ(I−K)² = ${Math.round(wsum).toLocaleString('en-US')}`;
  }

  function renderFormulas(s: number) {
    const px = Math.min(s, STEPS) * KS * KS;
    const n = px * 3;
    const mse = n ? sse / n : NaN;
    const C = (cls: string, body: string) => `\\htmlClass{${cls}}{${body}}`;
    const mseVal = n ? fmt(mse, 2) : '\\text{—}';
    tex(
      fMse,
      `\\begin{aligned}\\mathrm{MSE} &= \\frac{1}{3\\,m\\,n}\\sum_{c=1}^{3}\\sum_{i=0}^{m-1}\\sum_{j=0}^{n-1}\\big[I_c(i,j)-K_c(i,j)\\big]^2 \\\\` +
        ` &= \\frac{${C('hl-sse', fmt(sse))}}{${C('hl-n', `3\\cdot ${fmt(px)}`)}} = ${C('hl-res', mseVal)}\\end{aligned}`,
    );
    let psnr: string;
    if (!n) psnr = '\\text{—}';
    else if (mse === 0) psnr = '\\infty';
    else psnr = `${fmt(10 * Math.log10((255 * 255) / mse), 2)}\\ \\mathrm{dB}`;
    tex(
      fPsnr,
      `\\begin{aligned}\\mathrm{PSNR} &= 10\\cdot\\log_{10}\\!\\left(\\frac{\\mathrm{MAX}_I^2}{\\mathrm{MSE}}\\right) \\\\` +
        ` &= 10\\cdot\\log_{10}\\!\\left(\\frac{255^2}{${mseVal}}\\right) = ${C('hl-res', psnr)}\\end{aligned}`,
    );
  }

  function render() {
    drawImage(cvBase, A.img, step);
    drawImage(cvFried, B.img, step);
    drawDiff(step);
    renderKernelDetail(step);
    renderFormulas(step);
    const done = Math.min(step, STEPS);
    bar.style.width = `${(done / STEPS) * 100}%`;
    status.textContent =
      done >= STEPS
        ? `Done: all ${STEPS} kernel positions, ${N * N} pixels compared.`
        : `Kernel position ${done + 1} of ${STEPS} · ${done * KS * KS} of ${N * N} pixels collected`;
    btnPlay.textContent = playing ? 'Stop' : done >= STEPS ? 'Replay' : step > 0 ? 'Resume' : 'Start';
  }

  function advance() {
    if (step >= STEPS) return;
    const { x, y } = kernelAt(step);
    for (let j = y; j < y + KS; j++) for (let i = x; i < x + KS; i++) sse += err[j * N + i];
    step++;
  }

  function reset() {
    step = 0;
    sse = 0;
    acc = 0;
  }

  function frame(t: number) {
    if (!playing) return;
    const dt = last ? Math.min(0.25, (t - last) / 1000) : 0;
    last = t;
    acc += dt * Number(speed.value);
    let changed = false;
    while (acc >= 1 && step < STEPS) {
      acc -= 1;
      advance();
      changed = true;
    }
    if (step >= STEPS) playing = false;
    if (changed || !playing) render();
    if (playing) requestAnimationFrame(frame);
  }

  btnPlay.addEventListener('click', () => {
    if (playing) {
      playing = false;
    } else {
      if (step >= STEPS) reset();
      playing = true;
      last = 0;
      acc = 1; // move immediately on start
      requestAnimationFrame(frame);
    }
    render();
  });
  btnReset.addEventListener('click', () => {
    playing = false;
    reset();
    render();
  });
  const updSpeed = () => (speedOut.textContent = `${speed.value} step${speed.value === '1' ? '' : 's'}/s`);
  speed.addEventListener('input', updSpeed);
  updSpeed();

  // redraw canvases when theme changes (accent colors come from CSS variables)
  new MutationObserver(() => render()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  render();
}

main().catch((e: unknown) => {
  status.textContent = `Could not load images: ${e instanceof Error ? e.message : String(e)}`;
});
