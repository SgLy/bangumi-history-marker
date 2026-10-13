import type { AppState, SeasonData } from './state';
import type {
  CollectionType,
  RelatedSubject,
  SelectedItem,
  Subject,
} from './types';

const STATE_PREFIX = 'bgm-marker-state:';
const COLLECTIONS_PREFIX = 'bgm-marker-collections:';
export const RELATED_CACHE_MAX = 300;
const SAVE_DELAY = 500;

interface PersistedSubject {
  id: number;
  name: string;
  name_cn: string;
  date: string | null;
  platform: string;
  images: Subject['images'];
  rating: Subject['rating'];
  collection: Subject['collection'];
  eps: number;
}

interface PersistedSeason {
  total: number;
  loaded: boolean;
  subjects: PersistedSubject[];
}

interface PersistedState {
  selected: Array<[number, SelectedItem]>;
  relatedCache: Array<[number, RelatedSubject[]]>;
  seasonCache: Array<[string, PersistedSeason]>;
  activeSeason: string;
}

export interface PersistedBusinessState {
  selected: Map<number, SelectedItem>;
  relatedCache: Map<number, RelatedSubject[]>;
  seasonCache: Map<string, SeasonData>;
  activeSeason: string | null;
}

export interface StatePersister {
  schedule(): void;
  cancel(): void;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

function collectionsKey(username: string): string {
  return `${COLLECTIONS_PREFIX}${username}`;
}

export function loadCollections(username: string): Map<number, CollectionType> | null {
  const raw = safeGet(collectionsKey(username));
  if (raw === null) return null;
  try {
    const entries = JSON.parse(raw) as Array<[number, CollectionType]>;
    return new Map(entries);
  } catch {
    return null;
  }
}

export function saveCollections(
  username: string,
  collections: Map<number, CollectionType>,
): void {
  try {
    window.localStorage.setItem(
      collectionsKey(username),
      JSON.stringify([...collections.entries()]),
    );
  } catch {}
}

function serializeSeason(data: SeasonData): PersistedSeason {
  return {
    total: data.total,
    loaded: data.loaded,
    subjects: data.subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      name_cn: subject.name_cn,
      date: subject.date,
      platform: subject.platform,
      images: subject.images,
      rating: subject.rating,
      collection: subject.collection,
      eps: subject.eps,
    })),
  };
}

function deserializeSeason(raw: PersistedSeason): SeasonData {
  return {
    total: raw.total,
    loaded: raw.loaded,
    loading: false,
    error: null,
    subjects: raw.subjects,
  };
}

export function loadState(username: string): PersistedBusinessState | null {
  const raw = safeGet(`${STATE_PREFIX}${username}`);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const related = (parsed.relatedCache ?? []).slice(-RELATED_CACHE_MAX);
    const seasonCache = new Map<string, SeasonData>();
    for (const [key, value] of parsed.seasonCache ?? []) {
      seasonCache.set(key, deserializeSeason(value));
    }
    return {
      selected: new Map(parsed.selected ?? []),
      relatedCache: new Map(related),
      seasonCache,
      activeSeason: parsed.activeSeason ?? null,
    };
  } catch {
    return null;
  }
}

export function createStatePersister(
  username: string,
  read: () => AppState,
): StatePersister {
  const key = `${STATE_PREFIX}${username}`;
  let timer: number | null = null;

  const write = (): void => {
    timer = null;
    const state = read();
    const payload: PersistedState = {
      selected: [...state.selected.entries()],
      relatedCache: [...state.relatedCache.entries()].slice(-RELATED_CACHE_MAX),
      seasonCache: [...state.seasonCache.entries()].map(([season, data]) => [
        season,
        serializeSeason(data),
      ]),
      activeSeason: state.activeSeason,
    };
    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {
      if (!isQuotaError(error)) return;
      // seasonCache 是最大且可再生的一块，配额紧张时优先丢弃，交互不被持久化失败阻塞
      try {
        window.localStorage.setItem(key, JSON.stringify({ ...payload, seasonCache: [] }));
      } catch {}
    }
  };

  return {
    schedule() {
      if (timer !== null) return;
      timer = window.setTimeout(write, SAVE_DELAY);
    },
    cancel() {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    },
  };
}
