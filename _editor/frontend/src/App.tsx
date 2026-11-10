import { useCallback, useEffect, useState } from 'react';
import { Toast } from './dumb/Toast';
import { DEFAULT_PATH, views } from './views/registry';

const current = () => decodeURIComponent(location.hash.replace(/^#\/?/, '')) || DEFAULT_PATH;

/** The view for the path in the location's hash (`#thea/<doc>`). */
export function App() {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const sync = () => setPath(current());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const navigate = useCallback((next: string) => { location.hash = `#${next}`; }, []);
  const View = views.find((v) => v.match(path))?.component;
  return (
    <>
      {View ? <View path={path} navigate={navigate} /> : <p className="p-4">No view for <code>{path}</code>.</p>}
      <Toast />
    </>
  );
}
