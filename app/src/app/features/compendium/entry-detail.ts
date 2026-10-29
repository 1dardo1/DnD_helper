import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import {
  DndClass,
  ENTRY_TYPES,
  Entry,
  EntryType,
  Feature,
  Spell,
  Subclass,
} from '../../core/models/compendium';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { LoadError } from './load-error';

/** Detail page for any entry, with extra sections for classes, subclasses and spells. */
@Component({
  selector: 'app-entry-detail',
  imports: [RouterLink, NgTemplateOutlet, TranslatePipe, MarkdownPipe, LoadError],
  templateUrl: './entry-detail.html',
  styleUrl: './entry-detail.scss',
})
export class EntryDetail {
  /** Route parameters. */
  readonly type = input.required<string>();
  readonly id = input.required<string>();
  private readonly compendium = inject(CompendiumService);

  protected readonly entryType = computed<EntryType>(() =>
    ENTRY_TYPES.includes(this.type() as EntryType) ? (this.type() as EntryType) : 'class',
  );

  protected readonly entry = resource({
    params: () => ({ type: this.entryType(), id: this.id() }),
    loader: ({ params }) =>
      this.compendium.get(params.type, params.id) as Promise<Entry | undefined>,
  });

  /** Subclasses of the class being shown. */
  protected readonly subclasses = resource({
    params: () => (this.entryType() === 'class' ? this.id() : undefined),
    loader: async ({ params }) =>
      (await this.compendium.all('subclass'))
        .filter((s) => s.classId === params)
        .sort((a, b) => a.name.localeCompare(b.name)),
  });

  protected asClass(e: Entry): DndClass {
    return e as DndClass;
  }

  protected asSubclass(e: Entry): Subclass {
    return e as Subclass;
  }

  protected asSpell(e: Entry): Spell {
    return e as Spell;
  }

  /** Features grouped by level, in level order. */
  protected byLevel(features: Feature[]): { level: number; features: Feature[] }[] {
    const groups = new Map<number, Feature[]>();
    for (const f of features) groups.set(f.level, [...(groups.get(f.level) ?? []), f]);
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([level, fs]) => ({ level, features: fs }));
  }

  protected components(s: Spell): string {
    const parts = [s.components.v && 'V', s.components.s && 'S', s.components.m && 'M']
      .filter(Boolean)
      .join(', ');
    return s.components.material ? `${parts} (${s.components.material})` : parts;
  }
}
