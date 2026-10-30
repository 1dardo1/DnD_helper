import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataNamePipe, DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { PhrasePipe, TermPipe } from '../../core/i18n/glossary';
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
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';
import { LoadError } from './load-error';

/** Detail page for any entry, with extra sections for classes, subclasses and spells. */
@Component({
  selector: 'app-entry-detail',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    TranslatePipe,
    TermPipe,
    PhrasePipe,
    DataNamePipe,
    DataTextPipe,
    MarkdownPipe,
    LoadError,
    ClassThemeDirective,
  ],
  templateUrl: './entry-detail.html',
  styleUrl: './entry-detail.scss',
})
export class EntryDetail {
  /** Route parameters. */
  readonly type = input.required<string>();
  readonly id = input.required<string>();
  private readonly compendium = inject(CompendiumService);
  private readonly data = inject(DataTextService);

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
      (await this.compendium.all('subclass')).filter((s) => s.classId === params),
  });
  /** In alphabetical order of the names shown. */
  protected readonly sortedSubclasses = computed(() =>
    [...(this.subclasses.value() ?? [])].sort((a, b) =>
      this.data.shortName(a.name).localeCompare(this.data.shortName(b.name)),
    ),
  );

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

  /** Class names for the spell's class ids ("blood-hunter" → "Blood Hunter"). */
  protected readonly classMap = resource({
    loader: async () => new Map((await this.compendium.all('class')).map((c) => [c.id, c.name])),
  });

  protected classNames(ids: string[]): string {
    const map = this.classMap.value();
    return this.names(ids.map((id) => map?.get(id) ?? id));
  }

  protected names(list: string[]): string {
    return list.map((n) => this.data.name(n)).join(', ');
  }

  protected components(s: Spell): string {
    const parts = [s.components.v && 'V', s.components.s && 'S', s.components.m && 'M']
      .filter(Boolean)
      .join(', ');
    const material = this.data.text(s.components.material);
    return material ? `${parts} (${material})` : parts;
  }
}
