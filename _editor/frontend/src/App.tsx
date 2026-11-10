import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileCode2, FilePlus, FileText } from 'lucide-react';
import { api } from './api';
import { Toast } from './dumb/Toast';
import { showError } from './dumb/notice';
import { DEFAULT_PATH, views } from './views/registry';

const current = () => decodeURIComponent(location.hash.replace(/^#\/?/, '')) || DEFAULT_PATH;

/** The view for the path in the location's hash (`#thea/<doc>`). */
export function App() {
  const [path, setPath] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('editor.sidebarOpen') !== '0'; } catch { return true; }
  });
  const qc = useQueryClient();
  const thea = useQuery({ queryKey: ['docs'], queryFn: () => api<string[]>('GET', '/api/docs') }).data ?? [];
  const typst = useQuery({ queryKey: ['typst'], queryFn: () => api<string[]>('GET', '/api/typst') }).data ?? [];
  useEffect(() => {
    const sync = () => setPath(current());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const navigate = useCallback((next: string) => {
    if (next === path || (dirty && !confirm('Discard unsaved changes?'))) return;
    setDirty(false);
    location.hash = `#${next}`;
  }, [dirty, path]);
  function toggleSidebar() {
    setSidebarOpen((open) => {
      try { localStorage.setItem('editor.sidebarOpen', open ? '0' : '1'); } catch { /* not stored */ }
      return !open;
    });
  }
  async function createThea() {
    const name = prompt('New doc (lowercase letters, digits, - and _):')?.trim();
    if (!name) return;
    try {
      await api('POST', '/api/docs', { name });
      await qc.invalidateQueries({ queryKey: ['docs'] });
      navigate(`thea/${name}`);
    } catch (e) { showError(e); }
  }
  const View = views.find((v) => v.match(path))?.component;
  return (
    <div className="flex min-h-dvh">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-12'} sticky top-0 flex h-dvh shrink-0 flex-col border-r border-base-300 bg-base-200 transition-[width]`}>
        <div className="flex min-h-12 items-center border-b border-base-300 px-2">
          {sidebarOpen && <span className="min-w-0 flex-1 truncate px-1 font-semibold">publish</span>}
          <button type="button" className="btn btn-sm btn-ghost btn-square" onClick={toggleSidebar}
                  title={sidebarOpen ? 'Collapse files' : 'Expand files'} aria-label={sidebarOpen ? 'Collapse files' : 'Expand files'}>
            {sidebarOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
          </button>
        </div>
        {sidebarOpen ? (
          <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Editable files">
            <FileGroup title="Thea" icon={<FileText size={15} />} paths={thea.map((d) => [`thea/${d}`, d])}
                       active={path} navigate={navigate}
                       action={<button type="button" className="btn btn-xs btn-ghost btn-square" title="New Thea doc" aria-label="New Thea doc" onClick={() => void createThea()}><FilePlus size={14} /></button>} />
            <FileGroup title="Typst" icon={<FileCode2 size={15} />} paths={typst.map((d) => [`typst/${d}`, d])}
                       active={path} navigate={navigate} />
          </nav>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2 opacity-60" aria-hidden="true"><FileText size={17} /><FileCode2 size={17} /></div>
        )}
      </aside>
      <div className="min-w-0 flex-1">
        {View ? <View path={path} navigate={navigate} onDirty={setDirty} /> : <p className="p-4">No view for <code>{path}</code>.</p>}
      </div>
      <Toast />
    </div>
  );
}

function FileGroup({ title, icon, paths, active, navigate, action }: {
  title: string; icon: ReactNode; paths: string[][]; active: string; navigate: (path: string) => void; action?: ReactNode;
}) {
  return (
    <section className="mb-3">
      <div className="flex h-8 items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide opacity-60">
        {icon}<span className="flex-1">{title}</span>{action}
      </div>
      <ul className="menu menu-xs w-full p-0">
        {paths.map(([route, label]) => <li key={route}><button type="button" className={active === route ? 'menu-active' : ''} onClick={() => navigate(route)} title={label}>{label}</button></li>)}
      </ul>
    </section>
  );
}
