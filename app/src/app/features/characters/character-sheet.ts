import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { computeSheet } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { Sheet, SheetFeature } from '../../core/rules/sheet';
import { ABILITIES } from '../../core/rules/tables';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { LoadError } from '../compendium/load-error';

/** The character sheet: everything computed by the rules engine from the character's choices. */
@Component({
  selector: 'app-character-sheet',
  imports: [RouterLink, TranslatePipe, MarkdownPipe, LoadError],
  templateUrl: './character-sheet.html',
  styleUrl: './character-sheet.scss',
})
export class CharacterSheet {
  /** Route parameter. */
  readonly id = input.required<string>();
  private readonly store = inject(CharacterStore);
  private readonly rules = inject(RulesDataService);

  protected readonly abilities = ABILITIES;

  protected readonly view = resource({
    params: () => this.id(),
    loader: async ({ params }) => {
      const [record, data] = await Promise.all([this.store.get(params), this.rules.load()]);
      return record ? { record, sheet: computeSheet(record.character, data) } : null;
    },
  });

  /** Features grouped by where they come from (class, subclass, species, feats). */
  protected readonly featureGroups = computed(() => {
    const features = this.view.value()?.sheet.features ?? [];
    const groups = new Map<string, SheetFeature[]>();
    for (const f of features) {
      const key = `${f.source.type}:${f.source.name}`;
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    return [...groups.values()].map((fs) => ({ source: fs[0].source, features: fs }));
  });

  protected signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  protected classLine(sheet: Sheet): string {
    return sheet.classes
      .map((c) => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ''}`)
      .join(' / ');
  }

  protected speeds(sheet: Sheet): { kind: string; value: number }[] {
    return Object.entries(sheet.speed).map(([kind, value]) => ({ kind, value }));
  }

  /** Spell slot levels that have at least one slot. */
  protected slotLevels(sheet: Sheet): { level: number; count: number }[] {
    return sheet.spellcasting.slots
      .map((count, i) => ({ level: i + 1, count }))
      .filter((s) => s.count > 0);
  }
}
