/** A JSON request to the server; its JSON answer, or an Error with the server's message. */
export async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
