import './style.css';
import katex from 'katex';
import baseUrl from '../files/base_small.jpg';
import friedUrl from '../files/fried_small.jpg';

const N = 50; // image size (m = n = 50)
const TOTAL = N * N; // 1x1 kernel → one step per pixel
const SCALE = 8; // canvas px per image px

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const cvBase = $<HTMLCanvasElement>('cv-base');
const cvFried = $<HTMLCanvasElement>('cv-fried');
const cvDiff = $<HTMLCanvasElement>('cv-diff');
const swBase = $<HTMLElement>('sw-base');
const swFried = $<HTMLElement>('sw-fried');
const rgbBody = $<HTMLTableSectionElement>('rgb-body');
const rgbSum = $<HTMLTableCellElement>('rgb-sum');
const kpos = $<HTMLSpanElement>('kpos');
const btnPlay = $<HTMLButtonElement>('btn-play');
const btnReset = $<HTMLButtonElement>('btn-reset');
const speed = $<HTMLInputElement>('speed');
const speedOut = $<HTMLOutputElement>('speed-out');
const bar = $<HTMLDivElement>('progress-bar');
const status = $<HTMLDivElement>('status');
const fDef = $<HTMLDivElement>('f-def');
const fTerm = $<HTMLDivElement>('f-term');
const fSse = $<HTMLDivElement>('f-sse');
const fMse = $<HTMLDivElement>('f-mse');
const fPsnr = $<HTMLDivElement>('f-psnr');

const CH = ['R', 'G', 'B'];
const rows = CH.map((name) => {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.textContent = name;
  const tds = [0, 1, 2, 3].map(() => document.createElement('td'));
  tr.append(th, ...tds);
  rgbBody.append(tr);
  return tds;
});

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
const plain = (v: number) => v.toLocaleString('en-US');

function tex(el: HTMLElement, s: string) {
  katex.render(s, el, {
    displayMode: true,
    throwOnError: false,
    trust: (ctx) => ctx.command === '\\htmlClass',
    strict: false,
  });
}
const C = (cls: string, body: string) => `\\htmlClass{${cls}}{${body}}`;

// speed slider is logarithmic: 0..100 → 1..2500 px/s
const pxPerSec = () => Math.max(1, Math.round(Math.pow(TOTAL, Number(speed.value) / 100)));

async function main() {
  const [A, B] = await Promise.all([loadPixels(baseUrl), loadPixels(friedUrl)]);

  // per-pixel squared error, summed over R,G,B
  const err = new Float64Array(TOTAL);
  for (let p = 0; p < TOTAL; p++) {
    let s = 0;
    for (let c = 0; c < 3; c++) {
      const d = A.data[p * 4 + c] - B.data[p * 4 + c];
      s += d * d;
    }
    err[p] = s;
  }
  // robust scale: 98th percentile, so a few outliers don't wash out the map
  const sorted = Array.from(err).sort((a, b) => a - b);
  const maxErr = Math.max(1, sorted[Math.floor(sorted.length * 0.98)]);

  let step = 0; // number of pixels already collected
  let sse = 0;
  let playing = false;
  let acc = 0;
  let last = 0;

  const appStyle = () => getComputedStyle(document.getElementById('app') as HTMLElement);

  // kernel shows the pixel most recently collected (or the first pixel before starting)
  const curIdx = () => Math.max(0, Math.min(step, TOTAL) - 1);

  function drawKernel(ctx: CanvasRenderingContext2D, p: number) {
    const x = p % N;
    const y = Math.floor(p / N);
    const pad = 3;
    const W = N * SCALE;
    const s = SCALE + pad * 2;
    const rx = Math.min(W - s + 1, Math.max(1, x * SCALE - pad));
    const ry = Math.min(W - s + 1, Math.max(1, y * SCALE - pad));
    // faint crosshair to help locate the tiny kernel
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, y * SCALE + SCALE / 2 - 0.5, W, 1);
    ctx.fillRect(x * SCALE + SCALE / 2 - 0.5, 0, 1, W);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeRect(rx, ry, s, s);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = appStyle().getPropertyValue('--hl').trim();
    ctx.strokeRect(rx, ry, s, s);
  }

  function drawImage(cv: HTMLCanvasElement, img: HTMLImageElement, p: number) {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, N * SCALE, N * SCALE);
    drawKernel(ctx, p);
  }

  const heatAlpha = (e: number) => Math.min(1, 0.08 + 0.92 * Math.sqrt(e / maxErr));

  function drawDiff(p: number) {
    const ctx = cvDiff.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cvDiff.width, cvDiff.height);
    ctx.fillStyle = appStyle().getPropertyValue('--viz-accent').trim();
    const done = Math.min(step, TOTAL);
    for (let k = 0; k < done; k++) {
      ctx.globalAlpha = heatAlpha(err[k]);
      ctx.fillRect((k % N) * SCALE, Math.floor(k / N) * SCALE, SCALE, SCALE);
    }
    ctx.globalAlpha = 1;
    drawKernel(ctx, p);
  }

  function renderPixel(p: number) {
    const i = Math.floor(p / N);
    const j = p % N;
    const a = [0, 1, 2].map((c) => A.data[p * 4 + c]);
    const b = [0, 1, 2].map((c) => B.data[p * 4 + c]);
    swBase.style.background = `rgb(${a.join(',')})`;
    swFried.style.background = `rgb(${b.join(',')})`;
    kpos.textContent = `row i = ${i}, column j = ${j}`;
    for (let c = 0; c < 3; c++) {
      const d = a[c] - b[c];
      const r = rows[c];
      r[0].textContent = String(a[c]);
      r[1].textContent = String(b[c]);
      r[2].textContent = d > 0 ? `+${d}` : String(d).replace('-', '−');
      r[3].textContent = plain(d * d);
    }
    rgbSum.textContent = plain(err[p]);

    const terms = [0, 1, 2].map((c) => `(${a[c]}-${b[c]})^2`).join('+');
    const sq = [0, 1, 2].map((c) => fmt((a[c] - b[c]) ** 2)).join('+');
    tex(
      fTerm,
      `\\begin{aligned}e(${i},${j}) &= \\sum_{c\\in\\{R,G,B\\}}\\big[I_c(${i},${j})-K_c(${i},${j})\\big]^2 \\\\` +
        ` &= ${terms} \\\\ &= ${sq} = ${C('hl-term', fmt(err[p]))}\\end{aligned}`,
    );
    return { i, j };
  }

  function renderFormulas(p: number) {
    const done = Math.min(step, TOTAL);
    const prev = done > 0 ? sse - err[p] : 0;
    const sseTex =
      done === 0
        ? `S_0 &= 0 \\quad\\text{(no pixels collected yet)}`
        : `S_{${fmt(done)}} &= \\sum_{\\text{${plain(done)} visited pixels}} e(i,j) = S_{${fmt(done - 1)}} + ${C('hl-term', `e(${Math.floor(p / N)},${p % N})`)} \\\\` +
          ` &= ${fmt(prev)} + ${C('hl-term', fmt(err[p]))} = ${C('hl-sse', fmt(sse))}`;
    tex(fSse, `\\begin{aligned}${sseTex}\\end{aligned}`);

    const mse = done ? sse / (3 * done) : NaN;
    const mseVal = done ? fmt(mse, 2) : '\\text{—}';
    const pLabel = done >= TOTAL ? `3\\cdot m\\cdot n` : `3\\cdot p`;
    tex(
      fMse,
      `\\mathrm{MSE} = \\frac{S_{${fmt(done)}}}{${pLabel}} = \\frac{${C('hl-sse', fmt(sse))}}{3\\cdot ${C('hl-n', fmt(done))}} = ${C('hl-res', mseVal)}`,
    );

    let psnr: string;
    if (!done) psnr = `\\mathrm{PSNR} = 10\\cdot\\log_{10}\\!\\left(\\frac{255^2}{\\text{—}}\\right) = \\text{—}`;
    else if (mse === 0) psnr = `\\mathrm{PSNR} = 10\\cdot\\log_{10}\\!\\left(\\frac{255^2}{0}\\right) = ${C('hl-res', '\\infty')}`;
    else {
      const ratio = (255 * 255) / mse;
      const lg = Math.log10(ratio);
      psnr =
        `\\begin{aligned}\\mathrm{PSNR} &= 10\\cdot\\log_{10}\\!\\left(\\frac{255^2}{${C('hl-res', mseVal)}}\\right)` +
        ` = 10\\cdot\\log_{10}\\!\\left(\\frac{65{,}025}{${mseVal}}\\right) \\\\` +
        ` &= 10\\cdot\\log_{10}(${fmt(ratio, 2)}) = 10\\cdot ${fmt(lg, 4)} = ${C('hl-res', fmt(10 * lg, 2) + '\\ \\mathrm{dB}')}\\end{aligned}`;
    }
    tex(fPsnr, psnr);
  }

  function render() {
    const p = curIdx();
    drawImage(cvBase, A.img, p);
    drawImage(cvFried, B.img, p);
    drawDiff(p);
    renderPixel(p);
    renderFormulas(p);
    const done = Math.min(step, TOTAL);
    bar.style.width = `${(done / TOTAL) * 100}%`;
    status.textContent =
      done >= TOTAL
        ? `Done: all ${plain(TOTAL)} pixels compared, p = m·n.`
        : `${plain(done)} of ${plain(TOTAL)} pixels collected (p = ${plain(done)})`;
    btnPlay.textContent = playing ? 'Stop' : done >= TOTAL ? 'Replay' : step > 0 ? 'Resume' : 'Start';
  }

  function advance() {
    if (step >= TOTAL) return;
    sse += err[step];
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
    acc += dt * pxPerSec();
    let changed = false;
    while (acc >= 1 && step < TOTAL) {
      acc -= 1;
      advance();
      changed = true;
    }
    if (step >= TOTAL) playing = false;
    if (changed || !playing) render();
    if (playing) requestAnimationFrame(frame);
  }

  btnPlay.addEventListener('click', () => {
    if (playing) {
      playing = false;
    } else {
      if (step >= TOTAL) reset();
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

  new MutationObserver(() => render()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  render();
}

const updSpeed = () => {
  const v = pxPerSec();
  speedOut.textContent = `${plain(v)} px/s`;
};
speed.addEventListener('input', updSpeed);
updSpeed();

tex(
  fDef,
  `\\begin{aligned}\\mathrm{MSE} &= \\frac{1}{3\\,m\\,n}\\sum_{i=0}^{m-1}\\sum_{j=0}^{n-1}\\underbrace{\\sum_{c\\in\\{R,G,B\\}}\\big[I_c(i,j)-K_c(i,j)\\big]^2}_{e(i,j)}` +
    ` \\\\ \\mathrm{PSNR} &= 10\\cdot\\log_{10}\\!\\left(\\frac{\\mathrm{MAX}_I^2}{\\mathrm{MSE}}\\right) \\\\[0.4em] m &= n = ${N},\\quad \\mathrm{MAX}_I = 255\\end{aligned}`,
);

main().catch((e: unknown) => {
  status.textContent = `Could not load images: ${e instanceof Error ? e.message : String(e)}`;
});
