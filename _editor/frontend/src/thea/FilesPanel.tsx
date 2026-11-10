import { useState, type DragEvent } from 'react';
import { Braces, File as FileIcon, FileText, Plus, Sheet, Trash2, Type } from 'lucide-react';
import type { DocFile } from '@/api';
import { docFileUrl, ext, formatSize, isImage } from './files';

type Props = {
  doc: string;
  files: DocFile[] | undefined;
  /** refer to the file at the editor's cursor */
  onInsert: (name: string) => void;
  /** files picked or dropped here: added to the doc's files, not referred to */
  onAdd: (files: File[]) => void;
  onDelete: (name: string) => void;
};

const ICONS: Record<string, typeof FileIcon> = {
  csv: Sheet, tsv: Sheet, json: Braces, geojson: Braces, txt: FileText, md: FileText,
  woff: Type, woff2: Type, ttf: Type, otf: Type,
};

/** The doc's files, flat next to its index.md, as tiles: images as thumbnails. Click one to refer to it. */
export function FilesPanel({ doc, files, onInsert, onAdd, onDelete }: Props) {
  const [over, setOver] = useState(false);
  const dropping = (e: DragEvent) => e.dataTransfer.types.includes('Files');
  return (
    <div
      className={`flex flex-wrap gap-2 border-b border-base-300 px-3 py-2 ${over ? 'bg-base-200' : ''}`}
      onDragOver={(e) => { if (!dropping(e)) return; e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
      onDrop={(e) => {
        if (!dropping(e)) return;
        e.preventDefault();
        setOver(false);
        onAdd([...e.dataTransfer.files]);
      }}
    >
      {files?.map((f) => {
        const Icon = ICONS[ext(f.name)] ?? FileIcon;
        return (
          <div key={f.name} className="group relative w-24">
            <button type="button" className="block w-full text-left" title={`${f.name}: insert a reference at the cursor`}
                    onClick={() => onInsert(f.name)}>
              <span className="flex h-20 w-24 items-center justify-center overflow-hidden rounded border border-base-300 bg-base-200 group-hover:border-base-content/40">
                {isImage(f.name)
                  ? <img src={docFileUrl(doc, f)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <span className="flex flex-col items-center gap-1 opacity-60"><Icon size={22} /><span className="text-xs uppercase">{ext(f.name)}</span></span>}
              </span>
              <span className="mt-0.5 block truncate text-xs">{f.name}</span>
              <span className="block text-[10px] opacity-50">{formatSize(f.size)}</span>
            </button>
            <button type="button" className="btn btn-xs btn-square absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title={`Delete ${f.name}`} aria-label={`Delete ${f.name}`} onClick={() => onDelete(f.name)}>
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
      <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-base-300 text-xs opacity-70 hover:opacity-100"
             title="Add files: data, images, fonts. Or drop them here (or into the editor, to refer to them there)">
        <Plus size={18} />Add
        <input type="file" multiple className="hidden" onChange={(e) => {
          const picked = [...(e.target.files ?? [])];
          e.target.value = '';
          onAdd(picked);
        }} />
      </label>
    </div>
  );
}
