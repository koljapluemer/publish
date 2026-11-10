import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, TriangleAlert, WandSparkles } from 'lucide-react';
import { showError } from '@/dumb/notice';
import type { TheaBlock as Block } from './thea';
import { generateViz, theaMetaQuery, theaStatusQuery, useTheaJobs, vizViewUrl } from './queries';

type Props = {
  /** the block as parsed from the draft; undefined when the renderer found a fence the parser doesn't count (in a list, say) */
  block: Block | undefined;
  /** the fence's code, shown when there's no block */
  code: string;
  doc: string;
  /** gives an unnamed block its name in the draft, on its first generation; the name */
  assignName: (block: Block) => string;
};

const DEFAULT_HEIGHT = 160;

/** A ```thea block in the preview: its built viz, live, with what (re)generates it. */
export function TheaBlock({ block, code, doc, assignName }: Props) {
  if (!block) return <pre><code>{code}</code></pre>;
  return <LiveBlock block={block} doc={doc} assignName={assignName} />;
}

function LiveBlock({ block, doc, assignName }: { block: Block; doc: string; assignName: (block: Block) => string }) {
  const qc = useQueryClient();
  const name = block.name;
  const status = useQuery(theaStatusQuery).data;
  const meta = useQuery({ ...theaMetaQuery(doc, name ?? ''), enabled: !!name }).data;
  const job = useTheaJobs().find((j) => j.doc === doc && j.name === name);
  const busy = job?.state === 'queued' || job?.state === 'running';
  const [errors, setErrors] = useState<string[]>([]);
  const stale = !!meta && meta.spec !== block.spec;

  const why = !block.spec ? 'write a spec first'
    : status && !status.available ? `unavailable: ${status.reason}`
    : null;

  async function generate() {
    try {
      await generateViz(qc, doc, name ?? assignName(block), block.spec, errors);
      setErrors([]);
    } catch (e) { showError(e); }
  }

  const Icon = meta ? RefreshCw : WandSparkles;
  const title = why ?? (busy ? job.step : stale ? 'the spec changed since: regenerate' : meta ? 'regenerate' : 'generate');
  return (
    <div className="not-prose my-2">
      <div className="mb-1 flex min-h-6 flex-wrap items-center gap-1 text-xs">
        <button type="button" className={`btn btn-xs btn-square ${stale ? 'btn-warning' : 'btn-ghost'}`} title={title} aria-label={title}
                disabled={!!why || busy} onClick={() => void generate()}>
          {busy ? <span className="loading loading-spinner loading-xs" /> : <Icon size={14} />}
        </button>
        {busy && <span className="truncate opacity-70">{job.step}…</span>}
        {stale && !busy && <span className="badge badge-warning badge-xs">spec changed</span>}
        {meta?.cost_usd != null && !busy && <span className="opacity-40" title="the CLI's estimate at API prices">${meta.cost_usd.toFixed(2)}</span>}
        {errors.length > 0 && (
          <span className="flex items-center gap-1 text-error" title={errors.join('\n')}><TriangleAlert size={12} />{errors.length} runtime error{errors.length > 1 ? 's' : ''}</span>
        )}
      </div>
      {job?.state === 'failed' && !busy && (
        <div role="alert" className="alert alert-error alert-soft mb-1 block p-2 text-xs">
          <p className="font-semibold">The last generation failed{job.finished ? ` (${new Date(job.finished * 1000).toLocaleString()})` : ''}</p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap">{job.error}</pre>
        </div>
      )}
      {meta && name && <VizFrame src={vizViewUrl(doc, name, meta.created)} title={name} setErrors={setErrors} />}
      {!meta && !busy && <p className="text-xs opacity-60">not generated yet</p>}
    </div>
  );
}

/** The built page in a sandboxed iframe (an opaque origin, no network), as high as its content. */
function VizFrame({ src, title, setErrors }: { src: string; title: string; setErrors: Dispatch<SetStateAction<string[]>> }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  useEffect(() => {
    const report = (message: string) => setErrors((es) => (es.length < 10 && !es.includes(message) ? [...es, message] : es));
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.source !== 'thea') return;
      if (event.data.type === 'resize' && typeof event.data.height === 'number') setHeight(Math.max(event.data.height, 40));
      if (event.data.type === 'error') report(String(event.data.message).slice(0, 500));
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [setErrors]);
  return <iframe ref={frame} key={src} src={src} sandbox="allow-scripts" title={title} className="block w-full border-0" style={{ height }} />;
}
