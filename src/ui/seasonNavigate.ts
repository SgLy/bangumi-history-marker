const SWIPE_SLOP = 10;
const SWIPE_THRESHOLD = 48;

interface TouchPoint {
  x: number;
  y: number;
}

type Gesture =
  | { phase: 'idle' }
  | { phase: 'pending'; start: TouchPoint }
  | { phase: 'horizontal'; start: TouchPoint };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function bindSeasonNavigation(
  target: HTMLElement,
  onStep: (delta: 1 | -1) => void,
): () => void {
  let gesture: Gesture = { phase: 'idle' };

  const reset = (): void => {
    gesture = { phase: 'idle' };
  };

  const handleTouchStart = (event: TouchEvent): void => {
    gesture = { phase: 'idle' };
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (touch === undefined) return;
    gesture = { phase: 'pending', start: { x: touch.clientX, y: touch.clientY } };
  };

  const handleTouchMove = (event: TouchEvent): void => {
    if (gesture.phase === 'idle') return;
    if (event.touches.length !== 1) {
      reset();
      return;
    }
    const touch = event.touches[0];
    if (touch === undefined) return;

    if (gesture.phase === 'pending') {
      const dx = touch.clientX - gesture.start.x;
      const dy = touch.clientY - gesture.start.y;
      if (Math.abs(dx) > SWIPE_SLOP && Math.abs(dx) > Math.abs(dy)) {
        gesture = { phase: 'horizontal', start: gesture.start };
      } else if (Math.abs(dy) > SWIPE_SLOP && Math.abs(dy) >= Math.abs(dx)) {
        reset();
        return;
      } else {
        return;
      }
    }
    // 阻止滚动，也让滑动结束时不会误触发卡片点击
    if (gesture.phase === 'horizontal') event.preventDefault();
  };

  const handleTouchEnd = (event: TouchEvent): void => {
    if (gesture.phase !== 'horizontal') {
      reset();
      return;
    }
    const touch = event.changedTouches[0];
    if (touch !== undefined) {
      const dx = touch.clientX - gesture.start.x;
      if (Math.abs(dx) >= SWIPE_THRESHOLD) onStep(dx > 0 ? 1 : -1);
    }
    reset();
  };

  const handleTouchCancel = (): void => {
    reset();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.repeat) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.body.classList.contains('sheet-open')) return;
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
    onStep(event.key === 'ArrowRight' ? -1 : 1);
  };

  target.addEventListener('touchstart', handleTouchStart, { passive: true });
  target.addEventListener('touchmove', handleTouchMove, { passive: false });
  target.addEventListener('touchend', handleTouchEnd);
  target.addEventListener('touchcancel', handleTouchCancel);
  document.addEventListener('keydown', handleKeyDown);

  return () => {
    target.removeEventListener('touchstart', handleTouchStart);
    target.removeEventListener('touchmove', handleTouchMove);
    target.removeEventListener('touchend', handleTouchEnd);
    target.removeEventListener('touchcancel', handleTouchCancel);
    document.removeEventListener('keydown', handleKeyDown);
  };
}
