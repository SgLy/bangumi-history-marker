import { h } from './dom';

type ToastVariant = 'info' | 'error';

interface Toaster {
  show(message: string, variant?: ToastVariant): void;
  dispose(): void;
}

const TOAST_DURATION = 4000;
const TOAST_MAX = 3;

export function createToaster(): Toaster {
  const container = h('div', { className: 'toast-container' });
  document.body.append(container);
  const timers = new Set<number>();

  return {
    show(message, variant = 'info') {
      while (container.childElementCount >= TOAST_MAX) {
        container.firstElementChild?.remove();
      }
      const toast = h('div', {
        className: `toast toast-${variant}`,
        text: message,
        attrs: { role: 'status' },
      });
      container.append(toast);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        toast.remove();
      }, TOAST_DURATION);
      timers.add(timer);
    },
    dispose() {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      container.replaceChildren();
    },
  };
}
