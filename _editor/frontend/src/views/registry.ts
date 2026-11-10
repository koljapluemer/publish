import type { ComponentType } from 'react';
import { TheaDocView } from './TheaDocView';
import { TypstDocView } from './TypstDocView';

/** What a path in the repo opens in: the first view whose `match` takes it. Bespoke views per folder go here. */
export type ViewProps = { path: string; navigate: (path: string) => void; onDirty: (dirty: boolean) => void };
export type View = { match: (path: string) => boolean; component: ComponentType<ViewProps> };

export const views: View[] = [
  { match: (path) => path === 'thea' || path.startsWith('thea/'), component: TheaDocView },
  { match: (path) => path === 'typst' || path.startsWith('typst/'), component: TypstDocView },
];

export const DEFAULT_PATH = 'thea';
