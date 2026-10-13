import './style.css';
import * as api from './api';
import { COLLECTION_WATCHED, isWatched } from './collection';
import { mapLimit } from './concurrency';
import {
  createStatePersister,
  loadCollections,
  loadState,
  RELATED_CACHE_MAX,
  saveCollections,
} from './persistence';
import { addSeasons, currentSeason } from './seasons';
import {
  createInitialState,
  Store,
  type AppState,
  type AppStatePatch,
  type SeasonData,
  type SubmitProgress,
} from './state';
import type { CollectionType, Me, RelatedSubject, Subject, SubjectRef } from './types';
import { createBatchBar } from './ui/batchBar';
import { h } from './ui/dom';
import { createGrid } from './ui/grid';
import { createHeader } from './ui/header';
import { createOnboarding } from './ui/onboarding';
import { closeRelatedSheet, openRelatedSheet, type RelatedView } from './ui/relatedSheet';
import { bindSeasonNavigation } from './ui/seasonNavigate';
import { createSeasonBar } from './ui/seasonBar';
import { createToaster } from './ui/toast';

const TOKEN_KEY = 'bgm-marker-token';
const CHAIN_RELATIONS = new Set(['续集', '前传', '主线故事']);
const RELATED_CHAIN_MAX = 40;

const appRoot = requireElement('app');

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`未找到 #${id} 容器`);
  return element;
}

const toaster = createToaster();
const store = new Store(createInitialState(currentSeason()));

let cleanups: Array<() => void> = [];

interface RelatedStream {
  items: RelatedSubject[];
  loaded: boolean;
  error: string | null;
  listeners: Set<(view: RelatedView) => void>;
}

const relatedStreams = new Map<number, RelatedStream>();

function notifyStream(stream: RelatedStream): void {
  const view: RelatedView = { items: stream.items, loaded: stream.loaded, error: stream.error };
  for (const listener of stream.listeners) listener(view);
}

function resetScreen(): void {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
  closeRelatedSheet();
  toaster.dispose();
}

function isSameSession(token: string | null, username: string | undefined): boolean {
  const state = store.get();
  return state.token === token && state.me?.username === username;
}

function displayName(item: SubjectRef): string {
  return item.name_cn || item.name;
}

function applyPersisted(username: string): AppStatePatch {
  const saved = loadState(username);
  if (saved === null) return {};
  return {
    selected: saved.selected,
    relatedCache: saved.relatedCache,
    seasonCache: saved.seasonCache,
    activeSeason: saved.activeSeason ?? currentSeason(),
  };
}

function showOnboarding(message?: string): void {
  resetScreen();
  document.body.classList.remove('app-mode');
  appRoot.replaceChildren(
    createOnboarding({
      onVerified: (token, me) => {
        window.localStorage.setItem(TOKEN_KEY, token);
        store.update(applyPersisted(me.username));
        store.update({ token, me });
        showApp();
      },
      ...(message !== undefined ? { message } : {}),
    }),
  );
}

function showApp(): void {
  const me = store.get().me;
  if (me === null) {
    showOnboarding();
    return;
  }
  resetScreen();
  document.body.classList.add('app-mode');

  const syncBanner = h('div', { className: 'sync-banner', text: '正在同步收藏状态…' });

  function selectSeason(season: string): void {
    if (season > currentSeason()) return;
    closeRelatedSheet();
    store.update({ activeSeason: season });
    seasonBar.revealActive(season);
    void ensureSeason(season);
  }

  const seasonBar = createSeasonBar(store.get().activeSeason, selectSeason);

  const grid = createGrid(store, {
    onToggle: handleSelectToggle,
    onOpenRelated: handleOpenRelated,
    onLoadMore: handleLoadMore,
  });
  const batchBar = createBatchBar(store, {
    onClear: handleClear,
    onRemove: handleRemove,
    onOlderSeason: () => selectSeason(addSeasons(store.get().activeSeason, -1)),
    onNewerSeason: () => selectSeason(addSeasons(store.get().activeSeason, 1)),
    onSubmit: () => {
      void handleSubmit();
    },
  });

  appRoot.replaceChildren(
    createHeader(me, handleLogout),
    syncBanner,
    seasonBar.element,
    grid.element,
    batchBar.element,
  );

  const updateSyncBanner = (): void => {
    syncBanner.hidden = !store.get().syncingCollections;
  };
  const stepSeason = (delta: 1 | -1): void => {
    selectSeason(addSeasons(store.get().activeSeason, delta));
  };
  cleanups.push(bindSeasonNavigation(grid.element, stepSeason));

  cleanups.push(store.subscribe(updateSyncBanner));
  cleanups.push(grid.dispose);
  cleanups.push(batchBar.dispose);
  updateSyncBanner();

  const persister = createStatePersister(me.username, () => store.get());
  const unsubscribePersister = store.subscribe(() => persister.schedule());
  cleanups.push(() => {
    persister.cancel();
    unsubscribePersister();
  });

  void ensureSeason(store.get().activeSeason);
  loadOrSyncCollections(me, syncBanner);
}

function mutateSeason(season: string, mutation: (data: SeasonData) => void): void {
  store.mutate((state) => {
    const data = state.seasonCache.get(season);
    if (data === undefined) return;
    mutation(data);
  });
}

async function ensureSeason(season: string): Promise<void> {
  let data = store.get().seasonCache.get(season);
  if (data === undefined) {
    const initial: SeasonData = {
      subjects: [],
      total: 0,
      loading: false,
      loaded: false,
      error: null,
    };
    store.mutate((state) => {
      state.seasonCache.set(season, initial);
    });
    data = initial;
  }
  if (data.loading || data.loaded) return;

  const offset = data.subjects.length;
  mutateSeason(season, (entry) => {
    entry.loading = true;
  });
  try {
    const result = await api.searchSubjects(season, offset);
    mutateSeason(season, (entry) => {
      entry.total = result.total;
      entry.subjects = entry.subjects.concat(result.data);
      entry.loaded = entry.subjects.length >= result.total || result.data.length === 0;
      entry.error = null;
    });
  } catch (error) {
    mutateSeason(season, (entry) => {
      entry.error = api.errorMessage(error);
    });
  } finally {
    mutateSeason(season, (entry) => {
      entry.loading = false;
    });
  }
}

function handleLoadMore(): void {
  closeRelatedSheet();
  void ensureSeason(store.get().activeSeason);
}

function handleSelectToggle(subject: Subject): void {
  const state = store.get();
  if (state.submitting) return;
  if (isWatched(state.collections.get(subject.id))) return;

  if (state.selected.has(subject.id)) {
    store.mutate((current) => {
      current.selected.delete(subject.id);
      for (const [id, item] of current.selected) {
        if (item.originSubjectId === subject.id) current.selected.delete(id);
      }
    });
    return;
  }
  store.mutate((current) => {
    current.selected.set(subject.id, { subject });
  });
  openRelated(subject);
}

function handleOpenRelated(subject: Subject): void {
  if (store.get().submitting) return;
  openRelated(subject);
}

function subscribeRelated(id: number, listener: (view: RelatedView) => void): () => void {
  const cached = store.get().relatedCache.get(id);
  if (cached !== undefined) {
    listener({ items: cached, loaded: true, error: null });
    return () => {};
  }
  let stream = relatedStreams.get(id);
  if (stream === undefined) {
    stream = { items: [], loaded: false, error: null, listeners: new Set() };
    relatedStreams.set(id, stream);
    void runRelated(id, stream);
  }
  const relatedStream = stream;
  relatedStream.listeners.add(listener);
  listener({
    items: relatedStream.items,
    loaded: relatedStream.loaded,
    error: relatedStream.error,
  });
  return () => {
    relatedStream.listeners.delete(listener);
  };
}

async function runRelated(id: number, stream: RelatedStream): Promise<void> {
  const chain: RelatedSubject[] = [];
  const other: RelatedSubject[] = [];
  const seen = new Set<number>([id]);
  const dateTasks: Promise<void>[] = [];
  const snapshot = store.get();
  const token = snapshot.token;
  const username = snapshot.me?.username;
  const publish = (): void => {
    stream.items = [...sortByDateAsc(chain), ...sortByDateAsc(other)];
    notifyStream(stream);
  };
  const enrich = (nodes: readonly RelatedSubject[]): void => {
    dateTasks.push(enrichDates(nodes, publish));
  };

  try {
    const level1 = await api.getRelatedSubjects(id);
    const frontier: RelatedSubject[] = [];
    for (const item of level1.slice(0, RELATED_CHAIN_MAX)) {
      if (item.type !== api.SUBJECT_TYPE_ANIME || seen.has(item.id)) continue;
      seen.add(item.id);
      if (CHAIN_RELATIONS.has(item.relation)) {
        chain.push(item);
        frontier.push(item);
      } else {
        other.push(item);
      }
    }
    publish();
    enrich([...chain, ...other]);

    let level = frontier;
    while (level.length > 0 && chain.length + other.length < RELATED_CHAIN_MAX) {
      const remaining = RELATED_CHAIN_MAX - chain.length - other.length;
      const batch = level.slice(0, remaining);
      const lists = await mapLimit(batch, (node) => api.getRelatedSubjects(node.id));
      const next: RelatedSubject[] = [];
      for (const list of lists) {
        for (const item of list) {
          if (chain.length + other.length >= RELATED_CHAIN_MAX) break;
          if (
            item.type !== api.SUBJECT_TYPE_ANIME ||
            !CHAIN_RELATIONS.has(item.relation) ||
            seen.has(item.id)
          ) {
            continue;
          }
          seen.add(item.id);
          chain.push(item);
          next.push(item);
        }
      }
      level = next;
      publish();
      if (next.length > 0) enrich(next);
    }

    await Promise.all(dateTasks);
    stream.loaded = true;
    publish();
    if (isSameSession(token, username)) cacheRelated(id, stream.items);
  } catch (error) {
    stream.error = api.errorMessage(error);
    stream.loaded = true;
    notifyStream(stream);
  } finally {
    if (relatedStreams.get(id) === stream) relatedStreams.delete(id);
  }
}

async function enrichDates(nodes: readonly RelatedSubject[], publish: () => void): Promise<void> {
  const pending = nodes.filter((node) => !node.date);
  await mapLimit(pending, async (node) => {
    try {
      const detail = await api.getSubject(node.id);
      if (!node.date) node.date = detail.date;
    } catch {
      // 单条详情失败不影响其余条目，date 保持未知
    }
    publish();
  });
}

function sortByDateAsc(items: readonly RelatedSubject[]): RelatedSubject[] {
  return [...items].sort((a, b) => {
    const da = a.date ?? '';
    const db = b.date ?? '';
    if (da === db) return 0;
    if (da === '') return 1;
    if (db === '') return -1;
    return da < db ? -1 : 1;
  });
}

function cacheRelated(id: number, items: RelatedSubject[]): void {
  store.mutate((state) => {
    state.relatedCache.set(id, items);
    while (state.relatedCache.size > RELATED_CACHE_MAX) {
      const oldest = state.relatedCache.keys().next().value;
      if (oldest === undefined) break;
      state.relatedCache.delete(oldest);
    }
  });
}

function openRelated(subject: Subject): void {
  const cached = store.get().relatedCache.get(subject.id);
  if (cached !== undefined && cached.length === 0) return;
  openRelatedSheet({
    title: displayName(subject),
    subscribe: (listener) => subscribeRelated(subject.id, listener),
    getCollection: (id) => store.get().collections.get(id),
    isSelected: (id) => store.get().selected.has(id),
    onToggle: (item, checked) => {
      store.mutate((state) => {
        if (checked) state.selected.set(item.id, { subject: item, originSubjectId: subject.id });
        else state.selected.delete(item.id);
      });
    },
    onSelectAllUnmarked: (items) => {
      let added = 0;
      store.mutate((state) => {
        for (const item of items) {
          if (state.collections.has(item.id)) continue;
          if (state.selected.has(item.id)) continue;
          state.selected.set(item.id, { subject: item, originSubjectId: subject.id });
          added += 1;
        }
      });
      return added;
    },
  });
}

function handleClear(): void {
  if (store.get().submitting) return;
  store.mutate((state) => {
    state.selected.clear();
  });
}

function handleRemove(id: number): void {
  if (store.get().submitting) return;
  store.mutate((state) => {
    state.selected.delete(id);
  });
}

function pruneWatched(state: AppState, collections: Map<number, CollectionType>): void {
  for (const id of state.selected.keys()) {
    if (isWatched(collections.get(id))) state.selected.delete(id);
  }
}

function loadOrSyncCollections(me: Me, syncBanner: HTMLElement): void {
  const cached = loadCollections(me.username);
  if (cached !== null) {
    store.mutate((state) => {
      pruneWatched(state, cached);
      state.collections = cached;
    });
    return;
  }
  void syncCollections(me, syncBanner);
}

async function syncCollections(me: Me, syncBanner: HTMLElement): Promise<void> {
  const token = store.get().token;
  if (token === null) return;
  const username = me.username;
  store.update({ syncingCollections: true });
  try {
    const { items, complete } = await api.getUserCollections(username, token, (loaded, total) => {
      syncBanner.textContent = `正在同步收藏状态… ${loaded} / ${total}`;
    });
    if (!isSameSession(token, username)) return;
    const collections = new Map<number, CollectionType>();
    for (const collection of items) collections.set(collection.subject_id, collection.type);
    if (complete) saveCollections(username, collections);
    store.mutate((state) => {
      pruneWatched(state, collections);
      state.collections = collections;
    });
  } catch (error) {
    if (!isSameSession(token, username)) return;
    toaster.show(`同步收藏状态失败：${api.errorMessage(error)}`, 'error');
  } finally {
    if (isSameSession(token, username)) store.update({ syncingCollections: false });
  }
}

interface SubmitResult {
  item: SubjectRef;
  ok: boolean;
  error?: string;
}

function formatFailures(results: readonly SubmitResult[]): string {
  const shown = results
    .slice(0, 3)
    .map((result) => `${displayName(result.item)}（${result.error ?? '未知错误'}）`)
    .join('；');
  return results.length > 3 ? `${shown} 等 ${results.length} 部` : shown;
}

async function runPhase(
  phase: SubmitProgress['phase'],
  items: readonly SubjectRef[],
  call: (item: SubjectRef) => Promise<void>,
): Promise<SubmitResult[]> {
  let done = 0;
  const total = items.length;
  store.update({ progress: { phase, current: 0, total } });
  return mapLimit(items, async (item): Promise<SubmitResult> => {
    try {
      await call(item);
      done += 1;
      store.update({ progress: { phase, current: done, total } });
      return { item, ok: true };
    } catch (error) {
      done += 1;
      store.update({ progress: { phase, current: done, total } });
      return { item, ok: false, error: api.errorMessage(error) };
    }
  });
}

async function handleSubmit(): Promise<void> {
  const state = store.get();
  const token = state.token;
  if (token === null || state.submitting) return;
  const items = [...state.selected.values()].map((entry) => entry.subject);
  if (items.length === 0) return;

  closeRelatedSheet();

  // 两阶段提交：bangumi 收藏事件会进入公开/好友时间线，先私密再公开是产品要求，防止刷屏
  store.update({ submitting: true, progress: { phase: 'private', current: 0, total: items.length } });

  let privateResults: SubmitResult[];
  let publicResults: SubmitResult[];
  try {
    privateResults = await runPhase('private', items, (item) =>
      api.markAsPrivate(item.id, token),
    );
    const privateOk = privateResults.filter((result) => result.ok);
    publicResults = await runPhase('public', privateOk.map((result) => result.item), (item) =>
      api.unmarkPrivate(item.id, token),
    );
  } catch (error) {
    store.update({ submitting: false, progress: null });
    toaster.show(`提交失败：${api.errorMessage(error)}`, 'error');
    return;
  }

  let marked = 0;
  store.mutate((current) => {
    for (const result of publicResults) {
      if (!result.ok) continue;
      marked += 1;
      current.selected.delete(result.item.id);
      current.collections.set(result.item.id, COLLECTION_WATCHED);
    }
    current.submitting = false;
    current.progress = null;
  });

  if (marked > 0) {
    const snapshot = store.get();
    const username = snapshot.me?.username;
    if (username !== undefined) saveCollections(username, snapshot.collections);
    toaster.show(`已标记 ${marked} 部`);
  }

  const privateFailed = privateResults.filter((result) => !result.ok);
  if (privateFailed.length > 0) {
    toaster.show(`标记失败：${formatFailures(privateFailed)}`, 'error');
  }
  const publicFailed = publicResults.filter((result) => !result.ok);
  if (publicFailed.length > 0) {
    toaster.show(`部分条目仍为私密，可重新提交修复：${formatFailures(publicFailed)}`, 'error');
  }
}

function handleLogout(): void {
  if (store.get().submitting) {
    toaster.show('正在提交，请稍候…');
    return;
  }
  resetScreen();
  window.localStorage.removeItem(TOKEN_KEY);
  store.update({
    token: null,
    me: null,
    collections: new Map(),
    selected: new Map(),
    seasonCache: new Map(),
    relatedCache: new Map(),
    activeSeason: currentSeason(),
    syncingCollections: false,
    submitting: false,
    progress: null,
  });
  showOnboarding();
}

async function bootstrap(): Promise<void> {
  const saved = window.localStorage.getItem(TOKEN_KEY);
  if (saved === null) {
    showOnboarding();
    return;
  }
  store.update({ token: saved });
  try {
    const me = await api.verifyToken(saved);
    store.update(applyPersisted(me.username));
    store.update({ me });
    showApp();
  } catch (error) {
    if (!api.isUnauthorized(error)) {
      store.update({ token: null, me: null });
      showOnboarding(`验证 Token 失败：${api.errorMessage(error)}`);
      return;
    }
    window.localStorage.removeItem(TOKEN_KEY);
    store.update({ token: null, me: null });
    showOnboarding('登录状态已失效，请重新验证 Token');
  }
}

void bootstrap();
