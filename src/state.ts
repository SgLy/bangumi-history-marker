import type {
  CollectionType,
  Me,
  RelatedSubject,
  SelectedItem,
  Subject,
} from './types';

export interface SeasonData {
  subjects: Subject[];
  total: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

export interface SubmitProgress {
  phase: 'private' | 'public';
  current: number;
  total: number;
}

export interface AppState {
  token: string | null;
  me: Me | null;
  collections: Map<number, CollectionType>;
  syncingCollections: boolean;
  selected: Map<number, SelectedItem>;
  seasonCache: Map<string, SeasonData>;
  relatedCache: Map<number, RelatedSubject[]>;
  activeSeason: string;
  submitting: boolean;
  progress: SubmitProgress | null;
}

export function createInitialState(activeSeason: string): AppState {
  return {
    token: null,
    me: null,
    collections: new Map(),
    syncingCollections: false,
    selected: new Map(),
    seasonCache: new Map(),
    relatedCache: new Map(),
    activeSeason,
    submitting: false,
    progress: null,
  };
}

export type AppStatePatch = { [K in keyof AppState]?: AppState[K] };

export class Store {
  private state: AppState;
  private readonly listeners = new Set<() => void>();

  constructor(initial: AppState) {
    this.state = initial;
  }

  get(): AppState {
    return this.state;
  }

  update(patch: AppStatePatch): void {
    this.mutate((state) => {
      Object.assign(state, patch);
    });
  }

  mutate(mutation: (state: AppState) => void): void {
    mutation(this.state);
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
