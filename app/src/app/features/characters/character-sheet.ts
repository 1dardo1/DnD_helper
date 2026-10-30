import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { SyncService } from '../../core/characters/sync.service';
import { DataNamePipe, DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermDomain, TermPipe, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { computeSheet } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { Sheet, SheetFeature, SheetWarning } from '../../core/rules/sheet';
import { ABILITIES } from '../../core/rules/tables';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';
import { LoadError } from '../compendium/load-error';

/** The character sheet: everything computed by the rules engine from the character's choices. */
@Component({
  selector: 'app-character-sheet',
  imports: [
    RouterLink,
    TranslatePipe,
    TermPipe,
    DataNamePipe,
    DataTextPipe,
    MarkdownPipe,
    LoadError,
    ClassThemeDirective,
  ],
  templateUrl: './character-sheet.html',
  styleUrl: './character-sheet.scss',
})
export class CharacterSheet {
  /** Route parameter. */
  readonly id = input.required<string>();
  private readonly store = inject(CharacterStore);
  private readonly rules = inject(RulesDataService);
  private readonly sync = inject(SyncService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject(DataTextService);
  private readonly router = inject(Router);

  /** Live cloud status (sync runs in the background after a save). */
  protected readonly status = computed(
    () => this.store.all().find((r) => r.character.id === this.id())?.status,
  );

  /** Notes being edited (null = not touched yet, show the saved ones). */
  protected readonly notesDraft = signal<string | null>(null);

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

  protected async saveNotes(): Promise<void> {
    const record = this.view.value()?.record;
    const notes = this.notesDraft();
    if (!record || notes === null) return;
    await this.sync.save({ ...record.character, notes });
    this.notesDraft.set(null);
    this.view.reload();
  }

  protected async remove(): Promise<void> {
    const record = this.view.value()?.record;
    if (!record) return;
    if (!confirm(this.i18n.t('sheet.confirmDelete', { name: record.character.name }))) return;
    await this.sync.remove(record.character.id);
    await this.router.navigate(['/characters']);
  }

  /** A list of game terms in the current language. */
  protected terms(values: string[], domain: TermDomain, sep = ', '): string {
    return values.map((v) => term(this.i18n.language(), domain, v)).join(sep);
  }

  protected className(sheet: Sheet, id: string): string {
    return this.data.name(sheet.classes.find((c) => c.id === id)?.name ?? id);
  }

  protected warning(w: SheetWarning): string {
    const params = { ...w.params };
    if (params['what']) params['what'] = this.i18n.t(`sheet.what.${params['what']}` as never);
    if (params['cls']) params['cls'] = this.data.shortName(params['cls']);
    if (params['title']) params['title'] = this.data.text(params['title']);
    return this.i18n.t(w.key, params);
  }

  /** "10 + DEX + shield" with the abbreviations of the current language. */
  protected formula(f: string): string {
    return f
      .replace(/\b(STR|DEX|CON|INT|WIS|CHA)\b/g, (a) => this.i18n.t(`abbr.${a}` as never))
      .replace(/\bshield\b/, this.i18n.t('sheet.shield'));
  }

  protected signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  protected classLine(sheet: Sheet): string {
    return sheet.classes
      .map((c) => {
        const sub = c.subclass ? ` (${this.data.shortName(c.subclass)})` : '';
        return `${this.data.shortName(c.name)} ${c.level}${sub}`;
      })
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
