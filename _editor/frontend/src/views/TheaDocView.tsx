import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EditorView } from '@codemirror/view';
import { FilePlus, Paperclip, WandSparkles } from 'lucide-react';
import { api } from '@/api';
import { CodeMirrorHost } from '@/dumb/CodeMirrorHost';
import { Markdown, type FenceRenderer } from '@/dumb/Markdown';
import { showError } from '@/dumb/notice';
import { insertViz, theaBlocks, withNewName, type TheaBlock as Block } from '@/thea/thea';
import { TheaBlock } from '@/thea/TheaBlock';
import { deleteFile, docFilesBase, docFilesQuery, fileName, fileReference, uploadFiles } from '@/thea/files';
import { FilesPanel } from '@/thea/FilesPanel';

type Props = { path: string; navigate: (path: string) => void };

const FILES_OPEN_KEY = 'thea.filesOpen';
const readFilesOpen = () => { try { return localStorage.getItem(FILES_OPEN_KEY) !== '0'; } catch { return true; } };

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
  const qc = useQueryClient();
  const files = useQuery(docFilesQuery(doc)).data;
  const [draft, setDraft] = useState(saved);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [filesOpen, setFilesOpen] = useState(readFilesOpen);
  function toggleFiles() {
    setFilesOpen((open) => {
      try { localStorage.setItem(FILES_OPEN_KEY, open ? '0' : '1'); } catch { /* not stored */ }
      return !open;
    });
  }
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

  /** Runs `edit` on the editor, switching to it first on narrow screens. */
  function withEditor(edit: (view: EditorView) => void) {
    setTab('edit');
    // the editor mounts on the next frame when switching from the preview tab
    requestAnimationFrame(() => { if (editor.current) edit(editor.current); });
  }

  /** Inserts references to the doc's files `names` at `pos` (the cursor by default). */
  function insertReferences(view: EditorView, names: string[], pos = view.state.selection.main.head) {
    const text = view.state.doc.toString();
    const insert = names.map((n) => fileReference(text, pos, n)).join(' ');
    view.dispatch({ changes: { from: pos, insert }, selection: { anchor: pos + insert.length } });
    view.focus();
  }

  /** Uploads `picked` as the doc's files, then refers to them at `pos` when given. */
  async function addFiles(picked: File[], pos?: number) {
    const named = picked.map((f) => [f, fileName(f)] as const);
    const rejected = named.filter(([, n]) => !n).map(([f]) => f.name || f.type);
    if (rejected.length) showError(`Not a supported file type: ${rejected.join(', ')}`);
    const ok = named.filter((x): x is readonly [File, string] => !!x[1]);
    if (!ok.length) return;
    const existing = ok.map(([, n]) => n).filter((n) => files?.some((f) => f.name === n));
    if (existing.length && !confirm(`Replace ${existing.join(', ')}?`)) return;
    try {
      await uploadFiles(qc, doc, ok.map(([f, n]) => (f.name === n ? f : new File([f], n, { type: f.type }))));
    } catch (e) { showError(e); return; }
    if (pos !== undefined && editor.current) insertReferences(editor.current, ok.map(([, n]) => n), pos);
  }

  async function remove(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    try { await deleteFile(qc, doc, name); } catch (e) { showError(e); }
  }

  const pane = (which: 'edit' | 'preview') => `${tab === which ? 'block' : 'hidden'} md:block min-w-0`;
  return (
    <>
      <div className="flex items-center gap-1 border-b border-base-300 px-3 py-1">
        <div role="tablist" className="tabs tabs-box tabs-xs md:hidden">
          <button type="button" role="tab" className={`tab ${tab === 'edit' ? 'tab-active' : ''}`} onClick={() => setTab('edit')}>Edit</button>
          <button type="button" role="tab" className={`tab ${tab === 'preview' ? 'tab-active' : ''}`} onClick={() => setTab('preview')}>Preview</button>
        </div>
        <button type="button" className="btn btn-xs btn-ghost" title="Insert a viz block" onClick={() => withEditor(insertViz)}><WandSparkles size={14} />Viz</button>
        <button type="button" className={`btn btn-xs btn-ghost ${filesOpen ? 'btn-active' : ''}`} aria-pressed={filesOpen}
                title="The doc's files, next to its index.md" onClick={toggleFiles}>
          <Paperclip size={14} />Files{files?.length ? ` (${files.length})` : ''}
        </button>
        {dirty && <span className="status status-warning ml-auto" title="unsaved: saved when the editor loses focus" aria-label="unsaved changes" />}
      </div>
      {filesOpen && (
        <FilesPanel doc={doc} files={files} onAdd={(picked) => void addFiles(picked)} onDelete={(name) => void remove(name)}
                    onInsert={(name) => withEditor((view) => insertReferences(view, [name]))} />
      )}
      <main className="grid flex-1 gap-4 p-3 md:grid-cols-2">
        <div className={pane('edit')}>
          <CodeMirrorHost value={draft} onChange={setDraft} onSave={() => void save()} onBlur={() => void save()}
                          onFiles={(picked, pos) => void addFiles(picked, pos)} editorRef={editor} />
        </div>
        <div className={pane('preview')}>
          <Markdown source={draft} fences={fences} base={docFilesBase(doc)} className="prose max-w-none" />
        </div>
      </main>
    </>
  );
}
