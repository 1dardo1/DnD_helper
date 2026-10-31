import { Injectable, inject, signal } from '@angular/core';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataTextService } from '../../core/i18n/data-text.service';
import { TermDomain, phrase, term } from '../../core/i18n/glossary';
import { I18nService, TranslationKey } from '../../core/i18n/i18n.service';
import {
  Background,
  ClassOption,
  DndClass,
  Entry,
  EntryType,
  Feat,
  Item,
  Rule,
  Spell,
  Species,
  Subclass,
} from '../../core/models/compendium';
import {
  ENTRY_FACETS,
  FacetKey,
  PRIMARY_FACETS,
  armorTraining,
  facetOptionsFor,
  facetValues,
  backgroundFeat,
  backgroundTool,
  isFeatKind,
  weaponTraining,
} from './entry-facets';
import { FacetView } from './filter-bar';
import { modeKey } from './picker-filters';

/** What a summary card shows: a one-line kicker, a few labelled facts and small marks. */
export interface CardSummary {
  kicker: string;
  facts: { label: string; value: string }[];
  /** Short marks next to the name (C = concentration, R = ritual...), with their meaning. */
  marks: { text: string; title: string }[];
}

/** Glossary domain of the "category" facet for each type that has one. */
const CATEGORY_DOMAIN: Partial<Record<EntryType, TermDomain>> = {
  feat: 'featCategory',
  item: 'itemCategory',
  rule: 'ruleCategory',
};

/** Facets whose label already exists as a compendium filter label. */
const FILTER_LABELS = new Set<FacetKey>([
  'level',
  'school',
  'class',
  'category',
  'rarity',
  'magic',
  'group',
  'edition',
]);

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Texts of the summary cards and filters, in the current language: facet and option labels, and
 * the short summary of an entry of any type. Reads signals, so callers in a computed() follow
 * language changes.
 */
@Injectable({ providedIn: 'root' })
export class EntryLabels {
  private readonly compendium = inject(CompendiumService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject(DataTextService);

  private readonly classNames = signal<Map<string, string>>(new Map());
  private loadingClasses = false;

  private t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key as TranslationKey, params);
  }

  private term(domain: TermDomain, value: string | null | undefined): string {
    return term(this.i18n.language(), domain, value);
  }

  /** Class name in the current language (short form), loading the class list on first use. */
  className(id: string): string {
    if (!this.loadingClasses) {
      this.loadingClasses = true;
      this.compendium.all('class').then(
        (cs) => this.classNames.set(new Map(cs.map((c) => [c.id, c.name]))),
        () => (this.loadingClasses = false),
      );
    }
    return this.data.shortName(this.classNames().get(id) ?? id);
  }

  feet(n: number): string {
    return this.t('compendium.feet', { n });
  }

  private abbr(list: readonly string[]): string {
    return list.map((a) => this.t(`abbr.${a}`)).join(', ');
  }

  // -- filters -------------------------------------------------------------------------------
  facetLabel(key: FacetKey): string {
    return this.t(FILTER_LABELS.has(key) ? `filter.${key}` : `picker.facet.${key}`);
  }

  /** Label of one value of a facet ("3" → "Nivel 3", "yes" → "Sí", "STR" → "Fuerza"...). */
  optionLabel(type: EntryType, key: FacetKey, value: string): string {
    let text: string;
    switch (key) {
      case 'level':
        text = value === '0' ? this.t('spell.cantrip') : this.t('filter.levelN', { level: value });
        break;
      case 'school':
        text = this.term('school', value);
        break;
      case 'class':
        text = this.className(value);
        break;
      case 'category': {
        const domain = CATEGORY_DOMAIN[type];
        text = domain ? this.term(domain, value) : value;
        break;
      }
      case 'rarity':
        text = this.term('rarity', value);
        break;
      case 'magic':
        text = this.t(value === 'magic' ? 'filter.magicOnly' : 'filter.mundaneOnly');
        break;
      case 'group':
        text = this.term('optionGroup', value);
        break;
      case 'edition':
        text = this.t('common.edition', { edition: value });
        break;
      case 'castingTime':
      case 'price':
      case 'duration':
      case 'components':
      case 'range':
      case 'caster':
      case 'casting':
      case 'prerequisite':
        text = this.t(`picker.${key}.${value}`);
        break;
      case 'concentration':
      case 'ritual':
      case 'repeatable':
      case 'attunement':
      case 'stealth':
        text = this.t(value === 'yes' ? 'compendium.yes' : 'compendium.no');
        break;
      case 'increase':
        text = ['yes', 'no'].includes(value)
          ? this.t(value === 'yes' ? 'picker.increase.yes' : 'compendium.no')
          : this.t(`ability.${value}`);
        break;
      case 'primary':
      case 'ability':
      case 'saves':
        text = this.t(`ability.${value}`);
        break;
      case 'resolve':
        text =
          value === 'attack'
            ? this.t('picker.resolve.attack')
            : this.t('picker.resolve.save', { ability: this.t(`ability.${value}`) });
        break;
      case 'damage':
        text =
          value === 'healing' || value === 'other' || value === 'any'
            ? this.t(`picker.damage.${value}`)
            : this.term('damage', value);
        break;
      case 'area':
        text = this.t(`picker.area.${value}`);
        break;
      case 'hitDie':
        text = `d${value}`;
        break;
      case 'armor':
        text =
          value === 'none'
            ? this.t('picker.noArmor')
            : this.term('armor', value === 'shield' ? 'shields' : `${value} armor`);
        break;
      case 'armorKind':
        text = this.term('armor', value);
        break;
      case 'weaponKind':
        text = this.term('weapon', `${value} weapons`);
        break;
      case 'weaponRange':
        text = this.t(value === 'ranged' ? 'compendium.ranged' : 'compendium.melee');
        break;
      case 'property':
        text = this.term('property', value);
        break;
      case 'mastery':
        text = this.term('mastery', value);
        break;
      case 'size':
        text = this.term('size', value);
        break;
      case 'darkvision':
        text = value === 'none' ? this.t('compendium.none') : this.feet(Number(value));
        break;
      case 'speed':
        text = value.startsWith('walk:')
          ? this.feet(Number(value.slice(5)))
          : this.term('speed', value);
        break;
      case 'creatureType':
        text = this.term('creatureType', value);
        break;
      case 'feat':
        text = isFeatKind(value)
          ? this.t('picker.featOfKind', { kind: this.term('featCategory', value) })
          : this.data.shortName(value);
        break;
      case 'skill':
        text = this.t(`skill.${value}`);
        break;
      case 'tool':
        text = this.proficiency(value);
        break;
      case 'minLevel':
        text =
          value === 'none'
            ? this.t('picker.prerequisite.none')
            : this.t('picker.levelPlus', { level: value });
        break;
      default:
        text = value;
    }
    return capitalise(text);
  }

  /** "skill:history" → "Historia"; "tool:Disguise Kit" → its name; "toolGroup:…" → "Juego (a elegir)". */
  private proficiency(value: string): string {
    const [kind, name] = [value.slice(0, value.indexOf(':')), value.slice(value.indexOf(':') + 1)];
    if (kind === 'skill') return this.t(`skill.${name}`);
    if (kind === 'toolGroup')
      return this.t('picker.toolChoice', { kind: this.term('toolGroup', name) });
    return this.term('tool', name);
  }

  /** The facets worth showing (more than one value, or one selected), labelled and ordered. */
  facetViews(
    type: EntryType,
    items: readonly Entry[],
    keys: readonly FacetKey[],
    selection: Record<string, string>,
  ): FacetView[] {
    const primary = ENTRY_FACETS[type].slice(0, PRIMARY_FACETS[type]);
    return keys
      .map((key) => ({
        key,
        label: this.facetLabel(key),
        selected: selection[key] ?? '',
        more: !primary.includes(key),
        mode: (['and', 'not'].includes(selection[modeKey(key)] ?? '')
          ? selection[modeKey(key)]
          : 'or') as 'or' | 'and' | 'not',
        // "all at once" only makes sense where an entry can have several values
        canAnd: items.some((i) => facetValues(i, key).length > 1),
        options: facetOptionsFor(items, key, (v) => this.optionLabel(type, key, v)),
      }))
      .filter((f) => f.options.length > 1 || f.selected);
  }

  // -- summaries -----------------------------------------------------------------------------
  summary(e: Entry): CardSummary {
    switch (e.type) {
      case 'class':
        return this.classSummary(e as DndClass);
      case 'background':
        return this.backgroundSummary(e as Background);
      case 'species':
        return this.speciesSummary(e as Species);
      case 'spell':
        return this.spellSummary(e as Spell);
      case 'subclass':
        return this.subclassSummary(e as Subclass);
      case 'feat':
        return this.featSummary(e as Feat);
      case 'item':
        return this.itemSummary(e as Item);
      case 'option':
        return this.optionSummary(e as ClassOption);
      case 'rule':
        return {
          kicker: capitalise(this.term('ruleCategory', (e as Rule).category)),
          facts: this.source(e),
          marks: [],
        };
    }
  }

  private source(e: Entry): CardSummary['facts'] {
    return e.source ? [{ label: this.t('common.source'), value: this.data.text(e.source) }] : [];
  }

  private classSummary(c: DndClass): CardSummary {
    const armor = armorTraining(c);
    const sc = c.spellcasting;
    return {
      kicker: `d${c.hitDie} · ${this.abbr(c.primaryAbility)}`,
      facts: [
        { label: this.t('picker.saves'), value: this.abbr(c.savingThrows) },
        {
          label: this.t('picker.armor'),
          value: armor.length
            ? capitalise(
                armor
                  .map((a) => this.term('armor', a === 'shield' ? 'shields' : a).toLowerCase())
                  .join(', '),
              )
            : this.t('compendium.none'),
        },
        {
          label: this.t('picker.weapons'),
          value: capitalise(
            weaponTraining(c)
              .map((w) => this.term('weapon', w).toLowerCase())
              .join(', '),
          ),
        },
        {
          label: this.t('picker.spells'),
          value: sc ? this.t(`picker.caster.${sc.kind}`) : this.t('picker.caster.none'),
        },
        {
          label: this.t('picker.subclass'),
          value: this.t('picker.atLevel', { level: c.subclassLevel }),
        },
      ],
      marks: [],
    };
  }

  private backgroundSummary(b: Background): CardSummary {
    const feat = backgroundFeat(b);
    const tool = backgroundTool(b);
    return {
      kicker: this.abbr(b.abilityScores),
      facts: [
        ...(feat
          ? [{ label: this.t('picker.feat'), value: this.optionLabel('background', 'feat', feat) }]
          : []),
        {
          label: this.t('picker.skills'),
          value: b.skills.map((s) => this.t(`skill.${s}`)).join(', '),
        },
        ...(tool ? [{ label: this.t('picker.tool'), value: this.proficiency(tool) }] : []),
      ],
      marks: [],
    };
  }

  private speciesSummary(s: Species): CardSummary {
    const speeds = [
      this.feet(s.speed.walk),
      ...Object.entries(s.speed)
        .filter(([k, v]) => k !== 'walk' && v)
        .map(([k, v]) =>
          this.t('compendium.speedKind', { kind: this.term('speed', k), feet: this.feet(v!) }),
        ),
    ];
    const traits = s.traits.map((t) => this.data.shortName(t.name));
    return {
      kicker: [
        s.size.map((z) => this.term('size', z)).join(' / '),
        capitalise(this.term('creatureType', s.creatureType)),
      ].join(' · '),
      facts: [
        { label: this.t('picker.speed'), value: speeds.join(', ') },
        ...(s.darkvision
          ? [{ label: this.t('picker.facet.darkvision'), value: this.feet(s.darkvision) }]
          : []),
        ...(traits.length
          ? [
              {
                label: this.t('picker.traits'),
                value: traits.slice(0, 4).join(', ') + (traits.length > 4 ? '…' : ''),
              },
            ]
          : []),
      ],
      marks: [],
    };
  }

  private spellSummary(s: Spell): CardSummary {
    const lang = this.i18n.language();
    const level =
      s.level === 0 ? this.t('spell.cantrip') : this.t('filter.levelN', { level: s.level });
    return {
      kicker: `${level} · ${this.term('school', s.school)}`,
      facts: [
        // "Reaction, which you take when…" → "Reaction"
        { label: this.t('picker.time'), value: phrase(lang, s.castingTime.raw.split(',')[0]) },
        { label: this.t('picker.range'), value: phrase(lang, s.range) },
        {
          label: this.t('picker.classes'),
          value: s.classes.map((c) => this.className(c)).join(', '),
        },
      ],
      marks: [
        ...(s.concentration
          ? [
              {
                text: this.t('picker.concentrationShort'),
                title: this.t('picker.facet.concentration'),
              },
            ]
          : []),
        ...(s.ritual
          ? [{ text: this.t('picker.ritualShort'), title: this.t('picker.facet.ritual') }]
          : []),
      ],
    };
  }

  private subclassSummary(s: Subclass): CardSummary {
    return { kicker: this.className(s.classId), facts: this.source(s), marks: [] };
  }

  private featSummary(f: Feat): CardSummary {
    return {
      kicker: capitalise(this.term('featCategory', f.category)),
      facts: [
        ...(f.prerequisites
          ? [{ label: this.t('picker.prerequisite'), value: this.data.text(f.prerequisites.raw) }]
          : []),
        ...(f.repeatable
          ? [{ label: this.t('compendium.repeatable'), value: this.t('compendium.yes') }]
          : []),
      ],
      marks: [],
    };
  }

  private itemSummary(i: Item): CardSummary {
    const facts: CardSummary['facts'] = [];
    if (i.weapon?.damage.length)
      facts.push({
        label: this.t('picker.damage'),
        value: i.weapon.damage.map((d) => `${d.dice} ${this.term('damage', d.type)}`).join(' + '),
      });
    if (i.armor?.baseAC != null) {
      const a = i.armor;
      const dex = this.t('abbr.DEX');
      const value =
        a.kind === 'shield'
          ? `+${a.baseAC}`
          : a.dexCap === null
            ? `${a.baseAC} + ${dex}`
            : a.dexCap > 0
              ? this.t('picker.acDexCap', { ac: a.baseAC!, dex, max: a.dexCap })
              : `${a.baseAC}`;
      facts.push({ label: this.t('picker.ac'), value });
    }
    if (i.cost)
      facts.push({
        label: this.t('compendium.costLabel'),
        value: this.t('compendium.cost', {
          amount: i.cost.amount.toLocaleString(this.i18n.language()),
          unit: this.t(`compendium.coin.${i.cost.unit}`),
        }),
      });
    const kind = i.magic?.rarity
      ? `${capitalise(this.term('magicType', i.magic.type))} · ${this.term('rarity', i.magic.rarity)}`
      : capitalise(this.term('itemCategory', i.category));
    return { kicker: kind, facts: facts.slice(0, 3), marks: [] };
  }

  private optionSummary(o: ClassOption): CardSummary {
    return {
      kicker: capitalise(this.term('optionGroup', o.group)),
      facts: [
        ...(o.classId ? [{ label: this.t('picker.class'), value: this.className(o.classId) }] : []),
        ...(o.prerequisites
          ? [{ label: this.t('picker.prerequisite'), value: this.data.text(o.prerequisites.raw) }]
          : []),
      ],
      marks: [],
    };
  }
}
