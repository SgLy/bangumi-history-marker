import { COLLECTION_CLASSES, COLLECTION_LABELS, isWatched } from '../collection';
import type { CollectionType, RelatedSubject } from '../types';
import { h } from './dom';

export interface RelatedView {
  items: readonly RelatedSubject[];
  loaded: boolean;
  error: string | null;
}

interface RelatedSheetOptions {
  title: string;
  subscribe: (listener: (view: RelatedView) => void) => () => void;
  getCollection: (id: number) => CollectionType | undefined;
  isSelected: (id: number) => boolean;
  onToggle: (item: RelatedSubject, checked: boolean) => void;
  onSelectAllUnmarked: (items: readonly RelatedSubject[]) => number;
}

interface OpenSheet {
  element: HTMLElement;
  cleanup: () => void;
}

interface ItemEntry {
  root: HTMLElement;
  checkbox: HTMLInputElement;
  date: HTMLElement;
  item: RelatedSubject;
  lastChecked: boolean;
  lastDisabled: boolean;
  lastDate: string;
}

let current: OpenSheet | null = null;

export function closeRelatedSheet(): void {
  if (current === null) return;
  current.cleanup();
  current.element.remove();
  document.body.classList.remove('sheet-open');
  current = null;
}

function formatDate(item: RelatedSubject): string {
  return item.date ?? '日期未知';
}

export function openRelatedSheet(options: RelatedSheetOptions): void {
  closeRelatedSheet();

  const count = h('span', { className: 'related-count' });
  const loading = h('div', { className: 'related-loading' }, [
    h('span', { className: 'spinner' }),
    h('span', { text: '读取关联中…' }),
  ]);
  const notice = h('div', { className: 'related-notice' });
  const list = h('div', { className: 'related-list' });
  const entries = new Map<number, ItemEntry>();
  let items: readonly RelatedSubject[] = [];
  let lastCount = '';
  let lastLoadingHidden = false;
  let lastNotice = '';

  function refreshCount(): void {
    const selected = items.filter((item) => options.isSelected(item.id)).length;
    const text = `已选 ${selected} / ${items.length} 项`;
    if (text !== lastCount) {
      count.textContent = text;
      lastCount = text;
    }
  }

  function syncItem(entry: ItemEntry): void {
    const checked = options.isSelected(entry.item.id);
    if (checked !== entry.lastChecked) {
      entry.checkbox.checked = checked;
      entry.lastChecked = checked;
    }
    const disabled = isWatched(options.getCollection(entry.item.id));
    if (disabled !== entry.lastDisabled) {
      entry.checkbox.disabled = disabled;
      entry.lastDisabled = disabled;
    }
    const dateText = formatDate(entry.item);
    if (dateText !== entry.lastDate) {
      entry.date.textContent = dateText;
      entry.lastDate = dateText;
    }
  }

  function createItem(item: RelatedSubject): ItemEntry {
    const collection = options.getCollection(item.id);
    const checkbox = h('input', { attrs: { type: 'checkbox' } });
    checkbox.addEventListener('change', () => {
      options.onToggle(item, checkbox.checked);
      refreshCount();
    });

    const cover = h('span', { className: 'related-cover' });
    if (item.images?.common) {
      const image = h('img', {
        attrs: { src: item.images.common, alt: item.name_cn || item.name, loading: 'lazy' },
      });
      image.addEventListener('error', () => image.remove());
      cover.append(image);
    }

    const date = h('span', { className: 'related-date' });
    const info = h('span', { className: 'related-info' }, [
      h('span', { className: 'related-name', text: item.name_cn || item.name }),
      h('span', { className: 'related-sub' }, [
        h('span', { className: 'related-tag', text: item.relation }),
        date,
      ]),
    ]);

    const children: Array<Node> = [checkbox, cover, info];
    if (collection !== undefined) {
      children.push(
        h('span', {
          className: `badge ${COLLECTION_CLASSES[collection]}`,
          text: COLLECTION_LABELS[collection],
        }),
      );
    }
    const root = h(
      'label',
      { className: `related-item${isWatched(collection) ? ' is-owned' : ''}` },
      children,
    );
    list.append(root);
    const entry: ItemEntry = {
      root,
      checkbox,
      date,
      item,
      lastChecked: checkbox.checked,
      lastDisabled: checkbox.disabled,
      lastDate: '',
    };
    syncItem(entry);
    return entry;
  }

  function reconcile(order: readonly number[]): void {
    let cursor: Node | null = list.firstChild;
    for (const id of order) {
      const entry = entries.get(id);
      if (entry === undefined) {
        throw new Error(`关联条目不存在：${id}`);
      }
      if (entry.root === cursor) {
        cursor = cursor.nextSibling;
      } else {
        list.insertBefore(entry.root, cursor);
      }
    }
  }

  function applyView(view: RelatedView): void {
    if (view.error === null && view.loaded && view.items.length === 0) {
      closeRelatedSheet();
      return;
    }
    items = view.items;
    for (const item of view.items) {
      const existing = entries.get(item.id);
      if (existing === undefined) {
        entries.set(item.id, createItem(item));
      } else {
        existing.item = item;
        syncItem(existing);
      }
    }
    reconcile(view.items.map((item) => item.id));

    const loadingHidden = view.loaded || view.error !== null;
    if (loadingHidden !== lastLoadingHidden) {
      loading.hidden = loadingHidden;
      lastLoadingHidden = loadingHidden;
    }
    if (view.error !== null) {
      notice.hidden = false;
      const noticeText = `加载关联作品失败：${view.error}`;
      if (noticeText !== lastNotice) {
        notice.textContent = noticeText;
        lastNotice = noticeText;
      }
    } else {
      notice.hidden = true;
    }
    refreshCount();
  }

  const selectAll = h('button', {
    className: 'btn btn-ghost related-select-all',
    text: '全选未标记项',
    attrs: { type: 'button' },
  });
  selectAll.addEventListener('click', () => {
    options.onSelectAllUnmarked(items);
    for (const entry of entries.values()) syncItem(entry);
    refreshCount();
  });

  const close = h('button', {
    className: 'btn btn-ghost related-close',
    text: '关闭',
    attrs: { type: 'button' },
  });
  close.addEventListener('click', () => closeRelatedSheet());

  const sheet = h(
    'div',
    { className: 'related-sheet', attrs: { role: 'dialog', 'aria-label': '关联作品' } },
    [
      h('div', { className: 'related-head' }, [
        h('div', { className: 'related-heading' }, [
          h('div', { className: 'related-title', text: '关联作品' }),
          h('div', { className: 'related-subject', text: options.title }),
        ]),
        close,
      ]),
      h('div', { className: 'related-tools' }, [selectAll, count]),
      h('div', { className: 'related-body' }, [loading, notice, list]),
    ],
  );

  const overlay = h('div', { className: 'sheet-overlay' });
  overlay.addEventListener('click', () => closeRelatedSheet());

  const element = h('div', { className: 'sheet-root' }, [overlay, sheet]);
  document.body.append(element);
  document.body.classList.add('sheet-open');

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closeRelatedSheet();
  };
  document.addEventListener('keydown', onKeydown);

  let unsubscribe = (): void => {};
  const open: OpenSheet = {
    element,
    cleanup: () => {
      document.removeEventListener('keydown', onKeydown);
      unsubscribe();
    },
  };
  current = open;

  unsubscribe = options.subscribe(applyView);
  if (current !== open) unsubscribe();
}
