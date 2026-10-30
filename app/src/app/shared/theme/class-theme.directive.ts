import { Directive, ElementRef, effect, inject, input } from '@angular/core';

import { themeFor, themeVars } from './class-theme';

/**
 * What to theme: an explicit class/subclass, or a compendium entry (only class and subclass
 * entries get a theme; anything else, or null, leaves the element unthemed).
 */
export type ClassThemeTarget =
  | { classId?: string | null; subclassId?: string | null }
  | { type: string; id: string; classId?: string }
  | null
  | undefined;

/**
 * Applies a class/subclass theme (see class-theme.ts and themes.scss) as CSS variables and
 * data attributes, and adds the class's illuminated frame (class-ornaments.ts, loaded lazily):
 *
 *   <article [appClassTheme]="entry">…
 *   <aside [appClassTheme]="{ classId: 'wizard', subclassId: 'wizard/evoker' }">…
 *
 * With appClassThemeScope="parent" the theme goes on the parent element instead (to theme a
 * whole component from one of its children without wrapping the markup).
 */
@Directive({ selector: '[appClassTheme]' })
export class ClassThemeDirective {
  readonly appClassTheme = input<ClassThemeTarget>();
  readonly appClassThemeScope = input<'self' | 'parent'>('self');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private applied: { el: HTMLElement; vars: string[]; frame?: HTMLElement } | null = null;

  constructor() {
    effect((onCleanup) => {
      const ids = resolve(this.appClassTheme());
      const el =
        this.appClassThemeScope() === 'parent' ? (this.host.parentElement ?? this.host) : this.host;
      this.clear();
      if (!ids) return;
      const t = themeFor(ids.classId, ids.subclassId);
      const vars = themeVars(t);
      for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
      el.classList.add('class-theme');
      el.dataset['classTheme'] = t.classId;
      el.dataset['motif'] = t.motif;
      const applied: NonNullable<typeof this.applied> = { el, vars: Object.keys(vars) };
      this.applied = applied;
      void import('./class-ornaments').then(({ ornamentMarkup }) => {
        if (this.applied !== applied) return;
        const frame = el.ownerDocument.createElement('div');
        frame.className = 'th-orn';
        frame.setAttribute('aria-hidden', 'true');
        const { html, cw } = ornamentMarkup(t.classId);
        frame.style.setProperty('--orn-cw', String(cw));
        // static markup built by class-ornaments.ts from constants (no user data)
        frame.innerHTML = html;
        el.append(frame);
        applied.frame = frame;
      });
      onCleanup(() => this.clear());
    });
  }

  private clear(): void {
    if (!this.applied) return;
    const { el, vars, frame } = this.applied;
    for (const k of vars) el.style.removeProperty(k);
    el.classList.remove('class-theme');
    delete el.dataset['classTheme'];
    delete el.dataset['motif'];
    frame?.remove();
    this.applied = null;
  }
}

function resolve(t: ClassThemeTarget): { classId: string; subclassId: string | null } | null {
  if (!t) return null;
  if ('type' in t) {
    if (t.type === 'class') return { classId: t.id, subclassId: null };
    if (t.type === 'subclass' && t.classId) return { classId: t.classId, subclassId: t.id };
    return null;
  }
  return t.classId ? { classId: t.classId, subclassId: t.subclassId ?? null } : null;
}
