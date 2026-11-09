import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { speciesFits } from '../../core/creation/creation-rules';
import { HomebrewStore } from '../../core/homebrew/homebrew-store.service';
import { plainPreview } from '../../shared/picker/entry-labels.service';
import { DataNamePipe, DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { PhrasePipe, TermDomain, TermPipe, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import {
  AbilityGroup,
  Background,
  ClassOption,
  DndClass,
  ENTRY_TYPES,
  Entry,
  EntryType,
  Feat,
  Feature,
  Item,
  Monster,
  Rule,
  Species,
  SpeciesVariant,
  Spell,
  Spellcasting,
  Subclass,
} from '../../core/models/compendium';
import { spellBinding } from '../../core/spell-items/spell-items';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { armorDex, prerequisitesText, slotsText, weaponProperty } from './entry-format';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';
import { BackLink } from '../../shared/back-link';
import { CustomBackgroundPanel } from '../homebrew/custom-background-panel';
import { AddSpellItem } from './add-spell-item';
import { LoadError } from './load-error';
import { MonsterStatBlock } from './monster-stat-block';

/** Detail page for any entry, with the fields of its type and links to related entries. */
import { EntryPortrait } from '../../shared/picker/entry-portrait';

/** `?printing=` value for the species' own (current) printing, as opposed to a reprint variant. */
const CURRENT_PRINTING = 'current';

/** One printing of a species shown on its own: the current one, or one of its book reprints. */
interface Printing {
  key: string;
  name: string;
  source: string | null;
  description: string;
  traits: Feature[];
}

@Component({
  selector: 'app-entry-detail',
  imports: [
    RouterLink,
    BackLink,
    NgTemplateOutlet,
    TranslatePipe,
    TermPipe,
    PhrasePipe,
    DataNamePipe,
    DataTextPipe,
    MarkdownPipe,
    LoadError,
    ClassThemeDirective,
    EntryPortrait,
    MonsterStatBlock,
    CustomBackgroundPanel,
    AddSpellItem,
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
  private readonly i18n = inject(I18nService);
  private readonly homebrew = inject(HomebrewStore);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  /** `?printing=` from the URL: which reprint (or the current one) a species page is showing. */
  protected readonly printingKey = computed(() => this.params().get('printing') ?? '');
  protected readonly currentPrintingKey = CURRENT_PRINTING;

  protected readonly entryType = computed<EntryType>(() =>
    ENTRY_TYPES.includes(this.type() as EntryType) ? (this.type() as EntryType) : 'class',
  );

  protected readonly entry = resource({
    // the revision: the user's own backgrounds changed (edited, approved...)
    params: () => ({
      type: this.entryType(),
      id: this.id(),
      revision: this.homebrew.revision(),
    }),
    loader: ({ params }) =>
      this.compendium.get(params.type, params.id) as Promise<Entry | undefined>,
  });

  /** Subclasses of the class being shown. */
  protected readonly subclasses = resource({
    params: () => (this.entryType() === 'class' ? this.id() : undefined),
    loader: async ({ params }) =>
      (await this.compendium.all('subclass')).filter((s) => s.classId === params),
  });
  /** Racial feats this species can take (its own, and those open to its size), by name. */
  protected readonly racialFeats = resource({
    params: () => (this.entryType() === 'species' ? this.id() : undefined),
    loader: async ({ params }) => {
      const [feats, species] = await Promise.all([
        this.compendium.all('feat'),
        this.compendium.get('species', params),
      ]);
      if (!species) return [];
      return feats
        .filter((f) => f.category === 'racial' && speciesFits(f, species))
        .sort((a, b) => this.data.shortName(a.name).localeCompare(this.data.shortName(b.name)));
    },
  });
  protected readonly preview = plainPreview;

  /** In alphabetical order of the names shown. */
  protected readonly sortedSubclasses = computed(() =>
    [...(this.subclasses.value() ?? [])].sort((a, b) =>
      this.data.shortName(a.name).localeCompare(this.data.shortName(b.name)),
    ),
  );

  /** Names of the entries linked from here: class and subclass by id, spell id by name. */
  private readonly lookups = resource({
    loader: async () => {
      const [classes, subclasses, spells] = await Promise.all([
        this.compendium.all('class'),
        this.compendium.all('subclass'),
        this.compendium.all('spell'),
      ]);
      return {
        classes: new Map(classes.map((c) => [c.id, c.name])),
        subclasses: new Map(subclasses.map((s) => [s.id, s.name])),
        spells: new Map(spells.map((s) => [s.name.toLowerCase(), s.id])),
      };
    },
  });

  protected readonly levels = Array.from({ length: 20 }, (_, i) => i + 1);

  protected asClass(e: Entry): DndClass {
    return e as DndClass;
  }
  protected asSubclass(e: Entry): Subclass {
    return e as Subclass;
  }
  protected asSpell(e: Entry): Spell {
    return e as Spell;
  }
  protected asFeat(e: Entry): Feat {
    return e as Feat;
  }
  protected readonly spellBinding = spellBinding;
  protected asItem(e: Entry): Item {
    return e as Item;
  }
  protected asSpecies(e: Entry): Species {
    return e as Species;
  }

  /**
   * A species' "variants" that are a real sub-race/lineage/legacy choice (Tiefling's Legacies,
   * Dragonborn's ancestries, Elf's lineages...), excluding reprints of the whole species.
   */
  protected realVariants(sp: Species): SpeciesVariant[] {
    return sp.variants.filter((v) => !v.reprint);
  }

  /**
   * A species whose "variants" are only the same creature printed again in another book (Goblin's
   * Volo's Guide, Plane Shift... printings) is shown as a group of printings to pick from — never
   * as one page mixing all of their traits. `null` for a species with no such reprints.
   */
  protected readonly printings = computed<Printing[] | null>(() => {
    const e = this.entry.value();
    if (!e || e.type !== 'species') return null;
    const sp = e as Species;
    const reprints = sp.variants.filter((v) => v.reprint);
    if (!reprints.length) return null;
    return [
      {
        key: CURRENT_PRINTING,
        name: sp.name,
        source: sp.source,
        description: sp.description,
        traits: sp.traits,
      },
      ...reprints.map((v) => ({
        key: v.name,
        name: v.name,
        source: null,
        description: v.description,
        traits: v.traits,
      })),
    ];
  });
  /** Show the printing cards: a species with reprints, and none picked yet. */
  protected readonly choosingPrinting = computed(() => !!this.printings() && !this.printingKey());
  protected readonly currentPrinting = computed(
    () => this.printings()?.find((p) => p.key === this.printingKey()) ?? null,
  );
  /** What to show as the species' own text: the picked printing, or its current one by default. */
  protected shownPrinting(sp: Species): { description: string; traits: Feature[] } {
    return this.currentPrinting() ?? { description: sp.description, traits: sp.traits };
  }
  protected asBackground(e: Entry): Background {
    return e as Background;
  }
  protected asOption(e: Entry): ClassOption {
    return e as ClassOption;
  }
  protected asRule(e: Entry): Rule {
    return e as Rule;
  }
  protected asMonster(e: Entry): Monster {
    return e as Monster;
  }

  /** Features grouped by level, in level order. */
  protected byLevel(features: Feature[]): { level: number; features: Feature[] }[] {
    const groups = new Map<number, Feature[]>();
    for (const f of features) groups.set(f.level, [...(groups.get(f.level) ?? []), f]);
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([level, fs]) => ({ level, features: fs }));
  }

  /** "Mago (Wizard)" for a class id; the id itself while loading or if unknown. */
  protected className(id: string): string {
    return this.data.name(this.lookups.value()?.classes.get(id) ?? id);
  }

  protected subclassName(id: string): string {
    return this.data.name(this.lookups.value()?.subclasses.get(id) ?? id);
  }

  /** The spell's id for a name in the data ("Faerie Fire" → "faerie-fire"), if it's in the compendium. */
  protected spellId(name: string): string | undefined {
    return this.lookups.value()?.spells.get(name.toLowerCase());
  }

  protected names(list: string[]): string {
    return list.map((n) => this.data.name(n)).join(', ');
  }

  /** "FUE, DES" in the current language. */
  protected abilities(list: readonly (string | null)[]): string {
    return list
      .filter(Boolean)
      .map((a) => this.i18n.t(`abbr.${a}` as never))
      .join(', ');
  }

  protected skills(list: string[]): string {
    return list.map((s) => this.i18n.t(`skill.${s}` as never)).join(', ');
  }

  /** A glossary term when there is one ("Thieves' Tools"), otherwise the data text. */
  protected termOrText(domain: TermDomain, value: string | null | undefined): string {
    if (!value) return '';
    const translated = term(this.i18n.language(), domain, value);
    return translated !== value ? translated : this.data.text(value);
  }

  protected termList(domain: TermDomain, list: string[]): string {
    return list.map((v) => this.termOrText(domain, v)).join(', ');
  }

  protected feet(n: number): string {
    return this.i18n.t('compendium.feet', { n });
  }

  protected speeds(s: Species): { kind: string; feet: number }[] {
    return Object.entries(s.speed)
      .filter(([, v]) => typeof v === 'number')
      .map(([kind, feet]) => ({ kind, feet: feet as number }));
  }

  protected cost(c: NonNullable<Item['cost']>): string {
    return this.i18n.t('compendium.cost', {
      amount: c.amount.toLocaleString(this.i18n.language()),
      unit: this.i18n.t(`compendium.coin.${c.unit}` as never),
    });
  }

  protected weight(w: number): string {
    return this.i18n.t('compendium.pounds', { n: w.toLocaleString(this.i18n.language()) });
  }

  protected property(p: string): string {
    return weaponProperty(this.i18n.language(), p);
  }

  protected armorDex = armorDex;
  protected slots = slotsText;

  protected multiclassPrerequisites(groups: AbilityGroup[]): string {
    return prerequisitesText(
      groups,
      (a) => this.i18n.t(`abbr.${a}` as never),
      this.i18n.t('compendium.or'),
      this.i18n.t('compendium.and'),
    );
  }

  /** Level rows of a spellcasting table worth showing: from the first one that casts anything. */
  protected castingLevels(sc: Spellcasting): number[] {
    const casts = (l: number) =>
      (sc.cantripsByLevel?.[l - 1] ?? 0) > 0 ||
      (sc.preparedByLevel?.[l - 1] ?? 0) > 0 ||
      slotsText(sc, l) !== '—';
    const first = this.levels.find(casts);
    return first ? this.levels.filter((l) => l >= first) : [];
  }

  protected components(s: Spell): string {
    const parts = [s.components.v && 'V', s.components.s && 'S', s.components.m && 'M']
      .filter(Boolean)
      .join(', ');
    const material = this.data.text(s.components.material);
    return material ? `${parts} (${material})` : parts;
  }
}
