import { currentSeason, seasonLabel } from '../seasons';
import type { Store } from '../state';
import type { SubjectRef } from '../types';
import { h, signatureOf } from './dom';

interface BatchBarOptions {
  onClear: () => void;
  onRemove: (id: number) => void;
  onOlderSeason: () => void;
  onNewerSeason: () => void;
  onSubmit: () => void;
}

interface BatchBar {
  element: HTMLElement;
  dispose: () => void;
}

export function createBatchBar(store: Store, options: BatchBarOptions): BatchBar {
  const count = h('span', { className: 'batch-count', text: '已选 0 部' });
  const chips = h('div', { className: 'batch-chips' });
  const hint = h('span', { className: 'batch-hint' });

  const newer = h('button', {
    className: 'season-step season-step-newer',
    text: '‹',
    attrs: { type: 'button', 'aria-label': '下一季（更新）' },
  });
  newer.addEventListener('click', () => options.onNewerSeason());
  const older = h('button', {
    className: 'season-step season-step-older',
    text: '›',
    attrs: { type: 'button', 'aria-label': '上一季（更早）' },
  });
  older.addEventListener('click', () => options.onOlderSeason());
  const seasonCurrent = h('span', { className: 'season-current' });
  const seasonNav = h('div', { className: 'season-nav' }, [newer, seasonCurrent, older]);

  const clear = h('button', { className: 'btn btn-ghost', text: '清空', attrs: { type: 'button' } });
  clear.addEventListener('click', () => options.onClear());

  const submitCount = h('span', { className: 'batch-submit-count' });
  const submit = h('button', { className: 'btn btn-primary batch-submit', attrs: { type: 'button' } }, [
    h('span', { text: '提交' }),
    submitCount,
  ]);
  submit.addEventListener('click', () => options.onSubmit());

  const element = h('div', { className: 'batch-bar' }, [
    h('div', { className: 'batch-main' }, [seasonNav, count, chips]),
    h('div', { className: 'batch-actions' }, [hint, clear, submit]),
  ]);

  let lastSignature: string | null = null;
  let lastChipsSignature: string | null = null;

  function createChip(item: SubjectRef, busy: boolean): HTMLElement {
    const name = item.name_cn || item.name;
    const remove = h('button', {
      className: 'batch-chip-remove',
      text: '×',
      attrs: { type: 'button', 'aria-label': `移除 ${name}` },
    });
    remove.disabled = busy;
    remove.addEventListener('click', () => options.onRemove(item.id));
    return h('span', { className: 'batch-chip' }, [
      h('span', { className: 'batch-chip-name', text: name }),
      remove,
    ]);
  }

  function updateHint(): void {
    const state = store.get();
    if (state.submitting && state.progress) {
      const label = state.progress.phase === 'private' ? '私密标记中' : '转为公开中';
      hint.textContent = `${label} ${state.progress.current} / ${state.progress.total}…`;
      hint.classList.add('is-progress');
    } else {
      hint.textContent = '';
      hint.classList.remove('is-progress');
    }
  }

  function render(): void {
    const state = store.get();
    const items = [...state.selected.values()];
    const busy = state.submitting;
    const progress = state.progress;
    const chipsSignature = signatureOf([busy, ...items.map((item) => item.subject.id)]);
    const signature = signatureOf([
      state.activeSeason,
      chipsSignature,
      progress?.phase,
      progress?.current,
      progress?.total,
    ]);
    if (signature === lastSignature) return;
    lastSignature = signature;

    seasonCurrent.textContent = seasonLabel(state.activeSeason);
    newer.disabled = state.activeSeason >= currentSeason();

    count.textContent = `已选 ${items.length} 部`;
    submitCount.textContent = `${items.length}`;
    clear.disabled = busy || items.length === 0;
    submit.disabled = busy || items.length === 0;
    element.classList.toggle('is-idle', !busy && items.length === 0);

    if (chipsSignature !== lastChipsSignature) {
      chips.replaceChildren(...items.map((item) => createChip(item.subject, busy)));
      lastChipsSignature = chipsSignature;
    }
    updateHint();
  }

  const unsubscribe = store.subscribe(render);
  render();
  return { element, dispose: unsubscribe };
}
