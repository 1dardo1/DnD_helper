import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { SyncService } from '../../core/characters/sync.service';
import { CombatMonster } from '../../core/dm/combat';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { Monster } from '../../core/models/compendium';
import { computeSheet } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import {
  SummonOption,
  SummonSource,
  contextFor,
  maxSlotOf,
  resolveOption,
  slotLevelOf,
  summonSourcesOf,
} from '../../core/summons/catalog';
import { SummonCatalogService } from '../../core/summons/summon-catalog.service';
import {
  SummonsState,
  creatureKey,
  creatureOf,
  dismissAll,
  emptySummons,
  resetSummons,
  setHideInactive,
  setScale,
  setSummoned,
  setType,
  summonedCount,
  toCombatMonster,
  updateCreature,
} from '../../core/summons/summon-state';
import { LoadError } from '../compendium/load-error';
import { MonsterStatBlock } from '../compendium/monster-stat-block';
import { MonsterCard } from '../dm/combat/monster-card';
import { CombatMutator } from '../dm/combat/monster-summary';

/** More options than this: only the summoned ones are cards, the rest wait in a list. */
const MANY = 8;

interface CardView {
  key: string;
  label: string;
  monster: Monster;
  instance: CombatMonster;
  on: boolean;
  mutate: CombatMutator;
}

interface GroupView {
  source: SummonSource;
  slot: number;
  slots: number[];
  type: string;
  cards: CardView[];
  /** Possible creatures that are not out (a long list: shown apart). */
  others: CardView[];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * The creatures a character can summon with its spells and features: a card per creature (the
 * combat helper's monster card) with a toggle for "summoned", its hit points and limited uses
 * saved in the character, and the full stat block one tap away.
 */
@Component({
  selector: 'app-summons-page',
  imports: [RouterLink, TranslatePipe, DataNamePipe, LoadError, MonsterCard, MonsterStatBlock],
  templateUrl: './summons-page.html',
  styleUrl: './summons-page.scss',
})
export class SummonsPage {
  /** Route parameter. */
  readonly id = input.required<string>();
  /** Inside the character sheet's tab: no back link nor title (the tab says it). */
  readonly embedded = input(false);
  /** The character after a change, so the sheet that hosts this page doesn't keep a stale one. */
  readonly changed = output<Character>();
  /** The host's current character: its play state may change meanwhile (rests from the sheet bar). */
  readonly character = input<Character | null>(null);

  constructor() {
    effect(() => {
      const c = this.character();
      const v = untracked(() => this.view.value());
      if (c && v && v.record.character !== c) {
        this.view.set({ ...v, record: { ...v.record, character: c } });
      }
    });
  }

  private readonly store = inject(CharacterStore);
  private readonly sync = inject(SyncService);
  private readonly rules = inject(RulesDataService);
  private readonly catalogs = inject(SummonCatalogService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject(DataTextService);

  private readonly present = computed(() =>
    this.store.all().some((r) => r.character.id === this.id()),
  );

  protected readonly view = resource({
    params: () => ({ id: this.id(), present: this.present() }),
    loader: async ({ params }) => {
      const [record, rules, catalog] = await Promise.all([
        this.store.get(params.id),
        this.rules.load(),
        this.catalogs.load(),
      ]);
      if (!record) return null;
      const sheet = computeSheet(record.character, rules);
      const sources = summonSourcesOf(record.character, sheet, rules.subclasses, catalog);
      return { record, sheet, catalog, sources };
    },
  });

  protected readonly summons = computed<SummonsState>(
    () => this.view.value()?.record.character.state.summons ?? emptySummons(),
  );
  protected readonly summonedTotal = computed(() => summonedCount(this.summons()));

  protected readonly groups = computed<GroupView[]>(() => {
    const v = this.view.value();
    if (!v) return [];
    this.data.shownLanguage();
    const state = this.summons();
    const out: GroupView[] = [];
    for (const source of v.sources) {
      const slot = slotLevelOf(source, v.sheet, state.scale[source.id]);
      const type = state.types[source.id] ?? source.typeChoices[0] ?? '';
      const ctx = contextFor(source, v.sheet, slot);
      const all: CardView[] = [];
      for (const option of source.options) {
        const resolved = resolveOption(source, option, ctx, v.catalog, type);
        if (!resolved) continue;
        const key = creatureKey(source.id, option.key);
        const own = creatureOf(state, key);
        const monster = resolved.monster;
        all.push({
          key,
          label: this.label(option, monster),
          monster,
          instance: toCombatMonster(key, monster, own),
          on: own.on,
          mutate: (f) => this.commit(updateCreature(this.summons(), key, monster, f)),
        });
      }
      const long = all.length > MANY;
      const cards = all.filter((c) => c.on || (!long && !state.hideInactive));
      const others = long && !state.hideInactive ? all.filter((c) => !c.on) : [];
      if (state.hideInactive && source.coverage !== 'text' && !cards.length) continue;
      const max = maxSlotOf(source, v.sheet);
      out.push({
        source,
        slot,
        slots: Array.from(
          { length: Math.max(0, max - source.minSlot + 1) },
          (_, i) => source.minSlot + i,
        ),
        type,
        cards,
        others,
      });
    }
    return out;
  });

  /** Nothing to show with "hide the ones not summoned" on. */
  protected readonly nothingOut = computed(
    () =>
      this.summons().hideInactive && !this.groups().length && !!this.view.value()?.sources.length,
  );

  // -- the full stat block --------------------------------------------------------------
  protected readonly shown = signal<CardView | null>(null);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected openSheet(card: CardView): void {
    this.shown.set(card);
    this.dialog()?.nativeElement.showModal();
  }

  protected closeSheet(): void {
    this.dialog()?.nativeElement.close();
  }

  protected isCompendium(card: CardView): boolean {
    return !card.monster.id.startsWith('summon:');
  }

  // -- names ----------------------------------------------------------------------------
  private tr(key: string, fallback: string): string {
    const text = this.i18n.t(key as never);
    return text === key ? fallback : text;
  }

  private label(option: SummonOption, monster: Monster): string {
    if (option.kind === 'monster') return this.data.shortName(monster.name);
    const title = option.template!.title;
    const base = this.tr(`summons.c.${slug(title)}`, title);
    if (!option.variant) return base;
    return `${base} (${this.tr(`summons.v.${slug(option.variant)}`, option.variant)})`;
  }

  protected typeName(type: string): string {
    const name = term(this.i18n.language(), 'creatureType', type);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  // -- changes --------------------------------------------------------------------------
  private saves = Promise.resolve();

  private commit(next: SummonsState): void {
    const v = this.view.value();
    if (!v) return;
    const character: Character = {
      ...v.record.character,
      state: { ...v.record.character.state, summons: next },
    };
    this.view.set({ ...v, record: { ...v.record, character } });
    this.changed.emit(character);
    this.saves = this.saves
      .then(() => this.sync.saveSoon(character))
      .then(
        () => undefined,
        (e) => console.error(e),
      );
  }

  protected toggle(key: string, on: boolean): void {
    this.commit(setSummoned(this.summons(), key, on));
  }

  protected hideInactive(hide: boolean): void {
    this.commit(setHideInactive(this.summons(), hide));
  }

  protected slotChosen(source: SummonSource, e: Event): void {
    this.commit(setScale(this.summons(), source.id, +(e.target as HTMLSelectElement).value));
  }

  protected typeChosen(source: SummonSource, e: Event): void {
    this.commit(setType(this.summons(), source.id, (e.target as HTMLSelectElement).value));
  }

  protected dismiss(): void {
    this.commit(dismissAll(this.summons()));
  }

  protected reset(): void {
    if (confirm(this.i18n.t('summons.confirmReset'))) this.commit(resetSummons(this.summons()));
  }
}
