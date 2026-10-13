import type { CollectionType } from './types';

export const COLLECTION_WATCHED: CollectionType = 2;

export const COLLECTION_LABELS: Record<CollectionType, string> = {
  1: '想看',
  2: '看过',
  3: '在看',
  4: '搁置',
  5: '抛弃',
};

export const COLLECTION_CLASSES: Record<CollectionType, string> = {
  1: 'badge-wish',
  2: 'badge-collect',
  3: 'badge-doing',
  4: 'badge-hold',
  5: 'badge-dropped',
};

export function isWatched(type: CollectionType | undefined): boolean {
  return type === COLLECTION_WATCHED;
}
