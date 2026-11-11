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
import { Host, enhancementHosts } from '../../core/characters/enhancement';
import {
  BonusOption,
  armorSlot,
  enhancementOf,
  gearChoices,
  gearOf,
} from '../../core/characters/magic-base';
import { SyncService } from '../../core/characters/sync.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import {
  Note,
  POINT_BUY_BUDGET,
  RARE_LANGUAGES,
  STANDARD_ARRAY,
  STANDARD_LANGUAGES,
  STEPS,
  SlotKind,
  Step,
  expertiseCount,
  featIssues,
  featSlots,
  SPECIES_SLOT,
  featsForSlot,
  featsForSpecies,
  optionGroupFull,
  optionGroupsFor,
  optionLocks,
  optionUncheckedNote,
  visibleOptions,
  pointBuyCost,
  review,
  skillPicks,
  spellListOf,
  spellsFor,
  speciesFeatKind,
  subclassesFor,
  toolChoices,
} from '../../core/creation/creation-rules';
import {
  browserStorage,
  readEditDraft,
  removeEditDraft,
  restoreEditDraft,
  sameContent,
  writeEditDraft,
} from '../../core/creation/edit-draft';
import { clearStep, readStep, sessionMemory, writeStep } from '../../core/creation/wizard-memory';
import {
  NoteTarget,
  pendingBySteps,
  stepViews,
  wizardSteps,
} from '../../core/creation/wizard-steps';
import { summarize } from '../../core/creation/wizard-summary';
import {
  dropClassSpells,
  sharedCount,
  spellCasters,
  spellFields,
  spellMarks,
  spellsByClassOf,
  toggleSpellFor,
} from '../../core/creation/spell-choices';
import { DataNamePipe, DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { baseSummary } from '../../core/characters/base-label';
import { TermPipe, term } from '../../core/i18n/glossary';
import { I18nService, LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import {
  Character,
  FeatChoice,
  newCharacter,
  normalizeCharacter,
} from '../../core/models/character';
import { Ability, ClassOption, DndClass, Feat, Feature, Item } from '../../core/models/compendium';
import { attacksFor, proficientWith } from '../../core/rules/attacks';
import { weaponEntriesOf } from '../../core/characters/weapons';
import { castingOf, computeSheet } from '../../core/rules/engine';
import { FeatSource, listOfFeatName } from '../../core/rules/feat-effects';
import {
  SpeciesPick,
  SpeciesTraitView,
  hadValues,
  speciesAbility,
  speciesAbilityKey,
  speciesAbilityNeeded,
  speciesTraits,
} from '../../core/rules/species-picks';
import { traitChoiceFor, traitChoiceKey, translatedOptions } from '../../core/rules/trait-choices';
import { FeatChoices } from '../../shared/feat-choices';
import { resizeHp } from '../../core/creation/hp-levels';
import { PortraitPicker } from '../../shared/portrait-picker';
import { TraitChoice, TraitChoiceItem } from '../../shared/trait-choice';
import { PickOptionLabel, TraitPicks } from '../../shared/trait-picks';
import { RulesDataService } from '../../core/rules/rules-data.service';
import {
  BoughtItem,
  StartingChoice,
  applyStartingEquipment,
  goldLeftCp,
  goldOnlyPackage,
  itemIndex,
  parseStartingEquipment,
  sameBought,
  shopCatalog,
  shopPriceCp,
} from '../../core/rules/starting-equipment';
import { ABILITIES, SKILL_ABILITY } from '../../core/rules/tables';
import { FolderPrefs } from '../../core/organize/folder-prefs';
import { ClassInfo } from '../../shared/wizard/class-info';
import { FooterNote, WizardFooter } from '../../shared/wizard/wizard-footer';
import { ProgressStep, WizardProgress } from '../../shared/wizard/wizard-progress';
import { WizardStepHead } from '../../shared/wizard/wizard-step-head';
import { WizardSummaryPanel } from '../../shared/wizard/wizard-summary';
import { WizardHp } from '../../shared/wizard/wizard-hp';
import { PendingGroup, WizardPending } from '../../shared/wizard/wizard-pending';
import { useWizardTexts } from '../../shared/wizard/wizard-texts';
import { EntryDetails } from '../../shared/picker/entry-details';
import { SettingsService } from '../../core/settings/settings.service';
import { PLAN_GROUP, isPickId, plansTaken } from '../../core/artificer/plans';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { OptionRow } from '../../shared/option-row';
import { PlanChooser } from '../../shared/plan-chooser';
import { ENTRY_FACETS } from '../../shared/picker/entry-facets';
import { defaultOrder } from '../../shared/picker/entry-order';
import { EntryCard } from '../../shared/picker/entry-card';
import { Picker } from '../../shared/picker/picker';
import { LeaveCheck } from './unsaved-edit.guard';
import { LoadError } from '../compendium/load-error';
import { BackgroundEditor } from '../homebrew/background-editor';
import { HomebrewBadge } from '../homebrew/homebrew-badge';

const DRAFT_KEY = 'dnd-helper.draft';

type ClassEntry = Character['classes'][number];

/**
 * Character creation (and editing) wizard, step by step in the 2024 order. The draft is kept in
 * this browser until saved, every step shows the sheet the rules engine computes from it (the live
 * summary), and choices that break a requirement are allowed but flagged (the DM may allow
 * exceptions). Each step says what is decided in it and why; the footer says what's still missing
 * (a tap goes to it) and never locks the way on: an unfinished character can be saved.
 */
@Component({
  selector: 'app-character-create',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
  imports: [
    RouterLink,
    PortraitPicker,
    NgTemplateOutlet,
    TranslatePipe,
    LocalDatePipe,
    TermPipe,
    DataNamePipe,
    DataTextPipe,
    MarkdownPipe,
    OptionRow,
    PlanChooser,
    LoadError,
    Picker,
    FeatChoices,
    TraitChoice,
    TraitPicks,
    EntryCard,
    BackgroundEditor,
    HomebrewBadge,
    ClassInfo,
    EntryDetails,
    WizardFooter,
    WizardProgress,
    WizardStepHead,
    WizardSummaryPanel,
    WizardHp,
    WizardPending,
  ],
  templateUrl: './character-create.html',
  styleUrl: './character-create.scss',
})
export class CharacterCreate implements LeaveCheck {
  /** Route parameter when editing an existing character (characters/:id/edit). */
  readonly id = input<string>();
  private readonly compendium = inject(CompendiumService);
  private readonly rules = inject(RulesDataService);
  private readonly store = inject(CharacterStore);
  private readonly sync = inject(SyncService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly i18n: I18nService = useWizardTexts();
  private readonly dataText = inject(DataTextService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
  /** Editing: the saved character the draft is compared with (null until it's loaded). */
  private readonly editBase = signal<Character | null>(null);
  /** Editing: unsaved changes from a previous visit were put back (shown until dismissed). */
  protected readonly restored = signal<{
    outdated: boolean;
    conflicts: number;
    savedAt: string;
    updatedAt: string;
    updatedBy: string;
  } | null>(null);
  /** Editing: the last change could not be kept in this browser (storage full or blocked). */
  private readonly unpersisted = signal(false);
  /** Editing: there are changes not saved to the character yet. */
  protected readonly dirty = computed(() => {
    const base = this.editBase();
    return !!this.id() && !!base && !sameContent(this.draft(), base);
  });

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
        // by level required, then by the name shown
        optionGroups: optionGroupsFor(cls, entry.level, entry.subclassId, d.options).map((g) => ({
          ...g,
          options: defaultOrder(g.options, (o) => this.dataText.shortName(o.name)),
        })),
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
  /** The casters among the classes, and the spells picked for each of them. */
  private readonly casters = computed(() => {
    const d = this.data.value();
    return d ? spellCasters(this.draft(), d.rules.classes, d.rules.subclasses) : [];
  });
  private static readonly NONE: string[] = [];
  protected readonly pickedBy = computed(() =>
    spellsByClassOf(
      this.draft().choices,
      this.casters(),
      this.data.value()?.spellsById ?? new Map(),
    ),
  );
  /** Per class: its spells that are also picked for another class, with a note saying so. */
  protected readonly spellMarks = computed(() => {
    const classes = this.data.value()?.rules.classes;
    return spellMarks(
      this.pickedBy(),
      this.casters(),
      (id) => this.dataText.shortName(classes?.get(id)?.name ?? id),
      (also, cls) => this.i18n.t(also ? 'spellchoice.alsoAs' : 'spellchoice.alreadyAs', { cls }),
    );
  });
  /** Spells picked for two classes at once: one spell, but a pick from each class. */
  protected readonly sharedSpells = computed(() => sharedCount(this.pickedBy()));
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
  /**
   * The species' real lineages/legacies/ancestries to choose from, as picker items (the name is
   * their id). Excludes "variants" that are only the same species reprinted in another book
   * (Goblin's Volo's Guide, Plane Shift... printings): those aren't a player choice.
   */
  protected readonly variants = computed(() =>
    (this.species()?.variants ?? []).filter((v) => !v.reprint).map((v) => ({ ...v, id: v.name })),
  );
  /**
   * Species/variant traits whose text embeds its own choice (a lineage, a reprint's internal
   * tribe/creed...), with the options the player picks from (core/rules/trait-choices.ts). Only
   * the base species' traits and the currently chosen variant's, if any.
   */
  protected readonly speciesTraitChoices = computed(() => {
    const sp = this.species();
    if (!sp) return [];
    const out: { key: string; trait: string; options: TraitChoiceItem[] }[] = [];
    // the same species translated (same structure): its options, paired by position, are shown
    const tr = this.dataText.entry('species', sp);
    const scan = (traits: Feature[], variantName: string | null, shown: Feature[] | undefined) => {
      traits.forEach((t, i) => {
        const key = traitChoiceKey(sp.id, variantName, t.name);
        const split = traitChoiceFor(t, key);
        if (!split) return;
        const other = shown?.[i] && shown[i] !== t ? translatedOptions(shown[i].description) : [];
        const paired = other.length === split.options.length;
        out.push({
          key,
          trait: t.name,
          options: split.options.map((o, j) => ({
            value: o.name,
            label: paired ? other[j].name : o.name,
            text: paired ? other[j].text : o.text,
          })),
        });
      });
    };
    scan(sp.traits, null, tr.traits);
    const variant = this.variants().find((v) => v.id === this.draft().species?.variant);
    if (variant) {
      const at = sp.variants.findIndex((v) => v.name === variant.name);
      scan(variant.traits, variant.name, tr.variants?.[at]?.traits);
    }
    return out;
  });
  /** The species/variant traits as they apply to the draft, with what each asks to pick. */
  private readonly speciesView = computed<SpeciesTraitView[]>(() => {
    const sp = this.species();
    if (!sp) return [];
    const variant = sp.variants.find((v) => v.name === this.draft().species?.variant && !v.reprint);
    return speciesTraits(sp, variant, this.draft().choices, Math.max(1, this.totalLevel()));
  });
  /**
   * What the chosen species/variant traits (and the option of them picked) ask to pick inside them:
   * skills, a damage type, tools, weapons, a cantrip, some named options. One selector per pick,
   * stored in `choices.traitPicks`.
   */
  protected readonly speciesTraitPicks = computed(() => {
    const sheet = this.sheet();
    const sp = this.species();
    const spells = this.draft().choices.spells;
    return this.speciesView()
      .filter((v) => !v.hidden)
      .flatMap((v) =>
        v.picks.map((p) => ({
          pick: p,
          had: sheet ? hadValues(sheet, p, this.weaponItems(), spells) : new Set<string>(),
          labels: sp ? this.optionLabels(v, p) : {},
        })),
      );
  });
  /** The species' traits ask to choose INT, WIS or CHA as their spellcasting ability. */
  protected readonly speciesAbilityNeeded = computed(() =>
    speciesAbilityNeeded(this.speciesView()),
  );
  protected readonly speciesAbilityPicked = computed(() => {
    const sp = this.species();
    return sp ? speciesAbility(sp.id, this.draft().choices) : null;
  });
  protected readonly spellAbilities: Ability[] = ['INT', 'WIS', 'CHA'];
  /** Simple and martial weapons (not magic ones), for "a weapon of your choice". */
  private readonly weaponItems = computed(() =>
    [...this.items.values()]
      .filter((i) => !!i.weapon?.kind && !i.magic)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  protected readonly weaponNames = computed(() => this.weaponItems().map((i) => i.name));

  /** The options of an 'option' pick in the language shown (the translated species, by position). */
  private optionLabels(v: SpeciesTraitView, p: SpeciesPick): Record<string, PickOptionLabel> {
    const sp = this.species();
    if (!sp || !p.options || p.pick.kind !== 'option') return {};
    const tr = this.dataText.entry('species', sp);
    const list = v.variantName
      ? (tr.variants?.[sp.variants.findIndex((x) => x.name === v.variantName)]?.traits ?? [])
      : tr.traits;
    const own = v.variantName
      ? (sp.variants.find((x) => x.name === v.variantName)?.traits ?? [])
      : sp.traits;
    const at = own.indexOf(v.trait);
    const shown = list[at];
    if (!shown || shown === v.trait) return {};
    const out: Record<string, PickOptionLabel> = {};
    // the options are the traits that follow it (Duskling): their translated names and texts
    const siblings = own.slice(at + 1).map((t) => t.name);
    if (p.options.every((o) => siblings.includes(o.name))) {
      p.options.forEach((o) => {
        const t = list[own.findIndex((x) => x.name === o.name)];
        if (t) out[o.name] = { label: t.name, text: t.description };
      });
      return out;
    }
    const other = translatedOptions(shown.description);
    if (other.length === p.options.length)
      p.options.forEach((o, i) => (out[o.name] = { label: other[i].name, text: other[i].text }));
    return out;
  }
  protected readonly skillChoice = computed(() => skillPicks(this.classList()));
  /** Weapon Mastery slots (Barbarian, Fighter, Paladin, Ranger, Rogue), 0 = no such class. */
  protected readonly masterySlots = computed(() => this.sheet()?.combat.masterySlots ?? 0);
  /** Weapons with a mastery property the character is proficient with, to choose from. */
  protected readonly masteryOptions = computed(() => {
    const sheet = this.sheet();
    if (!sheet) return [];
    return [...this.items.values()]
      .filter((i) => i.weapon?.mastery && proficientWith(sheet.proficiencies.weapons, i))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
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
      .bought.map((b) => ({
        ...b,
        item: this.items.get(b.itemId)!,
        base: b.baseId ? this.items.get(b.baseId) : undefined,
        price: 0,
      }))
      .filter((b) => b.item)
      .map((b) => ({ ...b, price: shopPriceCp(b.item, b.bonus) ?? 0 })),
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
  /** The armors (not shields) the character carries, magic ones with their base: the ones to wear. */
  protected readonly carriedArmor = computed(() =>
    this.draft()
      .inventory.map((e) => ({ entry: e, item: e.itemId ? this.items.get(e.itemId) : undefined }))
      .filter((x) => armorSlot(x.item) === 'armor')
      .map((x) => {
        const gear = gearOf(x.entry, x.item, this.items)!;
        return { id: x.entry.id, item: x.item!, base: gear.base, equipped: x.entry.equipped };
      }),
  );
  protected readonly carriesShield = computed(() =>
    this.draft().inventory.some(
      (e) => e.itemId && armorSlot(this.items.get(e.itemId)) === 'shield',
    ),
  );
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
  // -- the steps and their state -------------------------------------------------------
  /** The steps this character goes through (spells only when a class casts). */
  protected readonly steps = computed(() => wizardSteps(this.casters().length > 0));
  /** The step shown: the one chosen, or class choices if spells no longer apply. */
  protected readonly current = computed<Step>(() =>
    this.steps().includes(this.step()) ? this.step() : 'choices',
  );
  protected readonly views = computed(() =>
    stepViews(this.steps(), this.notes(), (s) => this.filled(s)),
  );
  protected readonly view = computed(
    () => this.views().find((v) => v.id === this.current()) ?? this.views()[0],
  );
  protected readonly progress = computed<ProgressStep[]>(() =>
    this.views().map((v) => ({
      id: v.id,
      label: this.stepLabel(v.id),
      state: v.state,
      missing: v.missing.length,
    })),
  );
  protected readonly stateMap = computed(() =>
    Object.fromEntries(this.views().map((v) => [v.id, v.state])),
  );
  protected readonly stepLabels = computed(() =>
    Object.fromEntries(this.steps().map((s) => [s, this.stepLabel(s)])),
  );
  /** Everything still pending, by step (the last step lists it). */
  protected readonly pending = computed(() => pendingBySteps(this.steps(), this.notes()));
  protected readonly pendingGroups = computed<PendingGroup[]>(() =>
    this.pending().map((g) => ({
      step: g.step,
      label: this.stepLabel(g.step),
      items: g.items.map((i) => ({
        text: this.noteText(i.note),
        issue: i.note.kind === 'issue',
        target: i.target,
      })),
    })),
  );
  /** What the footer lists: this step's notes (the last step: everything still pending). */
  protected readonly footerNotes = computed<FooterNote[]>(() => {
    const step = this.current();
    const groups = this.pendingGroups();
    return (step === 'details' ? groups : groups.filter((g) => g.step === step)).flatMap(
      (g) => g.items,
    );
  });

  /** The live summary (what's decided so far) and the attacks the sheet would show. */
  protected readonly summary = computed(() => {
    const d = this.data.value();
    const sheet = this.sheet();
    if (!d || !sheet) return null;
    return summarize(this.draft(), sheet, {
      classes: d.rules.classes,
      subclasses: d.rules.subclasses,
      feats: d.rules.feats,
      spells: d.spellsById,
      background: this.background(),
    });
  });
  protected readonly attacks = computed(() => {
    const sheet = this.sheet();
    return sheet ? attacksFor(sheet, weaponEntriesOf(this.draft().inventory, this.items)) : [];
  });

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
        void this.store.get(id).then((r) => {
          if (!r) return;
          this.loadForEdit(normalizeCharacter(r.character)!);
          this.restoreStep(id);
        });
      } else {
        this.draft.set(loadDraft() ?? this.blank());
        this.restoreStep('new');
      }
    });
    // The step stays when the page is rebuilt: coming back from an entry of the compendium.
    effect(() => {
      const step = this.step();
      if (this.stepScope) writeStep(sessionMemory(), this.stepScope, step);
    });
    // Keep the draft of a new character in this browser until it's saved.
    effect(() => {
      if (!this.id()) saveDraft(this.draft());
    });
    // ...and the unsaved edits of an existing one, per character, until saved or discarded.
    effect(() => {
      const id = this.id();
      const base = this.editBase();
      const draft = this.draft();
      if (!id || !base || draft.id !== id) return;
      if (sameContent(draft, base)) {
        removeEditDraft(browserStorage(), id);
        this.unpersisted.set(false);
      } else {
        this.unpersisted.set(!writeEditDraft(browserStorage(), { character: draft, base }));
      }
    });
  }

  private stepScope: string | null = null;

  /** Back from the compendium (or a reload): the step that was open. */
  private restoreStep(scope: string): void {
    const step = readStep(sessionMemory(), scope, STEPS);
    if (step) this.step.set(step);
    this.stepScope = scope;
  }

  /** Editing: shows the saved character, or the unsaved changes left from a previous visit. */
  private loadForEdit(stored: Character): void {
    const storage = browserStorage();
    const saved = readEditDraft(storage, stored.id);
    const r = restoreEditDraft(saved, stored);
    if (!r) removeEditDraft(storage, stored.id);
    this.editBase.set(r?.base ?? stored);
    this.draft.set(r?.character ?? stored);
    this.restored.set(
      r && saved
        ? {
            outdated: r.outdated,
            conflicts: r.conflicts.length,
            savedAt: saved.savedAt,
            updatedAt: stored.updatedAt,
            updatedBy: stored.updatedBy,
          }
        : null,
    );
  }

  /** Leaving with unsaved edits is free: they stay as a draft. Ask only if they couldn't be kept. */
  canLeave(): boolean {
    if (!this.dirty() || !this.unpersisted()) return true;
    return confirm(this.i18n.t('create.leaveUnsaved' as never));
  }

  /** Same for closing or reloading the page, only when the edits live nowhere else. */
  protected onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.dirty() && this.unpersisted()) e.preventDefault();
  }

  /** A new character starts with one empty class row to fill in. */
  private blank(): Character {
    const c = newCharacter('', this.settings.settings().deviceName);
    return { ...c, classes: [{ id: '', level: 1, subclassId: null, hp: [null] }] };
  }

  // -- generic helpers -----------------------------------------------------------------
  protected patch(fn: (c: Character) => Character): void {
    this.draft.update((c) => fn(this.withSpellClasses(structuredClone(c))));
  }

  /** A character from before spells were recorded by class gets them worked out first. */
  private withSpellClasses(c: Character): Character {
    const d = this.data.value();
    if (d && c.choices.spells.length && !c.choices.spellsByClass) {
      const casters = spellCasters(c, d.rules.classes, d.rules.subclasses);
      Object.assign(c.choices, spellFields(spellsByClassOf(c.choices, casters, d.spellsById)));
    }
    return c;
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
  /** "FUE" for Athletics...: the ability of a skill, shown next to it. */
  protected skillAbility(s: string): string {
    const a = SKILL_ABILITY[s];
    return a ? this.i18n.t(`abbr.${a}` as never) : '';
  }
  protected readonly abilityLabel = (a: string) => this.i18n.t(`ability.${a}` as never);

  /** "Sniper's Bracelet (Longbow)" / "Longbow": a carried weapon an upgrade can go on. */
  protected hostLabel(h: Host): string {
    const name = this.dataText.name(h.gear.item.name);
    return h.gear.item === h.gear.base || !h.gear.base
      ? name
      : `${name} (${this.dataText.name(h.gear.base.name)})`;
  }

  protected hostName(h: NonNullable<BoughtItem['host']>): string {
    const name = (id?: string) => this.dataText.name(this.items.get(id ?? '')?.name ?? id);
    return h.baseId ? `${name(h.itemId)} · ${name(h.baseId)}` : name(h.itemId);
  }

  /** Does the weapon an upgrade of the basket was bought for still come with the inventory? */
  protected hostKept(b: BoughtItem): boolean {
    const h = b.host;
    return (
      !h ||
      this.draft().inventory.some(
        (e) =>
          e.itemId === h.itemId &&
          e.baseId === h.baseId &&
          !enhancementOf(this.items.get(h.itemId)),
      )
    );
  }

  /** Option text of a base: its name; the details go in a line under the selector. */
  protected baseName(b: Item): string {
    return this.dataText.shortName(b.name);
  }

  protected pickedSummary(bases: Item[], baseId: string): string {
    const b = bases.find((x) => x.id === baseId);
    return b ? baseSummary(b, this.i18n) : '';
  }

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
    for (const k of ['feat', 'cls', 'trait'])
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

  /** Something was chosen in the step (else it is "to do", or "optional" for the equipment). */
  private filled(s: Step): boolean {
    const c = this.draft();
    switch (s) {
      case 'choices':
      case 'spells':
      case 'hp':
        return this.classList().length > 0;
      case 'abilities':
        return !!c.abilityScores;
      case 'equipment':
        return !!c.choices.startingEquipment || c.inventory.length > 0;
      default:
        return true;
    }
  }

  protected stepLabel(s: Step): string {
    const key =
      s === 'details'
        ? this.id()
          ? 'wizard.step.detailsEdit'
          : 'wizard.step.detailsNew'
        : s === 'spells' || s === 'hp'
          ? `wizard.step.${s}`
          : `create.step.${s}`;
    return this.i18n.t(key as never);
  }

  /** What is decided in a step (the step's header). */
  protected stepLead(s: Step): string {
    return this.i18n.t(`wizard.lead.${s}` as never);
  }

  /** Why it goes there and how it works (folded under the header). */
  protected stepWhy(s: Step): string {
    return this.i18n.t(`wizard.why.${s}` as never, { primary: this.primaryLabel() || '—' });
  }

  /** "FUE / DES": the main abilities of the character's classes. */
  protected primaryLabel(): string {
    return [...new Set(this.classList().flatMap((k) => k.primaryAbility))]
      .map((a) => this.i18n.t(`abbr.${a}` as never))
      .join(' / ');
  }

  protected stepIndex(): number {
    return this.steps().indexOf(this.current());
  }

  protected nextLabel(): string | null {
    const next = this.steps()[this.stepIndex() + 1];
    return next ? this.stepLabel(next) : null;
  }

  protected go(delta: number): void {
    const steps = this.steps();
    const i = Math.min(Math.max(this.stepIndex() + delta, 0), steps.length - 1);
    this.setStep(steps[i]);
  }

  private readonly injector = inject(Injector);
  private readonly top = viewChild<ElementRef<HTMLElement>>('top');
  private readonly stepSection = viewChild<ElementRef<HTMLElement>>('stepSection');

  protected setStep(s: string, anchor?: string): void {
    const step = (this.steps() as string[]).includes(s) ? (s as Step) : this.current();
    if (step === 'equipment') this.prefillEquipment();
    const changed = step !== this.current();
    this.step.set(step);
    if (!changed && !anchor) return;
    afterNextRender(
      () => {
        const target = anchor
          ? this.host.nativeElement.querySelector<HTMLElement>(`[data-anchor="${anchor}"]`)
          : null;
        if (target) {
          // a note tapped: to the part of the step that solves it, highlighted for a moment
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          target.classList.add('flash');
          setTimeout(() => target.classList.remove('flash'), 1600);
          target
            .querySelector<HTMLElement>('input, select, textarea')
            ?.focus({ preventScroll: true });
          return;
        }
        // go to the top of the new step (the button pressed was usually at the bottom)
        this.top()?.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
        this.stepSection()?.nativeElement.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  /**
   * The parts of the class choices step (it can be long: skills, masteries, feats of several
   * levels, options...), each with how many are chosen, for the jump list under its header.
   */
  protected readonly choiceSections = computed(() => {
    const c = this.draft();
    const out: { jump: string; label: string; count: string; done: boolean }[] = [];
    if (!this.classList().length) return out;
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k as never, p);
    const part = (jump: string, label: string, n: number, of: number | null) =>
      out.push({
        jump,
        label,
        count: of === null ? `${n}` : `${n}/${of}`,
        done: of === null || n >= of,
      });
    const bg = new Set(this.background()?.skills ?? []);
    part(
      'skills',
      t('sheet.skills'),
      c.choices.skills.filter((s) => !bg.has(s)).length,
      this.skillChoice().count,
    );
    if (this.masterySlots())
      part(
        'masteries',
        t('wizard.choices.masteries'),
        (c.choices.weaponMasteries ?? []).length,
        this.masterySlots(),
      );
    if (this.expertiseTotal())
      part(
        'expertise',
        t('wizard.choices.expertise'),
        c.choices.expertise.length,
        this.expertiseTotal(),
      );
    for (const tc of this.tools())
      if (tc.slot !== 'background')
        part(
          `tool:${tc.slot}`,
          this.toolGroupLabel(tc.groups),
          this.toolsIn(tc.slot).length,
          tc.count,
        );
    for (const r of this.rows()) {
      if (!r.cls) continue;
      const cls = this.dataText.shortName(r.cls.name);
      for (const s of r.slots)
        part(
          `slot:${s.slot}`,
          t('wizard.choices.slot', {
            cls,
            level: s.level,
            kind: t(`wizard.choices.kind.${s.kind}`),
          }),
          this.slotFeat(s.slot) ? 1 : 0,
          1,
        );
      for (const g of r.optionGroups)
        part(
          `opt:${r.entry.id}:${g.group}`,
          this.groupLabel(g.group),
          this.chosenCount(c.choices.options, g.options),
          g.count,
        );
    }
    return out;
  });

  /** To a part of the step (the jump list), lit for a moment. */
  protected jump(key: string): void {
    const el = this.host.nativeElement.querySelector<HTMLElement>(`[data-jump="${key}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  }

  /** A note of the footer or of the review tapped: its step and the part that solves it. */
  protected goTo(target: unknown): void {
    const t = target as NoteTarget | undefined;
    if (t) this.setStep(t.step, t.anchor);
  }

  // -- hit points (their own step) -------------------------------------------------------
  /** Hit die and name of the character's classes, for the hit points step. */
  protected readonly hpInfo = computed(() =>
    Object.fromEntries(this.classList().map((k) => [k.id, { die: k.hitDie, name: k.name }])),
  );

  /** Hit points changed in the step: one level, every level at once, or a total spread. */
  protected setHpClasses(classes: ClassEntry[]): void {
    this.patch((c) => ({ ...c, classes }));
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
      resizeHp(k, level);
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
    c.choices.featSlots = c.choices.featSlots.filter((s) => !mine(s.slot));
    c.choices.abilityIncreases = c.choices.abilityIncreases.filter((i) => !mine(i.slot));
    c.choices.toolChoices = c.choices.toolChoices.filter((t) => !t.slot.endsWith(`:${classId}`));
    c.choices.options = c.choices.options.filter(
      (o) => !options.has(o) && !(classId === 'artificer' && isPickId(o)),
    );
    // only the picks made for that class: a spell also picked for another class stays
    Object.assign(c.choices, spellFields(dropClassSpells(c.choices.spellsByClass ?? {}, classId)));
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
  /** The form to create a custom background is open. */
  protected readonly creatingBackground = signal(false);

  /** A custom background was just saved: reload the list and choose it for the character. */
  protected useCreatedBackground(id: string): void {
    this.creatingBackground.set(false);
    this.data.reload();
    this.setBackground(id);
  }

  protected setBackground(id: string): void {
    this.patch((c) => {
      c.background = id ? { id, abilityIncreases: {} } : null;
      c.choices.toolChoices = c.choices.toolChoices.filter((t) => t.slot !== 'background');
      // what the old background's feat asked is not valid for the new one
      this.dropFeatChoice(c, 'background');
      return c;
    });
  }

  // -- the choices a feat asks (spellcasting ability, spell list and spells, skills, tools...) --
  /** The background's origin feat, with where it came from. */
  protected readonly backgroundFeat = computed<FeatSource | null>(() => {
    const bg = this.background();
    const feat = bg?.featId ? this.data.value()?.rules.feats.get(bg.featId) : undefined;
    return feat ? { key: 'background', feat, fixedList: listOfFeatName(bg?.feat) } : null;
  });

  /** The feat a species gives (Human's Versatile: an origin feat; Custom Lineage: any feat). */
  protected readonly speciesFeatKind = computed(() => speciesFeatKind(this.species()));
  protected readonly speciesFeats = computed(() =>
    featsForSpecies(this.speciesFeatKind(), this.data.value()?.feats ?? []),
  );

  /** A feat that sits in a slot ("species", "fighter:4"), with where it came from. */
  protected slotSource(slot: string): FeatSource | null {
    const feat = this.slotFeatEntry(slot);
    return feat ? { key: slot, feat } : null;
  }

  protected featChoice(key: string): FeatChoice | undefined {
    return this.draft().choices.featChoices?.[key];
  }

  protected setFeatChoice(key: string, choice: FeatChoice): void {
    this.patch((c) => {
      c.choices.featChoices = { ...(c.choices.featChoices ?? {}), [key]: choice };
      return c;
    });
  }

  private dropFeatChoice(c: Character, key: string): void {
    if (!c.choices.featChoices?.[key]) return;
    const { [key]: _gone, ...rest } = c.choices.featChoices;
    c.choices.featChoices = rest;
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
      const changed = c.species?.id !== id;
      c.species = id ? { id, variant: null } : null;
      c.size = null;
      // the feat of the old species (Human's Versatile) doesn't carry over
      if (changed) {
        c.choices.featSlots = c.choices.featSlots.filter((s) => s.slot !== SPECIES_SLOT);
        this.dropFeatChoice(c, SPECIES_SLOT);
      }
      return c;
    });
  }

  protected setVariant(name: string): void {
    this.patch((c) => {
      if (c.species) c.species.variant = name || null;
      return c;
    });
  }

  protected setTraitChoice(key: string, value: string): void {
    this.patch((c) => {
      c.choices.traitChoices = { ...(c.choices.traitChoices ?? {}), [key]: value };
      // what was picked inside the previous option no longer applies
      const picks = { ...(c.choices.traitPicks ?? {}) };
      for (const k of Object.keys(picks)) if (k.startsWith(`${key}#`)) delete picks[k];
      c.choices.traitPicks = picks;
      return c;
    });
  }

  protected setTraitPick(key: string, values: string[]): void {
    this.patch((c) => {
      c.choices.traitPicks = { ...(c.choices.traitPicks ?? {}), [key]: values };
      return c;
    });
  }

  /** The spellcasting ability the species' traits ask to choose (INT, WIS or CHA). */
  protected setSpeciesAbility(ability: string): void {
    const sp = this.species();
    if (sp) this.setTraitPick(speciesAbilityKey(sp.id), ability ? [ability] : []);
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

  /**
   * A typed score: in point buy it stays within 8–15 and never spends more than the budget (the
   * highest value that still fits is kept); the box shows the value finally kept.
   */
  protected typeScore(a: Ability, e: Event): void {
    const input = e.target as HTMLInputElement;
    const s = this.draft().abilityScores;
    let n = parseInt(input.value, 10) || 0;
    if (s?.method === 'point-buy') {
      n = Math.min(Math.max(n, 8), 15);
      while (n > 8 && pointBuyCost({ ...s.base, [a]: n }) > POINT_BUY_BUDGET) n--;
    } else if (s?.method === 'manual') n = Math.min(Math.max(n, 3), 20);
    input.value = String(n);
    this.setScore(a, String(n));
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

  /** What the background (and feats) add to a score, on top of the base. */
  protected abilityBonus(a: Ability): number {
    const sh = this.sheet();
    return sh ? sh.abilities[a].score - sh.abilities[a].base : 0;
  }

  /** "principal de Guerrero": the classes whose main ability this is. */
  protected primaryOf(a: Ability): string[] {
    return this.classList()
      .filter((k) => k.primaryAbility.includes(a))
      .map((k) => this.dataText.shortName(k.name));
  }

  /** Multiclass requirements on this ability ("Mago pide 13"), only with two classes or more. */
  protected multiclassNeeds(a: Ability): { cls: string; min: number; met: boolean }[] {
    const classes = this.classList();
    const sheet = this.sheet();
    if (classes.length < 2 || !sheet) return [];
    return classes.flatMap((k) =>
      k.multiclass.prerequisites
        .filter((g) => g.anyOf.includes(a))
        .map((g) => ({
          cls: this.dataText.shortName(k.name),
          min: g.min,
          met: g.anyOf.some((x) => sheet.abilities[x].score >= g.min),
        })),
    );
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

  protected setMastery(id: string, on: boolean): void {
    this.patch((c) => {
      c.choices.weaponMasteries = this.toggle(c.choices.weaponMasteries ?? [], id, on);
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

  private readonly feats = computed(() => {
    const all = this.data.value()?.feats ?? [];
    const species = this.species() ?? null;
    return {
      asi: featsForSlot('asi', all, species),
      'fighting-style': featsForSlot('fighting-style', all, species),
      'epic-boon': featsForSlot('epic-boon', all, species),
    } satisfies Record<SlotKind, Feat[]>;
  });

  protected featsFor(kind: SlotKind): Feat[] {
    return this.feats()[kind];
  }

  /**
   * On the cards of a feat slot, why a feat can't normally be taken ("⚠ needs STR 13"): seen
   * before choosing it, not only after.
   */
  protected readonly featMarks = computed(() => {
    const out: Partial<Record<SlotKind, Record<string, string>>> = {};
    if (!this.sheet()) return out;
    const kinds = new Set(this.rows().flatMap((r) => r.slots.map((s) => s.kind)));
    for (const kind of kinds) {
      const marks: Record<string, string> = {};
      for (const f of this.featsFor(kind)) {
        const p = this.featProblems(f)[0];
        if (p) marks[f.id] = `⚠ ${this.noteText(p)}`;
      }
      out[kind] = marks;
    }
    return out;
  });

  /** Why this character can't normally take a feat (empty = it can). */
  protected featProblems(feat: Feat | undefined): Note[] {
    const sheet = this.sheet();
    if (!feat || !sheet) return [];
    return featIssues(feat, sheet, this.species() ?? null).map((n) => ({
      ...n,
      params: { ...n.params, feat: feat.name },
    }));
  }

  protected readonly planGroup = PLAN_GROUP;
  protected readonly isFull = optionGroupFull;
  /** Every compendium item, for the plan pickers. */
  protected readonly allItems = computed(() => [
    ...(this.data.value()?.rules.items.values() ?? []),
  ]);
  protected readonly optionView = visibleOptions;
  protected readonly optionLocks = optionLocks;
  protected readonly optionNote = optionUncheckedNote;

  protected setSlotFeat(slot: string, featId: string): void {
    this.patch((c) => {
      c.choices.featSlots = [
        ...c.choices.featSlots.filter((s) => s.slot !== slot),
        { slot, featId: featId || null },
      ];
      c.choices.abilityIncreases = c.choices.abilityIncreases.filter((i) => i.slot !== slot);
      this.dropFeatChoice(c, slot);
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

  /** Picks or drops a spell for one class; the other classes keep their own picks. */
  protected setSpell(classId: string, id: string, on: boolean): void {
    this.patch((c) => {
      const d = this.data.value();
      const casters = d ? spellCasters(c, d.rules.classes, d.rules.subclasses) : [];
      const by = spellsByClassOf(c.choices, casters, d?.spellsById ?? new Map());
      Object.assign(c.choices, spellFields(toggleSpellFor(by, classId, id, on)));
      return c;
    });
  }

  /** Spell save DC, attack and ability of a class, as the sheet computes them. */
  protected spellStats(classId: string) {
    return this.sheet()?.spellcasting.classes.find((x) => x.classId === classId) ?? null;
  }

  protected pickedOf(classId: string): string[] {
    return this.pickedBy()[classId] ?? CharacterCreate.NONE;
  }

  protected chosenCount(ids: string[], of: { id: string }[]): number {
    if (of.length && (of[0] as { group?: string }).group === PLAN_GROUP)
      return plansTaken(ids, of as ClassOption[]);
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

  /** A magic weapon or armor in the shop whose base (and +N) is being asked before buying it. */
  protected readonly buying = signal<{
    item: Item;
    bases: Item[];
    bonuses: BonusOption[];
    baseId: string;
    bonus: number;
    /** An upgrade of a weapon already carried: the weapons it can go on (maybe none). */
    hosts?: Host[];
    hostId?: string;
  } | null>(null);

  /** The shop's pick: bought at once, or after choosing the base when several fit. */
  protected pick(itemId: string): void {
    const item = this.items.get(itemId);
    if (item && enhancementOf(item)) {
      // an upgrade needs a weapon already in the inventory (the packages' or bought before)
      const hosts = enhancementHosts(item, this.draft().inventory, this.items).filter(
        (h, i, all) =>
          all.findIndex(
            (o) => o.entry.itemId === h.entry.itemId && o.entry.baseId === h.entry.baseId,
          ) === i,
      );
      this.buying.set({
        item,
        bases: [],
        bonuses: [],
        baseId: '',
        bonus: 0,
        hosts,
        hostId: hosts.length === 1 ? hosts[0].entry.id : '',
      });
      return;
    }
    const choices = item ? gearChoices(item, this.items.values()) : null;
    if (!item || !choices) return this.buy(itemId);
    this.buying.set({
      item,
      ...choices,
      baseId: choices.bases.length === 1 ? choices.bases[0].id : '',
      bonus: choices.bonuses[0]?.bonus ?? 0,
    });
  }

  protected buyingPatch(patch: { baseId?: string; bonus?: number; hostId?: string }): void {
    const b = this.buying();
    if (b) this.buying.set({ ...b, ...patch });
  }

  protected buyingPrice(): number {
    const b = this.buying();
    return b ? (shopPriceCp(b.item, b.bonuses.length > 1 ? b.bonus : undefined) ?? 0) : 0;
  }

  protected confirmBuying(): void {
    const b = this.buying();
    if (!b || (b.bases.length > 1 && !b.baseId)) return;
    const host = b.hosts?.find((h) => h.entry.id === b.hostId);
    if (b.hosts && !host) return;
    const affordable = this.buyingPrice() <= this.goldLeft();
    this.buy(b.item.id, {
      ...(host
        ? {
            host: {
              itemId: host.entry.itemId!,
              ...(host.entry.baseId ? { baseId: host.entry.baseId } : {}),
            },
          }
        : {}),
      ...(b.baseId ? { baseId: b.baseId } : {}),
      ...(b.bonuses.length > 1 ? { bonus: b.bonus } : {}),
    });
    if (affordable) this.buying.set(null);
  }

  /** Buys one more (if the gold left is enough). */
  protected buy(itemId: string, gear: Pick<BoughtItem, 'baseId' | 'bonus' | 'host'> = {}): void {
    const item = this.items.get(itemId);
    const price = item ? shopPriceCp(item, gear.bonus) : null;
    if (price === null || price > this.goldLeft()) return;
    const bought = [...this.startChoice().bought];
    const i = bought.findIndex((x) => sameBought(x, itemId, gear));
    if (i >= 0) bought[i] = { ...bought[i], qty: bought[i].qty + 1 };
    else bought.push({ itemId, qty: 1, ...gear });
    this.applyStart({ ...this.startChoice(), bought });
  }

  /** Gives one back. */
  protected unbuy(line: BoughtItem): void {
    const bought = this.startChoice()
      .bought.map((b) => (sameBought(b, line.itemId, line) ? { ...b, qty: b.qty - 1 } : b))
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

  protected withFolder(folder: string) {
    return (c: Character) => ({ ...c, folder: folder.trim() || null });
  }

  /** The folders of the character list (created there or used by a character), to suggest. */
  private readonly folderPrefs = new FolderPrefs('dnd-helper.characterFolders');
  protected readonly folders = computed(() => [
    ...new Set([
      ...this.folderPrefs.names(),
      ...this.store
        .all()
        .map((r) => r.character.folder)
        .filter((f): f is string => !!f),
    ]),
  ]);

  protected withPortrait(portrait: string | null) {
    return (c: Character) => ({ ...c, portrait });
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
    if (ch.folder) this.folderPrefs.ensure(ch.folder);
    await this.sync.save(ch);
    if (this.id()) {
      this.editBase.set(this.draft());
      removeEditDraft(browserStorage(), ch.id);
    } else clearDraft();
    clearStep(sessionMemory(), this.stepScope ?? 'new');
    this.stepScope = null;
    await this.router.navigate(['/characters', ch.id]);
  }

  /** Throws away the new character's draft and starts from the first step. */
  protected restart(): void {
    if (!confirm(this.i18n.t('create.confirmRestart' as never))) return;
    clearDraft();
    this.draft.set(this.blank());
    this.step.set('class');
  }

  /** Editing: forgets the changes not saved yet and goes back to the saved character. */
  protected async discard(): Promise<void> {
    const id = this.id();
    if (!id || !confirm(this.i18n.t('create.confirmDiscard' as never))) return;
    removeEditDraft(browserStorage(), id);
    this.restored.set(null);
    const r = await this.store.get(id);
    if (r) {
      const stored = normalizeCharacter(r.character)!;
      this.editBase.set(stored);
      this.draft.set(stored);
    }
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
