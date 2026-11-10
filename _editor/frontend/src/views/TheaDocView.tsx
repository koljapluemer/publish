import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EditorView } from '@codemirror/view';
import { FilePlus, WandSparkles } from 'lucide-react';
import { api } from '@/api';
import { CodeMirrorHost } from '@/dumb/CodeMirrorHost';
import { Markdown, type FenceRenderer } from '@/dumb/Markdown';
import { showError } from '@/dumb/notice';
import { insertViz, theaBlocks, withNewName, type TheaBlock as Block } from '@/thea/thea';
import { TheaBlock } from '@/thea/TheaBlock';

type Props = { path: string; navigate: (path: string) => void };

const docsQuery = { queryKey: ['docs'], queryFn: () => api<string[]>('GET', '/api/docs') };
const docQuery = (doc: string) => ({
  queryKey: ['doc', doc], queryFn: () => api<{ text: string }>('GET', `/api/docs/${encodeURIComponent(doc)}`), staleTime: Infinity,
});

/** `thea/<doc>`: the docs under thea/, one open in an editor beside its preview with live viz blocks. */
export function TheaDocView({ path, navigate }: Props) {
  const qc = useQueryClient();
  const docs = useQuery(docsQuery).data;
  const doc = path.split('/')[1] ?? '';
  const [dirty, setDirty] = useState(false);

  // open the first doc when none is named
  useEffect(() => { if (!doc && docs?.length) navigate(`thea/${docs[0]}`); }, [doc, docs, navigate]);

  function open(next: string) {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setDirty(false);
    navigate(`thea/${next}`);
  }

  async function create() {
    const name = prompt('New doc (lowercase letters, digits, - and _):')?.trim();
    if (!name) return;
    try {
      await api('POST', '/api/docs', { name });
      await qc.invalidateQueries({ queryKey: docsQuery.queryKey });
      open(name);
    } catch (e) { showError(e); }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="navbar min-h-12 gap-2 border-b border-base-300 px-3">
        <span className="font-semibold">thea</span>
        <select className="select select-sm w-auto max-w-[50vw]" aria-label="Doc" value={doc} onChange={(e) => open(e.target.value)}>
          {!doc && <option value="">–</option>}
          {docs?.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button type="button" className="btn btn-sm btn-ghost btn-square" title="New doc" aria-label="New doc" onClick={() => void create()}>
          <FilePlus size={16} />
        </button>
      </header>
      {doc
        ? <DocEditor key={doc} doc={doc} onDirty={setDirty} />
        : <p className="p-4 opacity-60">{docs?.length === 0 ? 'No docs yet: create one.' : ''}</p>}
    </div>
  );
}

function DocEditor({ doc, onDirty }: { doc: string; onDirty: (dirty: boolean) => void }) {
  const qc = useQueryClient();
  const saved = useQuery(docQuery(doc)).data?.text;
  if (saved === undefined) return <span className="loading loading-spinner m-4" />;
  return <LoadedEditor doc={doc} saved={saved} onSaved={(text) => qc.setQueryData(docQuery(doc).queryKey, { text })} onDirty={onDirty} />;
}

function LoadedEditor({ doc, saved, onSaved, onDirty }: { doc: string; saved: string; onSaved: (text: string) => void; onDirty: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState(saved);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const editor = useRef<EditorView | null>(null);
  const dirty = draft !== saved;
  const blocks = useMemo(() => theaBlocks(draft), [draft]);

  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  // what's on disk, or being written there
  const savedRef = useRef(saved);
  /** Writes the draft unless it's what's saved already: on blur, Ctrl+S, and when a first generation names a viz. */
  const save = useCallback(async () => {
    const text = draftRef.current;
    if (text === savedRef.current) return;
    const before = savedRef.current;
    savedRef.current = text;
    try {
      await api('PUT', `/api/docs/${encodeURIComponent(doc)}`, { text });
      onSaved(text);
    } catch (e) {
      savedRef.current = before;
      showError(e);
    }
  }, [doc, onSaved]);

  const assignName = useCallback((block: Block) => {
    const [text, name] = withNewName(draftRef.current, block);
    draftRef.current = text;
    setDraft(text);
    void save();
    return name;
  }, [save]);
  const fences = useMemo<Record<string, FenceRenderer>>(() => ({
    thea: (_info, code, index) => <TheaBlock block={blocks[index]} code={code} doc={doc} assignName={assignName} />,
  }), [blocks, doc, assignName]);

  function insert() {
    setTab('edit');
    // the editor mounts on the next frame when switching from the preview tab
    requestAnimationFrame(() => { if (editor.current) insertViz(editor.current); });
  }

  const pane = (which: 'edit' | 'preview') => `${tab === which ? 'block' : 'hidden'} md:block min-w-0`;
  return (
    <>
      <div className="flex items-center gap-1 border-b border-base-300 px-3 py-1">
        <div role="tablist" className="tabs tabs-box tabs-xs md:hidden">
          <button type="button" role="tab" className={`tab ${tab === 'edit' ? 'tab-active' : ''}`} onClick={() => setTab('edit')}>Edit</button>
          <button type="button" role="tab" className={`tab ${tab === 'preview' ? 'tab-active' : ''}`} onClick={() => setTab('preview')}>Preview</button>
        </div>
        <button type="button" className="btn btn-xs btn-ghost" title="Insert a viz block" onClick={insert}><WandSparkles size={14} />Viz</button>
        {dirty && <span className="status status-warning ml-auto" title="unsaved: saved when the editor loses focus" aria-label="unsaved changes" />}
      </div>
      <main className="grid flex-1 gap-4 p-3 md:grid-cols-2">
        <div className={pane('edit')}>
          <CodeMirrorHost value={draft} onChange={setDraft} onSave={() => void save()} onBlur={() => void save()} editorRef={editor} />
        </div>
        <div className={pane('preview')}>
          <Markdown source={draft} fences={fences} className="prose max-w-none" />
        </div>
      </main>
    </>
  );
}
