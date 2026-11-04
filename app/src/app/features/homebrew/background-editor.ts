import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';

import { SyncService } from '../../core/characters/sync.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import {
  BackgroundDraft,
  CustomBackground,
  DraftError,
  DraftField,
  SKILL_IDS,
  TOOL_KINDS,
  buildBackground,
  draftOf,
  emptyDraft,
  isWritable,
  normaliseName,
  validateDraft,
} from '../../core/homebrew/custom-background';
import { HomebrewStore } from '../../core/homebrew/homebrew-store.service';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe, TranslationKey } from '../../core/i18n/i18n.service';
import { term } from '../../core/i18n/glossary';
import { Ability, Item } from '../../core/models/compendium';
import { itemIndex, shopCatalog } from '../../core/rules/starting-equipment';
import { ABILITIES, SKILL_ABILITY } from '../../core/rules/tables';
import { SettingsService } from '../../core/settings/settings.service';
import { EntryCard } from '../../shared/picker/entry-card';
import { Picker } from '../../shared/picker/picker';

/** Most search results shown while adding equipment. */
const MAX_RESULTS = 8;

/**
 * The form to create or edit a custom background, in a dialog: the same fields as the official
 * backgrounds (3 abilities, an origin feat, 2 skills, a tool, A/B equipment), validation messages
 * and a live preview with the same card the pickers use. Before creating one it explains that the
 * DM has to approve it. Saves into HomebrewStore and reports `saved`.
 */
@Component({
  selector: 'app-background-editor',
  imports: [TranslatePipe, DataNamePipe, Picker, EntryCard],
  templateUrl: './background-editor.html',
  styleUrl: './background-editor.scss',
})
export class BackgroundEditor {
  /** The background being edited (none: a new one). */
  readonly background = input<CustomBackground | null>(null);
  readonly saved = output<CustomBackground>();
  readonly closed = output<void>();

  private readonly compendium = inject(CompendiumService);
  private readonly store = inject(HomebrewStore);
  private readonly sync = inject(SyncService);
  private readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);
  private readonly dataText = inject(DataTextService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly abilities = ABILITIES;
  protected readonly skillIds = SKILL_IDS;
  protected readonly toolKinds = TOOL_KINDS;

  protected readonly draft = signal<BackgroundDraft>(emptyDraft());
  /** New backgrounds start with the DM warning; editing goes straight to the form. */
  protected readonly stage = signal<'intro' | 'form'>('intro');
  protected readonly submitted = signal(false);
  protected readonly query = signal('');

  private started = false;

  constructor() {
    afterNextRender(() => {
      const existing = this.background();
      if (existing) {
        this.draft.set(draftOf(existing));
        this.stage.set('form');
      }
      this.started = true;
      this.dialog().nativeElement.showModal();
    });
  }

  protected readonly data = resource({
    loader: async () => {
      const [feats, items, backgrounds] = await Promise.all([
        this.compendium.all('feat'),
        this.compendium.all('item'),
        this.compendium.all('background'),
        this.store.load(),
      ]);
      const itemMap = new Map(items.map((i) => [i.id, i]));
      const index = itemIndex(items);
      const origin = feats.filter((f) => f.category === 'origin');
      // mundane things the wizard can read back from the text
      const catalog = shopCatalog(items).filter((i) => !i.magic);
      const tools = new Map<string, Item>();
      for (const i of items)
        if (i.category === 'tool' && i.edition === '2024' && !tools.has(i.name))
          tools.set(i.name, i);
      return {
        feats: origin,
        featById: new Map(origin.map((f) => [f.id, f])),
        itemMap,
        index,
        catalog,
        tools: [...tools.values()].sort((a, b) =>
          this.dataText.shortName(a.name).localeCompare(this.dataText.shortName(b.name)),
        ),
        names: backgrounds.map((b) => ({ id: b.id, name: b.name })),
      };
    },
  });

  // -- validation and preview -----------------------------------------------------------------
  protected readonly errors = computed<DraftError[]>(() => {
    const d = this.data.value();
    if (!d) return [];
    // the English name and the one shown ("Acólito" is taken too)
    const taken = new Set(
      d.names
        .filter((n) => n.id !== this.background()?.id)
        .flatMap((n) => [n.name, this.dataText.shortName(n.name)])
        .map(normaliseName),
    );
    return validateDraft(this.draft(), taken, new Set(d.featById.keys()));
  });

  protected readonly errorTexts = computed(() =>
    this.errors().map((e) => this.i18n.t(`homebrew.err.${e.key}` as TranslationKey, e.params)),
  );

  /** The card of the background as it would be saved (placeholders while it is incomplete). */
  protected readonly preview = computed(() => this.build(true));

  private build(placeholder: boolean): CustomBackground | null {
    const d = this.data.value();
    const draft = this.draft();
    if (!d) return null;
    const name =
      draft.name.trim() || !placeholder ? draft.name : this.i18n.t('homebrew.form.previewName');
    return buildBackground(
      { ...draft, name },
      {
        items: d.itemMap,
        index: d.index,
        featName: (id) => d.featById.get(id)?.name ?? '',
        device: this.deviceName(),
      },
      this.background() ?? undefined,
    );
  }

  protected hasError(field: DraftField): boolean {
    return this.submitted() && this.errors().some((e) => e.field === field);
  }

  // -- results of the equipment search ---------------------------------------------------------
  protected readonly results = computed(() => {
    const d = this.data.value();
    const q = normaliseName(this.query());
    if (!d || q.length < 2) return null;
    const have = new Set(this.draft().equipment.items.map((i) => i.itemId));
    const out: Item[] = [];
    for (const item of d.catalog) {
      if (have.has(item.id)) continue;
      if (!normaliseName(this.dataText.searchText(item.name)).includes(q)) continue;
      if (!isWritable(item, d.index)) continue;
      out.push(item);
      if (out.length >= MAX_RESULTS) break;
    }
    return out;
  });

  protected readonly equipmentItems = computed(() => {
    const d = this.data.value();
    return this.draft().equipment.items.map((line, index) => ({
      ...line,
      index,
      item: d?.itemMap.get(line.itemId),
    }));
  });

  // -- labels ---------------------------------------------------------------------------------
  protected abilityName(a: Ability): string {
    return this.i18n.t(`ability.${a}` as TranslationKey);
  }
  protected abilityAbbr(a: string): string {
    return this.i18n.t(`abbr.${a}` as TranslationKey);
  }
  protected skillName(id: string): string {
    return this.i18n.t(`skill.${id}` as TranslationKey);
  }
  protected skillAbility(id: string): string {
    return this.abilityAbbr(SKILL_ABILITY[id]);
  }
  protected kindName(kind: string): string {
    return term(this.i18n.language(), 'toolGroup', kind);
  }
  protected toolName(name: string): string {
    return this.dataText.shortName(name);
  }

  // -- editing --------------------------------------------------------------------------------
  private update(change: (d: BackgroundDraft) => void): void {
    this.draft.update((d) => {
      const next = structuredClone(d);
      change(next);
      return next;
    });
  }

  protected setName(value: string): void {
    this.update((d) => (d.name = value));
  }
  protected setDescription(value: string): void {
    this.update((d) => (d.description = value));
  }

  protected has(list: readonly string[], value: string): boolean {
    return list.includes(value);
  }

  protected toggleAbility(a: Ability): void {
    this.update((d) => {
      d.abilityScores = d.abilityScores.includes(a)
        ? d.abilityScores.filter((x) => x !== a)
        : [...d.abilityScores, a];
    });
  }

  protected toggleSkill(id: string): void {
    this.update((d) => {
      d.skills = d.skills.includes(id) ? d.skills.filter((x) => x !== id) : [...d.skills, id];
    });
  }

  protected setFeat(id: string): void {
    this.update((d) => (d.featId = id));
  }

  protected setToolMode(mode: 'specific' | 'kind'): void {
    this.update((d) => (d.tool = { mode, value: '' }));
  }
  protected setTool(value: string): void {
    this.update((d) => (d.tool.value = value));
  }

  protected setIncludeTool(on: boolean): void {
    this.update((d) => (d.equipment.includeTool = on));
  }

  protected addItem(item: Item): void {
    this.update((d) => d.equipment.items.push({ itemId: item.id, qty: 1 }));
    this.query.set('');
  }
  protected setQty(index: number, value: string): void {
    this.update((d) => (d.equipment.items[index].qty = Number(value)));
  }
  protected removeItem(index: number): void {
    this.update((d) => d.equipment.items.splice(index, 1));
  }
  protected setGold(value: string): void {
    this.update((d) => (d.equipment.gold = value === '' ? 0 : Number(value)));
  }

  // -- finishing ------------------------------------------------------------------------------
  protected async save(): Promise<void> {
    this.submitted.set(true);
    const built = this.build(false);
    if (this.errors().length || !built) {
      setTimeout(() => this.dialog().nativeElement.querySelector('.errors')?.scrollIntoView());
      return;
    }
    const saved = await this.store.save(built);
    void this.sync.sync();
    this.saved.emit(saved);
    this.close();
  }

  protected close(): void {
    const el = this.dialog().nativeElement;
    if (el.open) el.close();
  }

  /** The dialog closed (Escape, the buttons, or after saving). */
  protected onClosed(): void {
    if (this.started) this.closed.emit();
  }

  private deviceName(): string {
    return this.settings.settings().deviceName || navigator.platform || 'device';
  }
}
