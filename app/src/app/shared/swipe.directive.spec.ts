import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SwipeDirective, stepOf, swipeOf } from './swipe.directive';

describe('swipeOf', () => {
  it('a long, flat, quick move is a swipe; left = next', () => {
    expect(swipeOf(-100, 10, 200)).toBe('left');
    expect(swipeOf(100, -10, 200)).toBe('right');
  });

  it('too short, too steep or too slow is not', () => {
    expect(swipeOf(-40, 0, 100)).toBeNull();
    expect(swipeOf(-100, 80, 100)).toBeNull(); // ~39° from the horizontal: a scroll
    expect(swipeOf(-100, 10, 2000)).toBeNull();
  });
});

describe('stepOf', () => {
  it('stops at the ends (or wraps)', () => {
    expect(stepOf(0, 4, 'left')).toBe(1);
    expect(stepOf(3, 4, 'left')).toBe(3);
    expect(stepOf(0, 4, 'right')).toBe(0);
    expect(stepOf(0, 4, 'right', true)).toBe(3);
  });
});

@Component({
  imports: [SwipeDirective],
  template: `<div
    id="area"
    appSwipe
    [swipeDisabled]="off()"
    (swipeLeft)="log.push('left')"
    (swipeRight)="log.push('right')"
  >
    <input id="field" />
    <div id="wide" style="overflow-x: auto"><p>x</p></div>
    <p id="text">text</p>
  </div>`,
})
class Host {
  readonly log: string[] = [];
  readonly off = signal(false);
}

/** A touch event the way the directive reads it (jsdom has no Touch constructor). */
function touch(target: Element, type: string, x: number, y: number, fingers = 1) {
  const e = new Event(type, { bubbles: true });
  const point = { clientX: x, clientY: y };
  Object.defineProperty(e, 'touches', {
    value: type === 'touchend' ? [] : Array.from({ length: fingers }, () => point),
  });
  Object.defineProperty(e, 'changedTouches', { value: [point] });
  target.dispatchEvent(e);
}

function drag(target: Element, dx: number, dy: number) {
  touch(target, 'touchstart', 200, 300);
  touch(target, 'touchmove', 200 + dx / 2, 300 + dy / 2);
  touch(target, 'touchend', 200 + dx, 300 + dy);
}

describe('SwipeDirective', () => {
  function setup() {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { f, host: f.componentInstance, q: (s: string) => el.querySelector(s)! };
  }

  it('emits left and right; leaves vertical moves to the scroll', () => {
    const { host, q } = setup();
    drag(q('#text'), -120, 8);
    drag(q('#text'), 120, -8);
    drag(q('#text'), -20, 200);
    expect(host.log).toEqual(['left', 'right']);
    expect((q('#area') as HTMLElement).style.touchAction).toBe('pan-y pinch-zoom');
  });

  it('not from a field, nor with two fingers, nor when disabled', () => {
    const { f, host, q } = setup();
    drag(q('#field'), -120, 0);
    touch(q('#text'), 'touchstart', 200, 300, 2);
    touch(q('#text'), 'touchend', 50, 300);
    host.off.set(true);
    f.detectChanges();
    drag(q('#text'), -120, 0);
    expect(host.log).toEqual([]);
  });

  it('not from inside something that scrolls sideways', () => {
    const { host, q } = setup();
    const wide = q('#wide') as HTMLElement;
    Object.defineProperty(wide, 'scrollWidth', { value: 900 });
    Object.defineProperty(wide, 'clientWidth', { value: 300 });
    drag(wide.querySelector('p')!, -120, 0);
    expect(host.log).toEqual([]);
  });
});
