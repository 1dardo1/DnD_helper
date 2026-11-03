import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { wearArmor, wearShield } from '../../core/characters/inventory';
import { SyncService } from '../../core/characters/sync.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import {
  Note,
  POINT_BUY_BUDGET,
  RARE_LANGUAGES,
  STANDARD_ARRAY,
  STANDARD_LANGUAGES,
  STEPS,
  Step,
  expertiseCount,
  featIssues,
  featSlots,
  featsForSlot,
  optionGroupsFor,
  pointBuyCost,
  review,
  skillPicks,
  spellListOf,
  spellsFor,
  subclassesFor,
  toolChoices,
} from '../../core/creation/creation-rules';
import { DataNamePipe, DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermPipe, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character, newCharacter, normalizeCharacter } from '../../core/models/character';
import { Ability, ClassOption, DndClass, Feat, Feature, Item } from '../../core/models/compendium';
import { castingOf, computeSheet } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import {
  StartingChoice,
  applyStartingEquipment,
  goldLeftCp,
  goldOnlyPackage,
  itemIndex,
  parseStartingEquipment,
  shopCatalog,
  shopPriceCp,
} from '../../core/rules/starting-equipment';
import { ABILITIES } from '../../core/rules/tables';
import { SettingsService } from '../../core/settings/settings.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { ENTRY_FACETS } from '../../shared/picker/entry-facets';
import { EntryCard } from '../../shared/picker/entry-card';
import { Picker } from '../../shared/picker/picker';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';
import { LoadError } from '../compendium/load-error';

const DRAFT_KEY = 'dnd-helper.draft';

type ClassEntry = Character['classes'][number];

/**
 * Character creation (and editing) wizard, step by step in the 2024 order. The draft is kept in
 * this browser until saved, every step shows the sheet the rules engine computes from it, and
 * choices that break a requirement are allowed but flagged (the DM may allow exceptions).
 */
@Component({
  selector: 'app-character-create',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    TranslatePipe,
    TermPipe,
    DataNamePipe,
    DataTextPipe,
    MarkdownPipe,
    LoadError,
    ClassThemeDirective,
    Picker,
    EntryCard,
  ],
  templateUrl: './character-create.html',
  styleUrl: './character-create.scss',
})
export class CharacterCreate {
  /** Route parameter when editing an existing character (characters/:id/edit). */
  readonly id = input<string>();
  private readonly compendium = inject(CompendiumService);
  private readonly rules = inject(RulesDataService);
  private readonly store = inject(CharacterStore);
  private readonly sync = inject(SyncService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);
  private readonly dataText = inject(DataTextService);

  protected readonly steps = STEPS;
  protected readonly abilities = ABILITIES;
  protected readonly standardArray = STANDARD_ARRAY;
  protected readonly budget = POINT_BUY_BUDGET;
  protected readonly languages = [...STANDARD_LANGUAGES, ...RARE_LANGUAGES];
  protected readonly rareLanguages = RARE_LANGUAGES;
  // filters of each card picker
  protected readonly classFacets = ENTRY_FACETS.class;
  protected readonly subclassFacets = ENTRY_FACETS.subclass.filter((k) => k !== 'class');
  protected readonly backgroundFacets = ENTRY_FACETS.background;
  protected readonly speciesFacets = ENTRY_FACETS.species;
  /** Feats for a slot are already of its kind (Fighting Style, general...): no category filter. */
  protected readonly featFacets = ENTRY_FACETS.feat.filter((k) => k !== 'category');
  /** All from the class's own list, so no class filter. */
  protected readonly spellFacets = ENTRY_FACETS.spell.filter((k) => k !== 'class');

  protected readonly step = signal<Step>('class');
  protected readonly draft = signal<Character>(newCharacter('', ''));
  private loadedFor: string | null | undefined = undefined;

  /** Everything the wizard offers choices from. */
  protected readonly data = resource({
    loader: async () => {
      const [rules, spells, options, meta] = await Promise.all([
        this.rules.load(),
        this.compendium.all('spell'),
        this.compendium.all('option'),
        this.compendium.getMeta(),
      ]);
      const sorted = <T extends { name: string }>(xs: Iterable<T>) =>
        [...xs].sort((a, b) => a.name.localeCompare(b.name));
      return {
        rules,
        spells,
        spellsById: new Map(spells.map((s) => [s.id, s])),
        options,
        meta,
        classes: sorted(rules.classes.values()),
        species: sorted(rules.species.values()),
        backgrounds: sorted(rules.backgrounds.values()),
        feats: [...rules.feats.values()],
        armor: sorted(
          [...rules.items.values()].filter((i) => i.armor && i.armor.kind !== 'shield' && !i.magic),
        ),
      };
    },
  });

  // -- what's selected ----------------------------------------------------------------
  /** The character's classes with everything each one offers. The first is the starting class. */
  protected readonly rows = computed(() => {
    const d = this.data.value();
    return this.draft().classes.map((entry, index) => {
      const cls = d?.rules.classes.get(entry.id);
      if (!d || !cls) {
        return {
          index,
          entry,
          cls,
          sub: undefined,
          subclasses: [],
          slots: [],
          optionGroups: [],
          expertise: 0,
          spells: null,
        };
      }
      const sub = entry.subclassId ? d.rules.subclasses.get(entry.subclassId) : undefined;
      const sc = castingOf(cls, sub);
      const sl = sc ? spellsFor(spellListOf(cls, sc), sc, entry.level, d.spells) : null;
      return {
        index,
        entry,
        cls,
        subclasses: subclassesFor(cls.id, [...d.rules.subclasses.values()]),
        slots: featSlots(cls, entry.level),
        optionGroups: optionGroupsFor(cls, entry.level, entry.subclassId, d.options),
        expertise: expertiseCount(cls, entry.level),
        sub,
        spells: sl && {
          cantrips: sl.cantrips,
          leveled: sl.leveled,
          cantripCount: sc!.cantripsByLevel?.[entry.level - 1] ?? null,
          preparedCount: sc!.preparedByLevel?.[entry.level - 1] ?? null,
        },
      };
    });
  });
  protected readonly classList = computed(() =>
    this.rows()
      .map((r) => r.cls)
      .filter((c): c is DndClass => !!c),
  );
  protected readonly totalLevel = computed(() =>
    this.draft().classes.reduce((n, c) => n + c.level, 0),
  );
  protected readonly background = computed(() => {
    const id = this.draft().background?.id;
    return id ? this.data.value()?.rules.backgrounds.get(id) : undefined;
  });
  protected readonly species = computed(() => {
    const id = this.draft().species?.id;
    return id ? this.data.value()?.rules.species.get(id) : undefined;
  });
  /** The species' lineages or variants, as picker items (the name is their id). */
  protected readonly variants = computed(() =>
    (this.species()?.variants ?? []).map((v) => ({ ...v, id: v.name })),
  );
  protected readonly skillChoice = computed(() => skillPicks(this.classList()));
  protected readonly expertiseTotal = computed(() =>
    this.rows().reduce((n, r) => n + r.expertise, 0),
  );
  protected readonly tools = computed(() => toolChoices(this.classList(), this.background()));

  // -- starting equipment ----------------------------------------------------------------
  private readonly itemIdx = computed(() =>
    itemIndex(this.data.value()?.rules.items.values() ?? []),
  );
  private get items(): Map<string, Item> {
    return this.data.value()?.rules.items ?? new Map();
  }
  /** The book's packages (A, B, C) of the starting class and of the background. */
  protected readonly packages = computed(() => ({
    class: parseStartingEquipment(this.classList()[0]?.startingEquipment, this.itemIdx()),
    background: parseStartingEquipment(this.background()?.equipment, this.itemIdx()),
  }));
  protected readonly startChoice = computed<StartingChoice>(
    () => this.draft().choices.startingEquipment ?? { class: null, background: null, bought: [] },
  );
  /** Gold left to spend, in copper pieces. */
  protected readonly goldLeft = computed(() =>
    goldLeftCp(this.startChoice(), this.packages(), this.items),
  );
  protected readonly bought = computed(() =>
    this.startChoice()
      .bought.map((b) => ({ ...b, item: this.items.get(b.itemId)!, price: 0 }))
      .filter((b) => b.item)
      .map((b) => ({ ...b, price: shopPriceCp(b.item) ?? 0 })),
  );
  /** Everything that can be bought: items with a price, magic ones at the DMG price. */
  protected readonly shopItems = computed(() => shopCatalog(this.items.values()));
  /** Gold of the chosen options, before buying anything (copper pieces). */
  protected readonly startGold = computed(
    () => this.goldLeft() + this.bought().reduce((n, b) => n + b.price * b.qty, 0),
  );
  protected readonly affordModes = ['all', 'start', 'left'] as const;
  /** Shop filter: everything, what the starting gold pays for, or what the gold left pays for. */
  protected readonly shopAfford = signal<'all' | 'start' | 'left'>('all');
  protected readonly shopVisible = computed(() => {
    const mode = this.shopAfford();
    if (mode === 'all') return this.shopItems();
    const max = mode === 'start' ? this.startGold() : this.goldLeft();
    return this.shopItems().filter((i) => (shopPriceCp(i) ?? Infinity) <= max);
  });
  /** How many of each item the character carries (packages, purchases and hand-added). */
  protected readonly owned = computed(() => {
    const out = new Map<string, number>();
    for (const e of this.draft().inventory)
      if (e.itemId) out.set(e.itemId, (out.get(e.itemId) ?? 0) + e.qty);
    return out;
  });
  protected readonly ownedIds = computed(() => [...this.owned().keys()]);
  /** Gold-only option of the class and of the background, if they have one. */
  protected readonly goldPackages = computed(() => ({
    class: goldOnlyPackage(this.packages().class),
    background: goldOnlyPackage(this.packages().background),
  }));
  protected readonly shopOpen = signal(false);
  protected readonly equipKinds = ['class', 'background'] as const;
  protected readonly itemFacets = ENTRY_FACETS.item;
  protected readonly shopPrice = shopPriceCp;

  /** The sheet as it stands, recomputed on every change. */
  protected readonly sheet = computed(() => {
    const d = this.data.value();
    return d ? computeSheet(this.draft(), d.rules) : null;
  });
  protected readonly notes = computed(() => {
    const d = this.data.value();
    return review(this.draft(), {
      classes: this.rows().map((r) => r.cls),
      subclasses: this.rows().map((r) => r.sub),
      background: this.background(),
      species: this.species(),
      sheet: this.sheet(),
      feats: d?.rules.feats ?? new Map(),
      spells: d?.spellsById ?? new Map(),
    });
  });
  protected readonly allNotes = computed(() => STEPS.flatMap((s) => this.notes()[s]));

  constructor() {
    // Load the character being edited, or the saved draft of a new one.
    effect(() => {
      const id = this.id() ?? null;
      // A first visit can arrive before the pull brings the character: load again when it shows up.
      const present = !!id && this.store.all().some((r) => r.character.id === id);
      const key = `${id}|${present}`;
      if (this.loadedFor === key) return;
      this.loadedFor = key;
      if (id) {
        void this.store.get(id).then((r) => r && this.draft.set(normalizeCharacter(r.character)!));
      } else {
        this.draft.set(loadDraft() ?? this.blank());
      }
    });
    // Keep the draft of a new character in this browser until it's saved.
    effect(() => {
      if (!this.id()) saveDraft(this.draft());
    });
  }

  /** A new character starts with one empty class row to fill in. */
  private blank(): Character {
    const c = newCharacter('', this.settings.settings().deviceName);
    return { ...c, classes: [{ id: '', level: 1, subclassId: null, hp: [null] }] };
  }

  // -- generic helpers -----------------------------------------------------------------
  protected patch(fn: (c: Character) => Character): void {
    this.draft.update((c) => fn(structuredClone(c)));
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected toggle(list: string[], id: string, on: boolean): string[] {
    return on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
  }

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  protected readonly skillLabel = (s: string) => this.i18n.t(`skill.${s}` as never);
  protected readonly abilityLabel = (a: string) => this.i18n.t(`ability.${a}` as never);

  /** Option group label: the glossary's, else "eldritch-invocation" → "Eldritch Invocation". */
  protected groupLabel(group: string): string {
    const pretty = group.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    const translated = term(this.i18n.language(), 'optionGroup', group);
    return translated === group ? pretty : translated;
  }

  /** The background's tool, or the kind of tool it lets you choose, in the current language. */
  protected backgroundTools(): string {
    const choice = this.tools().find((t) => t.slot === 'background');
    if (choice)
      return `${this.i18n.t('create.chooseOne' as never)} ${this.toolGroupLabel(choice.groups)}`;
    return term(this.i18n.language(), 'tool', this.background()?.tools);
  }

  protected toolGroupLabel(groups: string[]): string {
    return groups.map((g) => term(this.i18n.language(), 'toolGroup', g)).join(' / ');
  }

  /** A note's text, with tool groups, languages and ability abbreviations translated. */
  protected noteText(n: Note): string {
    const params = { ...n.params };
    if (typeof params['group'] === 'string')
      params['group'] = this.toolGroupLabel(params['group'].split(' / '));
    for (const k of ['feat', 'cls'])
      if (typeof params[k] === 'string') params[k] = this.dataText.shortName(params[k] as string);
    if (n.key === 'create.issue.rareLanguage')
      params['what'] = term(this.i18n.language(), 'language', String(params['what']));
    else if (typeof params['what'] === 'string')
      params['what'] = params['what'].replace(/\b(STR|DEX|CON|INT|WIS|CHA)\b/g, (a) =>
        this.i18n.t(`abbr.${a}` as never),
      );
    return this.i18n.t(n.key as never, params);
  }

  // -- steps ---------------------------------------------------------------------------
  protected missingIn(s: Step): Note[] {
    return this.notes()[s].filter((n) => n.kind === 'missing');
  }

  protected issuesIn(s: Step): Note[] {
    return this.notes()[s].filter((n) => n.kind === 'issue');
  }

  /** Ticked when nothing is missing and something was actually chosen in it. */
  protected isDone(s: Step): boolean {
    if (this.missingIn(s).length) return false;
    if (s === 'choices') return this.classList().length > 0;
    if (s === 'equipment') return !!this.draft().equipment;
    return true;
  }

  protected stepIndex(): number {
    return STEPS.indexOf(this.step());
  }

  protected go(delta: number): void {
    const i = Math.min(Math.max(this.stepIndex() + delta, 0), STEPS.length - 1);
    this.setStep(STEPS[i]);
  }

  private readonly injector = inject(Injector);
  private readonly stepsNav = viewChild<ElementRef<HTMLElement>>('stepsNav');
  private readonly stepSection = viewChild<ElementRef<HTMLElement>>('stepSection');

  protected setStep(s: Step): void {
    if (s === 'equipment') this.prefillEquipment();
    const changed = s !== this.step();
    this.step.set(s);
    if (changed) {
      // go to the top of the new step (the button pressed was usually at the bottom)
      afterNextRender(
        () => {
          const nav = this.stepsNav()?.nativeElement;
          nav?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          // on phones the tabs scroll sideways: centre the current one
          const cur = nav?.querySelector<HTMLElement>('.current');
          if (nav && cur && nav.scrollWidth > nav.clientWidth)
            nav.scrollTo({
              left: cur.offsetLeft - nav.offsetLeft - (nav.clientWidth - cur.clientWidth) / 2,
              behavior: 'smooth',
            });
          this.stepSection()?.nativeElement.focus({ preventScroll: true });
        },
        { injector: this.injector },
      );
    }
  }

  // -- classes -------------------------------------------------------------------------
  protected setClass(index: number, id: string): void {
    this.patch((c) => {
      const old = c.classes[index];
      const level = old?.level ?? 1;
      if (id) c.classes[index] = { id, level, subclassId: null, hp: Array(level).fill(null) };
      else c.classes.splice(index, 1);
      if (old) this.forgetClass(c, old.id);
      return c;
    });
  }

  protected addClass(): void {
    this.patch((c) => ({
      ...c,
      classes: [...c.classes, { id: '', level: 1, subclassId: null, hp: [null] }],
    }));
  }

  protected removeClass(index: number): void {
    this.patch((c) => {
      const [gone] = c.classes.splice(index, 1);
      if (gone) this.forgetClass(c, gone.id);
      return c;
    });
  }

  protected setLevel(index: number, raw: string): void {
    const level = Math.min(Math.max(parseInt(raw, 10) || 1, 1), 20);
    const cls = this.rows()[index]?.cls;
    this.patch((c) => {
      const k = c.classes[index];
      if (!k) return c;
      k.level = level;
      k.hp = Array.from({ length: level }, (_, i) => k.hp[i] ?? null);
      if (cls && level < cls.subclassLevel) k.subclassId = null;
      if (cls) {
        const valid = new Set(featSlots(cls, level).map((s) => s.slot));
        const mine = (slot: string) => slot.startsWith(`${cls.id}:`);
        c.choices.featSlots = c.choices.featSlots.filter((s) => !mine(s.slot) || valid.has(s.slot));
        c.choices.abilityIncreases = c.choices.abilityIncreases.filter(
          (i) => !i.slot || !mine(i.slot) || valid.has(i.slot),
        );
      }
      return c;
    });
  }

  protected setSubclass(index: number, id: string): void {
    this.patch((c) => {
      if (c.classes[index]) c.classes[index].subclassId = id || null;
      return c;
    });
  }

  protected setSpellAbility(index: number, ability: string): void {
    this.patch((c) => {
      if (c.classes[index]) c.classes[index].spellAbility = (ability || null) as Ability | null;
      return c;
    });
  }

  protected setHp(index: number, levelIndex: number, raw: string): void {
    const n = parseInt(raw, 10);
    this.patch((c) => {
      if (c.classes[index]) c.classes[index].hp[levelIndex] = Number.isNaN(n) ? null : n;
      return c;
    });
  }

  protected levels(entry: ClassEntry): number[] {
    return this.range(entry.level);
  }

  /** Drops the choices that belonged to a class that was changed or removed. */
  private forgetClass(c: Character, classId: string): void {
    if (!classId || c.classes.some((k) => k.id === classId)) return;
    const mine = (slot?: string) => !!slot && slot.startsWith(`${classId}:`);
    const options = new Set(
      (this.data.value()?.options ?? []).filter((o) => o.classId === classId).map((o) => o.id),
    );
    const spells = new Set(
      (this.data.value()?.spells ?? []).filter((s) => s.classes.includes(classId)).map((s) => s.id),
    );
    c.choices.featSlots = c.choices.featSlots.filter((s) => !mine(s.slot));
    c.choices.abilityIncreases = c.choices.abilityIncreases.filter((i) => !mine(i.slot));
    c.choices.toolChoices = c.choices.toolChoices.filter((t) => !t.slot.endsWith(`:${classId}`));
    c.choices.options = c.choices.options.filter((o) => !options.has(o));
    c.choices.spells = c.choices.spells.filter((s) => !spells.has(s));
    const offered = new Set(
      skillPicks(
        c.classes
          .map((k) => this.data.value()?.rules.classes.get(k.id))
          .filter((k): k is DndClass => !!k),
      ).from,
    );
    c.choices.skills = c.choices.skills.filter((s) => offered.has(s));
    c.choices.expertise = c.choices.expertise.filter((s) => c.choices.skills.includes(s));
  }

  // -- background ----------------------------------------------------------------------
  protected setBackground(id: string): void {
    this.patch((c) => {
      c.background = id ? { id, abilityIncreases: {} } : null;
      c.choices.toolChoices = c.choices.toolChoices.filter((t) => t.slot !== 'background');
      return c;
    });
  }

  /** "2-1" (+2 to one, +1 to another) or "1-1-1" (+1 to all three). */
  protected backgroundMode(): '2-1' | '1-1-1' {
    const v = Object.values(this.draft().background?.abilityIncreases ?? {});
    return v.length === 3 && v.every((x) => x === 1) ? '1-1-1' : '2-1';
  }

  protected setBackgroundMode(mode: string): void {
    const bg = this.background();
    if (!bg) return;
    this.patch((c) => {
      c.background!.abilityIncreases =
        mode === '1-1-1' ? Object.fromEntries(bg.abilityScores.map((a) => [a, 1])) : {};
      return c;
    });
  }

  protected backgroundPick(amount: 1 | 2): Ability | '' {
    const inc = this.draft().background?.abilityIncreases ?? {};
    return (Object.entries(inc).find(([, v]) => v === amount)?.[0] as Ability) ?? '';
  }

  protected setBackgroundPick(amount: 1 | 2, ability: string): void {
    this.patch((c) => {
      const inc = { ...(c.background?.abilityIncreases ?? {}) };
      for (const [a, v] of Object.entries(inc))
        if (v === amount || a === ability) delete inc[a as Ability];
      if (ability) inc[ability as Ability] = amount;
      c.background!.abilityIncreases = inc;
      return c;
    });
  }

  // -- species, size, languages ----------------------------------------------------------
  protected setSpecies(id: string): void {
    this.patch((c) => {
      c.species = id ? { id, variant: null } : null;
      c.size = null;
      return c;
    });
  }

  protected setVariant(name: string): void {
    this.patch((c) => {
      if (c.species) c.species.variant = name || null;
      return c;
    });
  }

  protected traitNames(traits: Feature[]): string {
    return traits.map((t) => this.dataText.shortName(t.name)).join(', ');
  }

  protected setSize(size: string): void {
    this.patch((c) => ({ ...c, size: size || null }));
  }

  protected setLanguage(lang: string, on: boolean): void {
    this.patch((c) => {
      c.choices.languages = this.toggle(c.choices.languages, lang, on);
      return c;
    });
  }

  // -- tools -----------------------------------------------------------------------------
  protected toolsIn(slot: string): string[] {
    return this.draft().choices.toolChoices.find((t) => t.slot === slot)?.tools ?? [];
  }

  protected setTool(slot: string, tool: string, on: boolean): void {
    this.patch((c) => {
      const tools = this.toggle(this.toolsIn(slot), tool, on);
      c.choices.toolChoices = [
        ...c.choices.toolChoices.filter((t) => t.slot !== slot),
        { slot, tools },
      ];
      return c;
    });
  }

  // -- ability scores --------------------------------------------------------------------
  protected setMethod(method: string): void {
    const fill = (n: number) =>
      Object.fromEntries(ABILITIES.map((a) => [a, n])) as Record<Ability, number>;
    const base = method === 'standard' ? fill(0) : method === 'manual' ? fill(10) : fill(8);
    this.patch((c) => {
      c.abilityScores = { method: method as 'standard' | 'point-buy' | 'manual', base };
      return c;
    });
  }

  protected setScore(a: Ability, raw: string): void {
    const n = parseInt(raw, 10) || 0;
    this.patch((c) => {
      if (!c.abilityScores) return c;
      if (c.abilityScores.method === 'standard') {
        // each value of the array once: give the ability that had it the old value
        const other = ABILITIES.find((x) => x !== a && c.abilityScores!.base[x] === n);
        if (other) c.abilityScores.base[other] = c.abilityScores.base[a];
      }
      c.abilityScores.base[a] = n;
      return c;
    });
  }

  /** Whether the − / + buttons can move this score (limits, and the point-buy budget). */
  protected canStep(a: Ability, delta: number): boolean {
    const s = this.draft().abilityScores;
    if (!s) return false;
    const n = s.base[a] + delta;
    if (s.method === 'point-buy')
      return n >= 8 && n <= 15 && pointBuyCost({ ...s.base, [a]: n }) <= POINT_BUY_BUDGET;
    return n >= 3 && n <= 20;
  }

  protected stepScore(a: Ability, delta: number): void {
    const s = this.draft().abilityScores;
    if (s && this.canStep(a, delta)) this.setScore(a, String(s.base[a] + delta));
  }

  protected pointsSpent(): number {
    const s = this.draft().abilityScores;
    return s ? pointBuyCost(s.base) : 0;
  }

  // -- class choices -------------------------------------------------------------------
  protected setSkill(id: string, on: boolean): void {
    this.patch((c) => {
      c.choices.skills = this.toggle(c.choices.skills, id, on);
      if (!on) c.choices.expertise = c.choices.expertise.filter((x) => x !== id);
      return c;
    });
  }

  protected setExpertise(id: string, on: boolean): void {
    this.patch((c) => {
      c.choices.expertise = this.toggle(c.choices.expertise, id, on);
      return c;
    });
  }

  /** Skills the character is proficient in (background + chosen), for Expertise. */
  protected proficientSkills(): string[] {
    return [...new Set([...(this.background()?.skills ?? []), ...this.draft().choices.skills])];
  }

  protected slotFeat(slot: string): string {
    return this.draft().choices.featSlots.find((s) => s.slot === slot)?.featId ?? '';
  }

  protected slotFeatEntry(slot: string): Feat | undefined {
    const id = this.slotFeat(slot);
    return id ? this.data.value()?.rules.feats.get(id) : undefined;
  }

  protected featsFor(kind: 'asi' | 'fighting-style' | 'epic-boon'): Feat[] {
    return featsForSlot(kind, this.data.value()?.feats ?? []);
  }

  /** Why this character can't normally take a feat (empty = it can). */
  protected featProblems(feat: Feat | undefined): Note[] {
    const sheet = this.sheet();
    if (!feat || !sheet) return [];
    return featIssues(feat, sheet, this.draft().species?.id ?? null).map((n) => ({
      ...n,
      params: { ...n.params, feat: feat.name },
    }));
  }

  /** Options above the class level are listed but flagged. */
  protected optionTooHigh(o: ClassOption, level: number): boolean {
    return (o.prerequisites?.level ?? 0) > level;
  }

  protected setSlotFeat(slot: string, featId: string): void {
    this.patch((c) => {
      c.choices.featSlots = [
        ...c.choices.featSlots.filter((s) => s.slot !== slot),
        { slot, featId: featId || null },
      ];
      c.choices.abilityIncreases = c.choices.abilityIncreases.filter((i) => i.slot !== slot);
      return c;
    });
  }

  /** Ability chosen for the n-th +1 of a slot (ASI gives two; same ability twice = +2). */
  protected slotAbility(slot: string, n: number): string {
    const incs = this.draft().choices.abilityIncreases.filter((i) => i.slot === slot);
    return incs.flatMap((i) => Array(i.amount).fill(i.ability))[n] ?? '';
  }

  protected setSlotAbility(slot: string, n: number, ability: string, picks: number): void {
    const featId = this.slotFeat(slot);
    this.patch((c) => {
      const current = Array.from({ length: picks }, (_, i) => this.slotAbility(slot, i));
      current[n] = ability;
      const counts = new Map<string, number>();
      for (const a of current.filter(Boolean)) counts.set(a, (counts.get(a) ?? 0) + 1);
      c.choices.abilityIncreases = [
        ...c.choices.abilityIncreases.filter((i) => i.slot !== slot),
        ...[...counts].map(([a, amount]) => ({
          source: featId,
          ability: a as Ability,
          amount,
          slot,
        })),
      ];
      return c;
    });
  }

  /** How many +1 picks a feat in a slot gives, and from which abilities. */
  protected slotPicks(feat: Feat | undefined): { picks: number; from: Ability[] } {
    // ASI: +2 to one ability or +1 to two (the same ability twice = +2)
    if (feat?.id === 'ability-score-improvement') return { picks: 2, from: ABILITIES };
    if (!feat?.abilityIncrease) return { picks: 0, from: [] };
    return { picks: feat.abilityIncrease.amount, from: feat.abilityIncrease.from };
  }

  protected setOption(id: string, on: boolean): void {
    this.patch((c) => {
      c.choices.options = this.toggle(c.choices.options, id, on);
      return c;
    });
  }

  protected setSpell(id: string, on: boolean): void {
    this.patch((c) => {
      c.choices.spells = this.toggle(c.choices.spells, id, on);
      return c;
    });
  }

  protected chosenCount(ids: string[], of: { id: string }[]): number {
    const set = new Set(of.map((x) => x.id));
    return ids.filter((id) => set.has(id)).length;
  }

  // -- equipment and details -----------------------------------------------------------
  /** First time on this step, start from the class and background starting equipment. */
  /** Entering the step: the packages may have changed with the class, background or tools. */
  protected prefillEquipment(): void {
    if (this.draft().choices.startingEquipment) this.applyStart(this.startChoice());
  }

  private applyStart(choice: StartingChoice): void {
    const first = this.classList()[0];
    const tools = {
      class: first ? this.toolsIn(`class:${first.id}`) : [],
      background: this.toolsIn('background'),
    };
    // a letter the new class or background doesn't have is forgotten
    const p = this.packages();
    const fixed: StartingChoice = {
      ...choice,
      class: p.class?.some((x) => x.letter === choice.class) ? choice.class : null,
      background: p.background?.some((x) => x.letter === choice.background)
        ? choice.background
        : null,
    };
    this.patch((c) => applyStartingEquipment(c, fixed, p, this.items, tools, this.itemIdx()));
  }

  /** Shortcut: the gold option everywhere there is one, and the shop open. */
  protected allGold(): void {
    const g = this.goldPackages();
    const c = this.startChoice();
    this.applyStart({
      ...c,
      class: g.class?.letter ?? c.class,
      background: g.background?.letter ?? c.background,
    });
    this.shopOpen.set(true);
  }

  protected choosePackage(kind: 'class' | 'background', letter: string): void {
    this.applyStart({ ...this.startChoice(), [kind]: letter });
  }

  /** Buys one more (if the gold left is enough). */
  protected buy(itemId: string): void {
    const item = this.items.get(itemId);
    const price = item ? shopPriceCp(item) : null;
    if (price === null || price > this.goldLeft()) return;
    const bought = [...this.startChoice().bought];
    const i = bought.findIndex((b) => b.itemId === itemId);
    if (i >= 0) bought[i] = { ...bought[i], qty: bought[i].qty + 1 };
    else bought.push({ itemId, qty: 1 });
    this.applyStart({ ...this.startChoice(), bought });
  }

  /** Gives one back. */
  protected unbuy(itemId: string): void {
    const bought = this.startChoice()
      .bought.map((b) => (b.itemId === itemId ? { ...b, qty: b.qty - 1 } : b))
      .filter((b) => b.qty > 0);
    this.applyStart({ ...this.startChoice(), bought });
  }

  /** 1234 cp → "12 po, 3 pp, 4 pc". */
  protected coins(cp: number): string {
    const n = Math.max(0, Math.round(cp));
    const parts: string[] = [];
    const lang = this.i18n.language();
    const gp = Math.floor(n / 100);
    if (gp || n === 0)
      parts.push(`${gp.toLocaleString(lang)} ${this.i18n.t('compendium.coin.gp')}`);
    if (Math.floor((n % 100) / 10))
      parts.push(`${Math.floor((n % 100) / 10)} ${this.i18n.t('compendium.coin.sp')}`);
    if (n % 10) parts.push(`${n % 10} ${this.i18n.t('compendium.coin.cp')}`);
    return parts.join(', ');
  }

  protected withName(name: string) {
    return (c: Character) => ({ ...c, name });
  }

  protected withNotes(notes: string) {
    return (c: Character) => ({ ...c, notes });
  }

  protected withEquipment(equipment: string) {
    return (c: Character) => ({ ...c, equipment });
  }

  protected withArmor(armorId: string) {
    return (c: Character) =>
      wearArmor(c, armorId || null, this.data.value()?.rules.items ?? new Map());
  }

  protected withShield(shield: boolean) {
    return (c: Character) => wearShield(c, shield, this.data.value()?.rules.items ?? new Map());
  }

  // -- save ------------------------------------------------------------------------------
  protected async save(): Promise<void> {
    const d = this.data.value();
    const name = this.draft().name.trim() || '?';
    // a new character's file is named after it (characters/elara-1730000000.json)
    const id = this.id() ?? newCharacter(name, '').id;
    const classes = this.draft().classes.filter((k) => k.id);
    const ch = { ...this.draft(), id, name, classes, dataVersion: d?.meta.generatedAt ?? null };
    await this.sync.save(ch);
    if (!this.id()) clearDraft();
    await this.router.navigate(['/characters', ch.id]);
  }

  /** Throws away the new character's draft and starts from the first step. */
  protected restart(): void {
    if (!confirm(this.i18n.t('create.confirmRestart'))) return;
    clearDraft();
    this.draft.set(this.blank());
    this.step.set('class');
  }

  /** Editing: forgets the changes not saved yet and goes back to the saved character. */
  protected async discard(): Promise<void> {
    const id = this.id();
    if (!id || !confirm(this.i18n.t('create.confirmDiscard'))) return;
    const r = await this.store.get(id);
    if (r) this.draft.set(normalizeCharacter(r.character)!);
    this.step.set('class');
  }
}

function loadDraft(): Character | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? normalizeCharacter(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveDraft(c: Character): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(c));
  } catch {
    // storage unavailable: the draft lasts until the page is closed
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // nothing to clear
  }
}
