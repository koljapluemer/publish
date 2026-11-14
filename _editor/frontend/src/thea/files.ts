import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { api, upload, type DocFile } from '@/api';
import { theaBlocks } from './thea';

/** A doc's files: flat next to its index.md, for its prose and viz blocks; mirrors _editor/thea.py. */
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const FILE_TYPES = ['csv', 'tsv', 'txt', 'md', 'json', 'geojson', 'svg', 'png', 'jpg', 'jpeg', 'webp',
  'gif', 'avif', 'mp4', 'webm', 'ogv', 'ogg', 'm4v', 'mov', 'mp3', 'wav', 'oga', 'm4a',
  'woff', 'woff2', 'ttf', 'otf'];
export const IMAGE_TYPES = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'];
const MIME_TYPES: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
  'image/svg+xml': 'svg', 'text/csv': 'csv', 'application/json': 'json', 'text/plain': 'txt',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'oga', 'audio/mp4': 'm4a',
};

export const ext = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');
const filesUrl = (doc: string) => `/api/docs/${encodeURIComponent(doc)}/files`;

/** Where the preview finds the doc's files: relative image paths resolve against it. */
export const docFilesBase = (doc: string) => `${filesUrl(doc)}/`;

/** One of the doc's files, as of `file.mtime`, so that a replaced image isn't shown from the cache. */
export const docFileUrl = (doc: string, file: DocFile) =>
  `${docFilesBase(doc)}${encodeURIComponent(file.name)}?v=${file.mtime}`;

export const isImage = (name: string) => IMAGE_TYPES.includes(ext(name));

export const docFilesQuery = (doc: string) => queryOptions({
  queryKey: ['files', doc], queryFn: () => api<DocFile[]>('GET', filesUrl(doc)),
});

/** Uploads `files` (named by `fileName` already), replacing same-named ones; updates the list. */
export async function uploadFiles(qc: QueryClient, doc: string, files: File[]) {
  qc.setQueryData(docFilesQuery(doc).queryKey, await upload<DocFile[]>(filesUrl(doc), files));
}

export async function deleteFile(qc: QueryClient, doc: string, name: string) {
  qc.setQueryData(docFilesQuery(doc).queryKey,
    await api<DocFile[]>('DELETE', `${filesUrl(doc)}/${encodeURIComponent(name)}`));
}

const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/** The name `file` is stored as: its own, made valid, or `pasted-<time>.<ext>` when it has none
 * (a pasted screenshot is "image.png"); null when the type can't be one of a doc's files. */
export function fileName(file: { name: string; type: string }, now = new Date()): string | null {
  let type = ext(file.name);
  if (!FILE_TYPES.includes(type)) type = MIME_TYPES[file.type] ?? '';
  if (!FILE_TYPES.includes(type)) return null;
  const stem = file.name.includes('.') ? file.name.slice(0, file.name.lastIndexOf('.')) : file.name;
  const clean = stem.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[^A-Za-z0-9]+|-+$/g, '');
  const name = `${!clean || clean === 'image' || clean === 'index' ? `pasted-${stamp(now)}` : clean}.${type}`;
  return FILE.test(name) ? name : null;
}

/** What to insert at `pos` in `text` to refer to the doc's file `name`: the bare name inside a viz
 * block's spec, an image elsewhere for images, else the bare name. */
export function fileReference(text: string, pos: number, name: string): string {
  const line = text.slice(0, pos).split('\n').length - 1;
  if (theaBlocks(text).some((b) => b.line < line && line < b.end)) return name;
  return isImage(name) ? `![](${name})` : name;
}

export function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
