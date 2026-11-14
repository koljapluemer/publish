/** A JSON request to the server; its JSON answer, or an Error with the server's message. */
export async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  return answer<T>(method, url, await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

/** Posts `files` as multipart form fields named `file`; the JSON answer, or an Error with the server's message. */
export async function upload<T>(url: string, files: File[]): Promise<T> {
  const form = new FormData();
  for (const f of files) form.append('file', f, f.name);
  return answer<T>('POST', url, await fetch(url, { method: 'POST', body: form }));
}

async function answer<T>(method: string, url: string, res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${method} ${url}: ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export type TheaJob = {
  doc: string; name: string; state: 'queued' | 'running' | 'done' | 'failed'; step: string;
  error: string | null; started: number; finished: number | null; cost_usd: number | null;
};
export type TheaMeta = { spec: string; model: string | null; created: string; cost_usd: number | null; turns: number | null };
export type TheaStatus = { available: boolean; reason: string | null };
/** one of a doc's files, next to its index.md */
export type DocFile = { name: string; size: number; mtime: number; mime: string };
