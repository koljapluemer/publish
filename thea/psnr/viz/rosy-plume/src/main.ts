import './style.css';
import baseUrl from '../files/base_small.jpg';
import friedUrl from '../files/fried_small.jpg';

const RES = 400; // canvas backing resolution

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cvA = $<HTMLCanvasElement>('cv-a');
const cvB = $<HTMLCanvasElement>('cv-b');
const cvD = $<HTMLCanvasElement>('cv-d');
const btnPlay = $<HTMLButtonElement>('btn-play');
const btnReset = $<HTMLButtonElement>('btn-reset');
const speed = $<HTMLInputElement>('speed');
const speedOut = $<HTMLOutputElement>('speed-out');
const logEl = $<HTMLOListElement>('log');
const mseEl = $('mse');
const LOG_MAX = 40;

// Inferno-like ramp
const STOPS: [number, number, number][] = [
  [0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164],
];
function ramp(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(t));
  const f = t - i;
  const a = STOPS[i], b = STOPS[i + 1];
  return [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * f)) as [number, number, number];
}

function loadPixels(url: string): Promise<{ img: HTMLImageElement; data: Uint8ClampedArray; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.drawImage(img, 0, 0);
      resolve({ img, data: ctx.getImageData(0, 0, w, h).data, w, h });
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

function fmt(n: number, d = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

async function init() {
  const [A, B] = await Promise.all([loadPixels(baseUrl), loadPixels(friedUrl)]);
  const W = Math.min(A.w, B.w), H = Math.min(A.h, B.h);
  const N = W * H;
  const px = RES / W, py = RES / H;
  cvA.height = cvB.height = cvD.height = Math.round(RES * H / W);
  for (const c of [cvA, cvB, cvD]) c.style.aspectRatio = `${W} / ${H}`;

  // Per-pixel squared error, averaged over R,G,B
  const err = new Float64Array(N);
  let maxErr = 0;
  for (let i = 0; i < N; i++) {
    const x = i % W, y = Math.floor(i / W);
    const ia = (y * A.w + x) * 4, ib = (y * B.w + x) * 4;
    let s = 0;
    for (let c = 0; c < 3; c++) {
      const d = A.data[ia + c] - B.data[ib + c];
      s += d * d;
    }
    err[i] = s / 3;
    maxErr = Math.max(maxErr, err[i]);
  }
  const norm = (e: number) => Math.sqrt(e / (maxErr || 1));

  // Offscreen heatmap, filled as the kernel visits pixels
  const errCanvas = document.createElement('canvas');
  errCanvas.width = W; errCanvas.height = H;
  const errCtx = errCanvas.getContext('2d')!;
  const errImg = errCtx.createImageData(W, H);

  let step = 0; // pixels processed
  let sse = 0;
  let playing = false;
  let last = 0;
  let acc = 0;

  function drawPanel(cv: HTMLCanvasElement, img: CanvasImageSource) {
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, W, H, 0, 0, cv.width, cv.height);
    return ctx;
  }

  function drawKernel(ctx: CanvasRenderingContext2D, i: number) {
    if (i < 0 || i >= N) return;
    const x = (i % W) * px, y = Math.floor(i / W) * py;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeRect(x - 2, y - 2, px + 4, py + 4);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x - 1, y - 1, px + 2, py + 2);
  }

  let pending: number[] = [];

  function flushLog() {
    if (pending.length === 0) return;
    const frag = document.createDocumentFragment();
    for (const i of pending.slice(-LOG_MAX)) {
      const li = document.createElement('li');
      const sw = document.createElement('i');
      const [r, g, b] = ramp(norm(err[i]));
      sw.style.background = `rgb(${r},${g},${b})`;
      li.append(sw, fmt(err[i], 1));
      frag.append(li);
    }
    pending = [];
    logEl.append(frag);
    while (logEl.childElementCount > LOG_MAX) logEl.firstElementChild!.remove();
  }

  function processPixel(i: number) {
    sse += err[i];
    pending.push(i);
    const [r, g, b] = ramp(norm(err[i]));
    errImg.data[i * 4] = r;
    errImg.data[i * 4 + 1] = g;
    errImg.data[i * 4 + 2] = b;
    errImg.data[i * 4 + 3] = 255;
  }

  function render() {
    errCtx.putImageData(errImg, 0, 0);
    const active = playing || (step > 0 && step < N) ? Math.min(step, N) - 1 : -1;
    drawKernel(drawPanel(cvA, A.img), active);
    drawKernel(drawPanel(cvB, B.img), active);
    drawKernel(drawPanel(cvD, errCanvas), active);

    flushLog();
    mseEl.textContent = step === 0 ? '—' : fmt(sse / step, 1);

    btnPlay.textContent = playing ? 'Stop' : step >= N ? 'Replay' : step > 0 ? 'Resume' : 'Start';
    btnReset.disabled = step === 0 && !playing;
  }

  // 1 … 2000 pixels per second, log scale
  const pxPerSec = () => Math.pow(2000, Number(speed.value) / 100);
  function updateSpeedLabel() {
    const v = pxPerSec();
    speedOut.textContent = `${fmt(v < 10 ? v : v < 100 ? Math.round(v) : Math.round(v / 10) * 10, v < 10 ? 1 : 0)} px/s`;
  }

  function reset() {
    step = 0;
    sse = 0;
    errImg.data.fill(0);
    pending = [];
    logEl.replaceChildren();
  }

  function tick(t: number) {
    if (!playing) return;
    const dt = Math.min(0.25, (t - last) / 1000);
    last = t;
    acc += dt * pxPerSec();
    let changed = false;
    while (acc >= 1 && step < N) {
      acc -= 1;
      processPixel(step++);
      changed = true;
    }
    if (step >= N) {
      playing = false;
      changed = true;
    }
    if (changed) render();
    if (playing) requestAnimationFrame(tick);
  }

  function play() {
    if (step >= N) reset();
    playing = true;
    acc = 1; // take first step immediately
    last = performance.now();
    requestAnimationFrame(tick);
    render();
  }

  btnPlay.addEventListener('click', () => {
    if (playing) {
      playing = false;
      render();
    } else play();
  });
  btnReset.addEventListener('click', () => {
    playing = false;
    reset();
    render();
  });
  speed.addEventListener('input', updateSpeedLabel);

  updateSpeedLabel();
  render();
}

init().catch((e: unknown) => {
  mseEl.textContent = 'error';
  console.warn(e);
});
