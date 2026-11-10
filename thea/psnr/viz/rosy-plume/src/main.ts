import './style.css';
import baseUrl from '../files/base_small.jpg';
import friedUrl from '../files/fried_small.jpg';

const K = 5; // kernel size (pixels), stride = K
const RES = 400; // canvas backing resolution

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cvA = $<HTMLCanvasElement>('cv-a');
const cvB = $<HTMLCanvasElement>('cv-b');
const cvD = $<HTMLCanvasElement>('cv-d');
const btnPlay = $<HTMLButtonElement>('btn-play');
const btnStep = $<HTMLButtonElement>('btn-step');
const btnReset = $<HTMLButtonElement>('btn-reset');
const speed = $<HTMLInputElement>('speed');
const speedOut = $<HTMLOutputElement>('speed-out');
const kGrid = $('k-grid');
const kPos = $('k-pos');
const kSum = $('k-sum');
const sN = $('s-n');
const sSse = $('s-sse');
const sMse = $('s-mse');
const sPsnr = $('s-psnr');
const sNote = $('s-note');
const progBar = $('prog-bar');

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
  const cols = Math.ceil(W / K), rows = Math.ceil(H / K);
  const totalSteps = cols * rows;
  const px = RES / W, py = RES / H;
  cvA.height = cvB.height = cvD.height = Math.round(RES * H / W);

  // Per-pixel squared error summed over R,G,B
  const err = new Float64Array(N);
  let maxPix = 0;
  for (let i = 0; i < N; i++) {
    const x = i % W, y = Math.floor(i / W);
    const ia = (y * A.w + x) * 4, ib = (y * B.w + x) * 4;
    let s = 0;
    for (let c = 0; c < 3; c++) {
      const d = A.data[ia + c] - B.data[ib + c];
      s += d * d;
    }
    err[i] = s;
    maxPix = Math.max(maxPix, s / 3);
  }
  const norm = (meanSq: number) => Math.sqrt(meanSq / (maxPix || 1));

  // Offscreen error map (filled as the kernel visits pixels)
  const errCanvas = document.createElement('canvas');
  errCanvas.width = W; errCanvas.height = H;
  const errCtx = errCanvas.getContext('2d')!;
  const errImg = errCtx.createImageData(W, H);

  // Kernel grid cells
  kGrid.style.gridTemplateColumns = `repeat(${K}, minmax(0, 1fr))`;
  const cells: HTMLDivElement[] = [];
  for (let i = 0; i < K * K; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    kGrid.appendChild(d);
    cells.push(d);
  }

  let step = 0; // number of kernel positions processed
  let sse = 0;
  let playing = false;
  let last = 0;
  let acc = 0;

  function kernelRect(s: number) {
    const kx = (s % cols) * K, ky = Math.floor(s / cols) * K;
    return { kx, ky, kw: Math.min(K, W - kx), kh: Math.min(K, H - ky) };
  }

  function drawImagePanel(cv: HTMLCanvasElement, img: CanvasImageSource) {
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, W, H, 0, 0, cv.width, cv.height);
    return ctx;
  }

  function drawKernel(ctx: CanvasRenderingContext2D, s: number) {
    if (s < 0 || s >= totalSteps) return;
    const { kx, ky, kw, kh } = kernelRect(s);
    const x = kx * px, y = ky * py, w = kw * px, h = kh * py;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x, y, w, h);
  }

  function processStep(s: number) {
    const { kx, ky, kw, kh } = kernelRect(s);
    for (let y = ky; y < ky + kh; y++) {
      for (let x = kx; x < kx + kw; x++) {
        const i = y * W + x;
        sse += err[i];
        const [r, g, b] = ramp(norm(err[i] / 3));
        errImg.data.set([r, g, b, 255], i * 4);
      }
    }
    errCtx.putImageData(errImg, 0, 0);
  }

  function render() {
    const shown = step > 0 ? step - 1 : -1; // last processed kernel
    const active = step >= totalSteps ? -1 : Math.max(0, shown);

    const ca = drawImagePanel(cvA, A.img);
    drawKernel(ca, active);
    const cb = drawImagePanel(cvB, B.img);
    drawKernel(cb, active);
    const cd = drawImagePanel(cvD, errCanvas);
    drawKernel(cd, active);

    // Kernel detail
    if (shown >= 0) {
      const { kx, ky, kw, kh } = kernelRect(shown);
      kPos.textContent = `x ${kx}–${kx + kw - 1}, y ${ky}–${ky + kh - 1}`;
      let ks = 0;
      for (let j = 0; j < K; j++) {
        for (let i = 0; i < K; i++) {
          const cell = cells[j * K + i];
          if (i < kw && j < kh) {
            const e = err[(ky + j) * W + kx + i];
            ks += e;
            const m = e / 3;
            const [r, g, b] = ramp(norm(m));
            cell.style.background = `rgb(${r},${g},${b})`;
            cell.style.color = 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#111' : '#fff';
            cell.textContent = m < 10 ? m.toFixed(1) : String(Math.round(m));
            cell.title = `pixel (${kx + i}, ${ky + j}): mean squared error ${fmt(m, 1)}`;
          } else {
            cell.style.background = '';
            cell.style.color = '';
            cell.textContent = '';
          }
        }
      }
      kSum.textContent = fmt(ks);
    } else {
      kPos.textContent = '—';
      kSum.textContent = '—';
      for (const c of cells) {
        c.style.background = '';
        c.style.color = '';
        c.textContent = '';
        c.title = '';
      }
    }

    // Stats
    let n = 0;
    for (let s = 0; s < step; s++) {
      const r = kernelRect(s);
      n += r.kw * r.kh;
    }
    sN.textContent = `${fmt(n)} / ${fmt(N)}`;
    sSse.textContent = fmt(sse);
    if (n > 0) {
      const mse = sse / (n * 3);
      sMse.textContent = fmt(mse, 2);
      sPsnr.textContent = mse === 0 ? '∞ dB' : `${fmt(10 * Math.log10((255 * 255) / mse), 2)} dB`;
    } else {
      sMse.textContent = '—';
      sPsnr.textContent = '—';
    }
    progBar.style.width = `${(step / totalSteps) * 100}%`;

    if (step >= totalSteps) {
      sNote.textContent = `Done: all ${fmt(N)} pixels compared. Higher PSNR means the compressed image is closer to the original; ~30–40 dB is typical for lossy compression.`;
    } else if (step === 0) {
      sNote.textContent = `Press Start to slide the ${K}×${K} kernel across both images.`;
    } else {
      sNote.textContent = 'Running value over the pixels compared so far.';
    }

    btnPlay.textContent = playing ? 'Pause' : step >= totalSteps ? 'Replay' : step > 0 ? 'Resume' : 'Start';
    btnStep.disabled = step >= totalSteps;
    btnReset.disabled = step === 0;
  }

  const stepsPerSec = () => 0.5 * Math.pow(120, Number(speed.value) / 100); // 0.5 … 60
  function updateSpeedLabel() {
    const v = stepsPerSec();
    speedOut.textContent = `${v < 10 ? fmt(v, 1) : fmt(v)} steps/s`;
  }

  function advance() {
    if (step >= totalSteps) return;
    processStep(step);
    step++;
  }

  function reset() {
    step = 0;
    sse = 0;
    errImg.data.fill(0);
    errCtx.clearRect(0, 0, W, H);
  }

  function tick(t: number) {
    if (!playing) return;
    const dt = Math.min(0.25, (t - last) / 1000);
    last = t;
    acc += dt * stepsPerSec();
    let changed = false;
    while (acc >= 1 && step < totalSteps) {
      acc -= 1;
      advance();
      changed = true;
    }
    if (step >= totalSteps) {
      playing = false;
      changed = true;
    }
    if (changed) render();
    if (playing) requestAnimationFrame(tick);
  }

  function play() {
    if (step >= totalSteps) reset();
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
  btnStep.addEventListener('click', () => {
    playing = false;
    advance();
    render();
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
  sNote.textContent = `Could not load images: ${String(e)}`;
});
