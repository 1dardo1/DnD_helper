import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { BackupService } from '../../core/characters/backup.service';
import { CharacterStore } from '../../core/characters/character-store.service';
import { SyncService } from '../../core/characters/sync.service';
import { browserStorage, readEditDraft, restoreEditDraft } from '../../core/creation/edit-draft';
import { DataNamePipe, DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermDomain, TermPipe, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { computeSheet } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { Sheet, SheetFeature, SheetWarning } from '../../core/rules/sheet';
import { summonSourcesOf } from '../../core/summons/catalog';
import { SummonCatalogService } from '../../core/summons/summon-catalog.service';
import { ABILITIES } from '../../core/rules/tables';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { EquipmentPanel } from './equipment-panel';
import { SpellBook } from './spell-book';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';
import { LoadError } from '../compendium/load-error';
import { PlayPanel } from './play-panel';

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
    PlayPanel,
    SpellBook,
    EquipmentPanel,
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
  private readonly backup = inject(BackupService);
  protected readonly canShareFiles = this.backup.canShareFiles;

  /** Live cloud status (sync runs in the background after a save). */
  protected readonly status = computed(
    () => this.store.all().find((r) => r.character.id === this.id())?.status,
  );

  /** Notes being edited (null = not touched yet, show the saved ones). */
  protected readonly notesDraft = signal<string | null>(null);

  protected readonly abilities = ABILITIES;

  /** Changes when the character shows up (a first visit can arrive before the pull brings it). */
  private readonly present = computed(() =>
    this.store.all().some((r) => r.character.id === this.id()),
  );

  protected readonly view = resource({
    params: () => ({ id: this.id(), present: this.present() }),
    loader: async ({ params }) => {
      const [record, data] = await Promise.all([this.store.get(params.id), this.rules.load()]);
      return record ? { record, data, sheet: computeSheet(record.character, data) } : null;
    },
  });

  /** The stat blocks of the summoning spells, read once (the button to the summons screen). */
  private readonly summonCatalogs = inject(SummonCatalogService);
  private readonly summonCatalog = resource({ loader: () => this.summonCatalogs.load() });
  private readonly summonSources = computed(() => {
    const v = this.view.value();
    const catalog = this.summonCatalog.value();
    if (!v || !catalog) return [];
    return summonSourcesOf(v.record.character, v.sheet, v.data.subclasses, catalog);
  });
  protected readonly spellSummons = computed(
    () => this.summonSources().filter((s) => s.kind === 'spell').length,
  );
  protected readonly featureSummons = computed(
    () => this.summonSources().filter((s) => s.kind === 'feature').length,
  );

  /** Unsaved changes left in the edit wizard (kept in this browser), to offer going back to them. */
  protected readonly hasEditDraft = computed(() => {
    const record = this.view.value()?.record;
    if (!record) return false;
    return !!restoreEditDraft(
      readEditDraft(browserStorage(), record.character.id),
      record.character,
    );
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

  private stateSaves = Promise.resolve();

  /**
   * In-game changes: shown at once (a tap must not wait for the database), saved in order, and
   * uploaded a few seconds after the last one.
   */
  protected saveState(state: Character['state']): void {
    const v = this.view.value();
    if (v) this.saveCharacter({ ...v.record.character, state });
  }

  /** Same as saveState, for other quick changes (prepared spells). */
  protected saveCharacter(character: Character): void {
    const v = this.view.value();
    if (!v) return;
    this.view.set({
      ...v,
      record: { ...v.record, character },
      sheet: computeSheet(character, v.data),
    });
    this.stateSaves = this.stateSaves
      .then(() => this.sync.saveSoon(character))
      .then(
        () => undefined,
        (e) => console.error(e),
      );
  }

  protected async remove(): Promise<void> {
    const record = this.view.value()?.record;
    if (!record) return;
    if (!confirm(this.i18n.t('sheet.confirmDelete', { name: record.character.name }))) return;
    await this.sync.remove(record.character.id);
    await this.router.navigate(['/characters']);
  }

  /** The character file (as in the repo): a download, or the share sheet on phones. */
  protected async exportCharacter(c: Character, share = false): Promise<void> {
    try {
      await this.backup.exportCharacter(c, share);
    } catch (e) {
      alert(this.i18n.t('common.error', { message: (e as Error).message }));
    }
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
      .replace(/\bshield\b/, this.i18n.t('sheet.shield'))
      .replace(/\(max (\d+)\)/, (_, n) => this.i18n.t('sheet.maxN', { n }));
  }

  protected skillsOf(sheet: Sheet, ability: string) {
    return sheet.skills.filter((sk) => sk.ability === ability);
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
