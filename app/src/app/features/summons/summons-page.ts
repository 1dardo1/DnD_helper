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

import {
  CannonAspect,
  CannonSize,
  CreateSource,
  MENDING_HEAL_AVERAGE,
  artificerClassOf,
  canCreateCannon,
  cannonHpMax,
  cannonMonster,
  createCannon,
  dismissCannon,
  hasEldritchCannon,
  hasFreeCreate,
  healCannon,
  toCannonInstance,
  updateCannon,
} from '../../core/artificer/cannon';
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
  creaturesOfSource,
  maxSlotOf,
  optionLabel,
  summonSourcesOf,
} from '../../core/summons/catalog';
import { SummonCatalogService } from '../../core/summons/summon-catalog.service';
import {
  SummonsState,
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
import { WildShapePanel } from '../states/wild-shape-panel';
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

/**
 * The creatures a character can summon with its spells and features: a card per creature (the
 * combat helper's monster card) with a toggle for "summoned", its hit points and limited uses
 * saved in the character, and the full stat block one tap away.
 */
@Component({
  selector: 'app-summons-page',
  imports: [
    RouterLink,
    TranslatePipe,
    DataNamePipe,
    LoadError,
    MonsterCard,
    MonsterStatBlock,
    WildShapePanel,
  ],
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
    // once the free Eldritch Cannon creation is spent, the form defaults to paying with a slot
    effect(() => {
      if (!this.cannonFreeAvailable()) untracked(() => this.cannonSourceFree.set(false));
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
      const { slot, type, creatures } = creaturesOfSource(source, v.sheet, v.catalog, state);
      const all: CardView[] = creatures.map(({ key, option, monster, state: own }) => ({
        key,
        label: this.label(option, monster),
        monster,
        instance: toCombatMonster(key, monster, own),
        on: own.on,
        mutate: (f) => this.commit(updateCreature(this.summons(), key, monster, f)),
      }));
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
    return optionLabel(
      option,
      monster,
      (key, fallback) => this.tr(key, fallback),
      (name) => this.data.shortName(name),
    );
  }

  protected typeName(type: string): string {
    const name = term(this.i18n.language(), 'creatureType', type);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  // -- changes --------------------------------------------------------------------------
  private saves = Promise.resolve();

  private commitCharacter(character: Character): void {
    const v = this.view.value();
    if (!v) return;
    this.view.set({ ...v, record: { ...v.record, character } });
    this.changed.emit(character);
    this.saves = this.saves
      .then(() => this.sync.saveSoon(character))
      .then(
        () => undefined,
        (e) => console.error(e),
      );
  }

  /** Known forms or the form taken (the Wild Shape panel). */
  protected wildShapeChanged(character: Character): void {
    this.commitCharacter(character);
  }

  private commit(next: SummonsState): void {
    const v = this.view.value();
    if (!v) return;
    this.commitCharacter({
      ...v.record.character,
      state: { ...v.record.character.state, summons: next },
    });
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

  // -- the Artillerist's Eldritch Cannon -------------------------------------------------
  protected readonly hasCannon = computed(() => {
    const v = this.view.value();
    return !!v && hasEldritchCannon(v.record.character);
  });

  private readonly cannonLevel = computed(() => {
    const v = this.view.value();
    return v ? (artificerClassOf(v.record.character)?.level ?? 0) : 0;
  });

  private readonly cannonSpellDc = computed(() => {
    const v = this.view.value();
    if (!v) return 10;
    const caster = v.sheet.spellcasting.classes.find((c) => c.classId === 'artificer');
    return caster?.saveDc ?? 8 + v.sheet.proficiencyBonus + v.sheet.abilities.INT.modifier;
  });

  protected readonly cannonState = computed(() => this.view.value()?.record.character.state.cannon);

  protected readonly cannonSlots = computed(
    () => this.view.value()?.sheet.spellcasting.slots ?? [],
  );

  protected readonly cannonCanCreate = computed(() => {
    const v = this.view.value();
    return !!v && canCreateCannon(v.record.character, this.cannonSlots());
  });

  protected readonly cannonFreeAvailable = computed(() => {
    const v = this.view.value();
    return !!v && hasFreeCreate(v.record.character);
  });

  protected readonly cannonMonsterView = computed(() => {
    const v = this.view.value();
    const cannon = this.cannonState();
    if (!v || !cannon?.active) return null;
    const level = this.cannonLevel();
    const intMod = v.sheet.abilities.INT.modifier;
    const monster = cannonMonster(cannon, level, this.cannonSpellDc(), intMod);
    const instance = toCannonInstance(cannon, cannonHpMax(level));
    return { monster, instance };
  });

  /** Pending choices for the creation form, shown while no cannon is out. */
  protected readonly cannonSize = signal<CannonSize>('Small');
  protected readonly cannonAspect = signal<CannonAspect>('legs');
  protected readonly cannonSourceFree = signal(true);
  protected readonly cannonSlotLevel = signal(1);

  protected deployCannon(): void {
    const v = this.view.value();
    if (!v) return;
    const source: CreateSource = this.cannonSourceFree()
      ? { kind: 'free' }
      : { kind: 'slot', level: this.cannonSlotLevel() };
    const next = createCannon(
      v.record.character,
      this.cannonSize(),
      this.cannonAspect(),
      source,
      this.cannonSlots(),
    );
    if (next) this.commitCharacter(next);
  }

  protected healCannonInstead(): void {
    const v = this.view.value();
    if (!v) return;
    this.commitCharacter(healCannon(v.record.character, MENDING_HEAL_AVERAGE));
  }

  protected dismissCannonCard(): void {
    const v = this.view.value();
    if (!v) return;
    this.commitCharacter(dismissCannon(v.record.character));
  }

  protected mutateCannon(f: (m: CombatMonster) => CombatMonster): void {
    const v = this.view.value();
    if (!v) return;
    this.commitCharacter(updateCannon(v.record.character, this.cannonLevel(), f));
  }

  /** A stable reference for the template, so the card's mutator doesn't change every render. */
  protected readonly cannonMutator = (f: (m: CombatMonster) => CombatMonster) =>
    this.mutateCannon(f);

  protected cannonSelect(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  protected openCannonSheet(): void {
    const cv = this.cannonMonsterView();
    if (!cv) return;
    this.openSheet({
      key: 'artificer:eldritch-cannon',
      label: this.i18n.t('cannon.title'),
      monster: cv.monster,
      instance: cv.instance,
      on: true,
      mutate: (f) => this.mutateCannon(f),
    });
  }
}
