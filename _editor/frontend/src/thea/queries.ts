import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api, type TheaJob, type TheaMeta, type TheaStatus } from '@/api';
import { showError } from '@/dumb/notice';

const vizUrl = (doc: string, name: string, what: string) =>
  `/api/viz/${encodeURIComponent(doc)}/${encodeURIComponent(name)}/${what}`;
export const vizViewUrl = (doc: string, name: string, built: string) => `${vizUrl(doc, name, 'view')}?v=${encodeURIComponent(built)}`;

export const theaStatusQuery = queryOptions({
  queryKey: ['thea', 'status'], queryFn: () => api<TheaStatus>('GET', '/api/status'), staleTime: 60_000,
});

/** The viz's meta.json; null until it's built. */
export const theaMetaQuery = (doc: string, name: string) => queryOptions({
  queryKey: ['thea', 'meta', doc, name],
  queryFn: () => api<TheaMeta | null>('GET', vizUrl(doc, name, 'meta')),
  staleTime: Infinity,
});

const theaJobsQuery = queryOptions({ queryKey: ['thea', 'jobs'], queryFn: () => api<TheaJob[]>('GET', '/api/jobs') });

/** The states seen of each job, so a job finishing is acted on once however many blocks watch it. */
const seen = new Map<string, TheaJob['state']>();
const jobKey = (j: TheaJob) => `${j.doc}/${j.name}@${j.started}`;

/** The generation jobs, polled while one is queued or running; a finished one refreshes the viz metas, a failed one shows its error. */
export function useTheaJobs() {
  const qc = useQueryClient();
  const { data } = useQuery({
    ...theaJobsQuery,
    refetchInterval: (q) => (q.state.data?.some((j) => j.state === 'queued' || j.state === 'running') ? 1500 : false),
  });
  useEffect(() => {
    let finished = false;
    for (const job of data ?? []) {
      const before = seen.get(jobKey(job));
      seen.set(jobKey(job), job.state);
      if ((before === 'queued' || before === 'running') && (job.state === 'done' || job.state === 'failed')) {
        finished = true;
        if (job.state === 'failed') showError(`${job.name}: ${job.error?.split('\n')[0] ?? 'failed'}`);
      }
    }
    if (finished) void qc.invalidateQueries({ queryKey: ['thea', 'meta'] });
  }, [data, qc]);
  return data ?? [];
}

/** Queues generating the viz `name` of `doc` from `spec`; `errors` are what the live viz reported. */
export async function generateViz(qc: QueryClient, doc: string, name: string, spec: string, errors: string[]) {
  const job = await api<TheaJob>('POST', '/api/generate', { doc, name, spec, errors });
  seen.set(jobKey(job), job.state);
  await qc.invalidateQueries({ queryKey: theaJobsQuery.queryKey });
  return job;
}
