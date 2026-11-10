import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

/** What counts as a horizontal swipe. */
export interface SwipeOptions {
  /** Minimum horizontal distance, in CSS pixels. */
  threshold: number;
  /** Maximum angle from the horizontal, in degrees (a steeper move is a vertical scroll). */
  maxAngle: number;
  /** Maximum duration, in ms (a slow drag is not a swipe). */
  maxTime: number;
}

export const SWIPE_DEFAULTS: SwipeOptions = { threshold: 60, maxAngle: 30, maxTime: 900 };

/**
 * The swipe a finger made from its start to its end: 'left' (moved towards the left: show the
 * next page), 'right' (the previous one) or null (too short, too steep or too slow).
 */
export function swipeOf(
  dx: number,
  dy: number,
  ms: number,
  o: SwipeOptions = SWIPE_DEFAULTS,
): 'left' | 'right' | null {
  if (Math.abs(dx) < o.threshold || ms > o.maxTime) return null;
  const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  if (angle > o.maxAngle) return null;
  return dx < 0 ? 'left' : 'right';
}

/** Elements where a horizontal drag means something else (typing, sliders, opt-outs). */
const OWN_GESTURE = 'input, textarea, select, [contenteditable], [data-no-swipe]';

/** Whether a drag starting at `target` belongs to something that scrolls sideways inside `host`. */
export function inHorizontalScroller(target: Element | null, host: Element): boolean {
  for (let el = target; el && el !== host; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
  }
  return false;
}

/**
 * Horizontal swipe on an element (phones): `(swipeLeft)` / `(swipeRight)`. Vertical scrolling is
 * left to the browser (touch-action: pan-y pinch-zoom on the host; passive listeners), a move that
 * turns out vertical is dropped, and a drag that starts on a field or inside something that
 * scrolls sideways (a wide table, a strip of tabs) is not a swipe.
 */
@Directive({
  selector: '[appSwipe]',
  host: { '[style.touch-action]': 'swipeDisabled() ? null : "pan-y pinch-zoom"' },
})
export class SwipeDirective {
  readonly swipeLeft = output<void>();
  readonly swipeRight = output<void>();
  readonly swipeDisabled = input(false);
  readonly swipeThreshold = input(SWIPE_DEFAULTS.threshold);

  private start: { x: number; y: number; t: number } | null = null;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const opts = { passive: true } as const;
    const onStart = (e: TouchEvent) => {
      this.start = null;
      if (this.swipeDisabled() || e.touches.length !== 1) return;
      const target = e.target as Element | null;
      if (target?.closest?.(OWN_GESTURE) || inHorizontalScroller(target, host)) return;
      const t = e.touches[0];
      this.start = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const onMove = (e: TouchEvent) => {
      if (!this.start) return;
      if (e.touches.length !== 1) {
        this.start = null; // a pinch
        return;
      }
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - this.start.x);
      const dy = Math.abs(t.clientY - this.start.y);
      // clearly vertical: it's a scroll, forget it
      if (dy > 12 && dy > dx) this.start = null;
    };
    const onEnd = (e: TouchEvent) => {
      const start = this.start;
      this.start = null;
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dir = swipeOf(t.clientX - start.x, t.clientY - start.y, Date.now() - start.t, {
        ...SWIPE_DEFAULTS,
        threshold: this.swipeThreshold(),
      });
      if (dir === 'left') this.swipeLeft.emit();
      else if (dir === 'right') this.swipeRight.emit();
    };
    const onCancel = () => (this.start = null);
    host.addEventListener('touchstart', onStart, opts);
    host.addEventListener('touchmove', onMove, opts);
    host.addEventListener('touchend', onEnd, opts);
    host.addEventListener('touchcancel', onCancel, opts);
    inject(DestroyRef).onDestroy(() => {
      host.removeEventListener('touchstart', onStart);
      host.removeEventListener('touchmove', onMove);
      host.removeEventListener('touchend', onEnd);
      host.removeEventListener('touchcancel', onCancel);
    });
  }
}

/** The next index in a ring of `n` pages for a swipe (left → next, right → previous). */
export function stepOf(index: number, n: number, dir: 'left' | 'right', wrap = false): number {
  const next = index + (dir === 'left' ? 1 : -1);
  if (wrap) return (next + n) % n;
  return Math.min(n - 1, Math.max(0, next));
}
