import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { autocompletion } from '@codemirror/autocomplete';
import { lintGutter } from '@codemirror/lint';
import { typst_lezer } from 'codemirror-lang-typst/lezer';
import { api } from '@/api';
import { CodeMirrorHost } from '@/dumb/CodeMirrorHost';
import { showError } from '@/dumb/notice';
import type { ViewProps } from './registry';

type RenderResult = { ok: boolean; error: string | null; time: number };
type RenderState = { pdf_mtime: number | null; render: RenderResult | null };
type TypstDocument = RenderState & { text: string };

const typstExtensions = [typst_lezer(), autocompletion(), lintGutter()];

const listQuery = { queryKey: ['typst'], queryFn: () => api<string[]>('GET', '/api/typst') };
const docQuery = (doc: string) => ({
  queryKey: ['typst-doc', doc],
  queryFn: () => api<TypstDocument>('GET', `/api/typst/${encodeURIComponent(doc)}`),
  staleTime: Infinity,
});

/** `typst/<doc>`: raw Typst beside the PDF produced by the background watcher. */
export function TypstDocView({ path, navigate, onDirty }: ViewProps) {
  const docs = useQuery(listQuery).data;
  const doc = path.split('/')[1] ?? '';
  useEffect(() => { if (!doc && docs?.length) navigate(`typst/${docs[0]}`); }, [doc, docs, navigate]);
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      {doc ? <TypstEditor key={doc} doc={doc} onDirty={onDirty} />
        : <p className="p-4 opacity-60">{docs?.length === 0 ? 'No Typst documents yet.' : ''}</p>}
    </div>
  );
}

function TypstEditor({ doc, onDirty }: { doc: string; onDirty: (dirty: boolean) => void }) {
  const qc = useQueryClient();
  const saved = useQuery(docQuery(doc)).data;
  if (!saved) return <span className="loading loading-spinner m-4" />;
  return <LoadedTypst doc={doc} saved={saved.text} initialRender={saved}
                      onSaved={(next) => qc.setQueryData(docQuery(doc).queryKey, next)} onDirty={onDirty} />;
}

function LoadedTypst({ doc, saved, initialRender, onSaved, onDirty }: {
  doc: string; saved: string; initialRender: RenderState; onSaved: (next: TypstDocument) => void; onDirty: (dirty: boolean) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(saved);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [rendering, setRendering] = useState(false);
  const draftRef = useRef(draft);
  const savedRef = useRef(saved);
  draftRef.current = draft;
  const dirty = draft !== saved;
  const statusKey = ['typst-status', doc];
  const status = useQuery({
    queryKey: statusKey,
    queryFn: () => api<RenderState>('GET', `/api/typst/${encodeURIComponent(doc)}/status`),
    initialData: initialRender,
    refetchInterval: 1500,
  }).data;
  const rendered = status.render;
  const pdfVersion = status.pdf_mtime;

  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(async () => {
    const text = draftRef.current;
    if (text === savedRef.current) return;
    const before = savedRef.current;
    savedRef.current = text;
    setRendering(true);
    try {
      const next = await api<TypstDocument>('PUT', `/api/typst/${encodeURIComponent(doc)}`, { text });
      onSaved(next);
      qc.setQueryData(statusKey, { pdf_mtime: next.pdf_mtime, render: next.render });
    } catch (e) {
      savedRef.current = before;
      showError(e);
    } finally { setRendering(false); }
  }, [doc, onSaved, qc, statusKey]);

  const pane = (which: 'edit' | 'preview') => `${tab === which ? 'block' : 'hidden'} md:block min-w-0`;
  return (
    <>
      <header className="flex min-h-12 items-center gap-2 border-b border-base-300 px-3">
        <span className="font-mono text-sm">typst/{doc}/index.typ</span>
        <div role="tablist" className="tabs tabs-box tabs-xs ml-auto md:hidden">
          <button type="button" role="tab" className={`tab ${tab === 'edit' ? 'tab-active' : ''}`} onClick={() => setTab('edit')}>Edit</button>
          <button type="button" role="tab" className={`tab ${tab === 'preview' ? 'tab-active' : ''}`} onClick={() => setTab('preview')}>Preview</button>
        </div>
        {rendering
          ? <span className="loading loading-spinner loading-xs" title="Rendering PDF" aria-label="Rendering PDF" />
          : dirty && <span className="status status-warning" title="unsaved: saved when the editor loses focus" aria-label="unsaved changes" />}
      </header>
      {rendered && !rendered.ok && <div role="alert" className="alert alert-error m-3 mb-0 py-2 text-sm"><span className="whitespace-pre-wrap">{rendered.error}</span></div>}
      <main className="grid flex-1 gap-4 p-3 md:grid-cols-2">
        <div className={pane('edit')}>
          <CodeMirrorHost value={draft} extensions={typstExtensions} onChange={setDraft}
                          onSave={() => void save()} onBlur={() => void save()} />
        </div>
        <div className={`${pane('preview')} min-h-[70vh] overflow-hidden rounded-box border border-base-300 bg-base-100`}>
          {pdfVersion
            ? <iframe key={pdfVersion} src={`/api/typst/${encodeURIComponent(doc)}/pdf?v=${pdfVersion}`} title={`${doc} PDF`} className="h-full min-h-[70vh] w-full border-0" />
            : <div className="flex h-full min-h-[70vh] items-center justify-center opacity-60">Waiting for the first PDF…</div>}
        </div>
      </main>
    </>
  );
}
