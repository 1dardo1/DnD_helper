import { Component, computed, inject, input } from '@angular/core';

import { DataNamePipe } from '../../core/i18n/data-text.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { PictureKind } from '../../core/media/pictures';
import { Entry, Subclass } from '../../core/models/compendium';
import { themeFor } from '../theme/class-theme';
import { EntryLabels } from './entry-labels.service';
import { EntryPortrait } from './entry-portrait';

/**
 * The summary card of an entry of any type (name, a kicker line and a few facts). Only inline
 * content, so it can go inside a <button> (wizard pickers) or a link (compendium lists).
 */
@Component({
  selector: 'app-entry-card',
  imports: [DataNamePipe, EntryPortrait, TranslatePipe],
  template: `
    @let s = summary();
    @if (pictureKind(); as k) {
      <app-entry-portrait class="thumb" [kind]="k" [entryId]="entry().id" />
    }
    <span class="head">
      @if (icon(); as i) {
        <span
          class="class-icon"
          aria-hidden="true"
          [attr.data-motif]="i.motif"
          [style.--icon-light]="i.light"
          [style.--icon-dark]="i.dark"
        ></span>
      }
      <span class="name">{{ entry().name | dataName }}</span>
      @for (m of s.marks; track m.text) {
        <abbr class="mark" [attr.data-tone]="m.tone" [title]="m.title">{{ m.text }}</abbr>
      }
      @if (entry().edition === '2014') {
        <span class="mark edition">2014</span>
      }
    </span>
    @if (s.species; as sp) {
      <span class="species">
        <span class="visually-hidden">{{ 'picker.speciesOnly' | t }}:</span>
        @for (n of sp; track n) {
          <span class="tag">{{ n }}</span>
        }
      </span>
    }
    @if (s.kicker) {
      <span class="kicker">{{ s.kicker }}</span>
    }
    @for (f of s.facts; track f.label) {
      <span class="fact"
        ><span class="label">{{ f.label }}</span
        >{{ f.value }}</span
      >
    }
    @if (s.preview) {
      <span class="preview">{{ s.preview }}</span>
    }
  `,
  styles: `
    @use './cards';

    :host {
      @include cards.text;
    }

    abbr {
      text-decoration: none;
    }

    .preview {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
      overflow: hidden;
      margin-top: 0.2rem;
      font-size: 0.9em;
      line-height: 1.35;
      color: var(--ink-soft);
    }
  `,
})
export class EntryCard {
  readonly entry = input.required<Entry>();

  /** Species and monster cards: their picture on top, if there is one. */
  protected readonly pictureKind = computed((): PictureKind | null => {
    const t = this.entry().type;
    return t === 'species' || t === 'monster' ? t : null;
  });

  /** Class and subclass cards: the class icon in its own colours (also outside a themed list). */
  protected readonly icon = computed(() => {
    const e = this.entry();
    if (e.type !== 'class' && e.type !== 'subclass') return null;
    const t = e.type === 'class' ? themeFor(e.id) : themeFor((e as Subclass).classId, e.id);
    return { motif: t.motif, light: t.accent2Light, dark: t.accent2Dark };
  });
  private readonly labels = inject(EntryLabels);

  protected readonly summary = computed(() => this.labels.summary(this.entry()));
}
