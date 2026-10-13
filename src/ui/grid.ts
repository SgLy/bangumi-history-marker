import { COLLECTION_CLASSES, COLLECTION_LABELS, isWatched } from '../collection';
import type { AppState, SeasonData, Store } from '../state';
import type { Subject } from '../types';
import { h, signatureOf } from './dom';

interface GridCallbacks {
  onToggle: (subject: Subject) => void;
  onOpenRelated: (subject: Subject) => void;
  onLoadMore: () => void;
}

interface Entry {
  root: HTMLElement;
  badge: HTMLSpanElement;
  series: HTMLButtonElement;
  badgeBase: string;
  lastSelected: boolean;
  lastWatched: boolean;
  lastHasRelated: boolean;
  lastLabel: string | null;
}

interface Grid {
  element: HTMLElement;
  dispose: () => void;
}

const CARD_LIMIT = 48;

export function createGrid(store: Store, callbacks: GridCallbacks): Grid {
  const grid = h('div', { className: 'grid' });
  const rows = h('div', { className: 'subject-rows' });
  const footer = h('div', { className: 'grid-footer' });
  const element = h('section', { className: 'grid-wrap' }, [grid, rows, footer]);
  const cards = new Map<number, Entry>();
  const rowEntries = new Map<number, Entry>();
  let lastSignature: string | null = null;

  const unsubscribe = store.subscribe(render);

  function render(): void {
    const state = store.get();
    const data = state.seasonCache.get(state.activeSeason);
    const signature = signatureOf([
      state.activeSeason,
      data?.subjects.length ?? -1,
      data?.total ?? -1,
      data?.loading ? 1 : 0,
      data?.loaded ? 1 : 0,
      data?.error ?? '',
    ]);
    if (signature !== lastSignature) {
      lastSignature = signature;
      rebuild(data);
    }
    updateStates();
  }

  function rebuild(data: SeasonData | undefined): void {
    cards.clear();
    rowEntries.clear();
    grid.replaceChildren();
    rows.replaceChildren();

    if (!data || (data.loading && data.subjects.length === 0)) {
      for (let index = 0; index < 12; index += 1) {
        grid.append(h('div', { className: 'card card-skeleton' }));
      }
    } else if (data.subjects.length === 0) {
      if (data.error !== null) {
        grid.append(
          h('div', { className: 'grid-error' }, [
            h('p', { className: 'grid-empty', text: data.error }),
            createRetryButton(),
          ]),
        );
      } else {
        grid.append(h('p', { className: 'grid-empty', text: '这个季度没有找到动画。' }));
      }
    } else {
      for (const subject of data.subjects.slice(0, CARD_LIMIT)) {
        grid.append(createCard(subject));
      }
      const rest = data.subjects.slice(CARD_LIMIT);
      for (const subject of rest) rows.append(createRow(subject));
    }

    footer.replaceChildren();
    if (!data) return;
    if (data.loading && data.subjects.length > 0) {
      footer.append(h('span', { className: 'grid-more-text', text: '加载中…' }));
    } else if (data.error !== null && data.subjects.length > 0) {
      footer.append(
        h('span', { className: 'grid-more-text grid-error-text', text: data.error }),
        createRetryButton(),
      );
    } else if (data.subjects.length < data.total) {
      const more = h('button', {
        className: 'btn btn-ghost',
        text: `加载更多（${data.subjects.length} / ${data.total}）`,
        attrs: { type: 'button' },
      });
      more.addEventListener('click', () => callbacks.onLoadMore());
      footer.append(more);
    } else if (data.subjects.length > 0) {
      footer.append(h('span', { className: 'grid-more-text', text: '已加载全部' }));
    }
  }

  function createRetryButton(): HTMLButtonElement {
    const retry = h('button', {
      className: 'btn btn-ghost',
      text: '重试',
      attrs: { type: 'button' },
    });
    retry.addEventListener('click', () => callbacks.onLoadMore());
    return retry;
  }

  function createCard(subject: Subject): HTMLElement {
    const cover = h('div', { className: 'card-cover' });
    cover.append(coverContent(subject));
    cover.append(h('span', { className: 'card-check', text: '✓' }));
    const badgeBase = 'card-badge badge';
    const badge = h('span', { className: badgeBase, attrs: { hidden: 'hidden' } });
    cover.append(badge);
    if (subject.eps > 0) {
      cover.append(h('span', { className: 'card-eps', text: `${subject.eps}话` }));
    }

    const series = h('button', {
      className: 'card-series',
      text: '系列',
      attrs: { type: 'button', title: '选择关联作品', hidden: 'hidden' },
    });
    series.addEventListener('click', (event) => {
      event.stopPropagation();
      callbacks.onOpenRelated(subject);
    });
    cover.append(series);

    const body = h('div', { className: 'card-body' }, [
      h('div', { className: 'card-title', text: subject.name_cn || subject.name }),
      h('div', { className: 'card-meta' }, buildCardMeta(subject)),
    ]);

    const root = h('div', {
      className: 'card',
      attrs: { role: 'button', tabindex: '0' },
    }, [cover, body]);
    bindActivate(root, subject);

    cards.set(subject.id, {
      root,
      badge,
      series,
      badgeBase,
      lastSelected: false,
      lastWatched: false,
      lastHasRelated: false,
      lastLabel: null,
    });
    return root;
  }

  function createRow(subject: Subject): HTMLElement {
    const badgeBase = 'badge';
    const badge = h('span', { className: badgeBase, attrs: { hidden: 'hidden' } });
    const series = h('button', {
      className: 'subject-row-series',
      text: '系列',
      attrs: { type: 'button', title: '选择关联作品', hidden: 'hidden' },
    });
    series.addEventListener('click', (event) => {
      event.stopPropagation();
      callbacks.onOpenRelated(subject);
    });

    const root = h('div', {
      className: 'subject-row',
      attrs: { role: 'button', tabindex: '0' },
    }, [
      h('span', { className: 'subject-row-name', text: subject.name_cn || subject.name }),
      h('span', { className: 'subject-row-meta' }, buildRowMeta(subject)),
      badge,
      series,
    ]);
    bindActivate(root, subject);

    rowEntries.set(subject.id, {
      root,
      badge,
      series,
      badgeBase,
      lastSelected: false,
      lastWatched: false,
      lastHasRelated: false,
      lastLabel: null,
    });
    return root;
  }

  function coverContent(subject: Subject): Node {
    if (subject.images.common) {
      const image = h('img', {
        attrs: {
          src: subject.images.common,
          alt: subject.name_cn || subject.name,
          loading: 'lazy',
        },
      });
      image.addEventListener('error', () => {
        image.replaceWith(placeholder(subject));
      });
      return image;
    }
    return placeholder(subject);
  }

  function buildCardMeta(subject: Subject): Node[] {
    const total =
      subject.collection.wish +
      subject.collection.collect +
      subject.collection.doing +
      subject.collection.on_hold +
      subject.collection.dropped;
    return [h('span', { text: `收藏 ${total}` })];
  }

  function buildRowMeta(subject: Subject): Node[] {
    const meta = buildCardMeta(subject);
    if (subject.eps > 0) meta.push(h('span', { text: `${subject.eps}话` }));
    return meta;
  }

  function bindActivate(root: HTMLElement, subject: Subject): void {
    root.addEventListener('click', () => {
      if (isLocked(subject.id)) return;
      callbacks.onToggle(subject);
    });
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (isLocked(subject.id)) return;
      callbacks.onToggle(subject);
    });
  }

  function isLocked(id: number): boolean {
    return isWatched(store.get().collections.get(id));
  }

  function updateStates(): void {
    const state = store.get();
    for (const [id, entry] of cards) applyEntry(id, entry, state);
    for (const [id, entry] of rowEntries) applyEntry(id, entry, state);
  }

  function applyEntry(id: number, entry: Entry, state: AppState): void {
    const selected = state.selected.has(id);
    if (selected !== entry.lastSelected) {
      entry.root.classList.toggle('is-selected', selected);
      entry.lastSelected = selected;
    }
    const type = state.collections.get(id);
    const watched = isWatched(type);
    if (watched !== entry.lastWatched) {
      entry.root.classList.toggle('is-owned', watched);
      entry.lastWatched = watched;
    }
    const related = state.relatedCache.get(id);
    const hasRelated = related !== undefined && related.length > 0;
    if (hasRelated !== entry.lastHasRelated) {
      entry.series.hidden = !hasRelated;
      entry.lastHasRelated = hasRelated;
    }
    const label = type === undefined ? null : COLLECTION_LABELS[type];
    if (label !== entry.lastLabel) {
      if (type === undefined) {
        entry.badge.hidden = true;
        entry.badge.textContent = '';
        entry.badge.className = entry.badgeBase;
      } else {
        entry.badge.hidden = false;
        entry.badge.textContent = label;
        entry.badge.className = `${entry.badgeBase} ${COLLECTION_CLASSES[type]}`;
      }
      entry.lastLabel = label;
    }
  }

  render();
  return { element, dispose: unsubscribe };
}

function placeholder(subject: Subject): HTMLElement {
  return h('div', { className: 'cover-placeholder' }, [
    h('span', { text: subject.name_cn || subject.name }),
  ]);
}
