import { notice } from './notice';

/** The toast corner: the current notice, if any. */
export function Toast() {
  const current = notice.use();
  if (!current) return null;
  return (
    <div className="toast toast-end z-50">
      <div role={current.error ? 'alert' : 'status'} className={`alert ${current.error ? 'alert-error' : 'alert-info'} max-w-sm whitespace-pre-wrap break-words text-sm`}>
        {current.message}
      </div>
    </div>
  );
}
