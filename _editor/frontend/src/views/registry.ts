import type { ComponentType } from 'react';
import { TheaDocView } from './TheaDocView';

/** What a path in the repo opens in: the first view whose `match` takes it. Bespoke views per folder go here. */
export type View = { match: (path: string) => boolean; component: ComponentType<{ path: string; navigate: (path: string) => void }> };

export const views: View[] = [
  { match: (path) => path === 'thea' || path.startsWith('thea/'), component: TheaDocView },
];

export const DEFAULT_PATH = 'thea';
