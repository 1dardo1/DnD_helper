import {
  FilterKey,
  RARITY_ORDER,
  filterValues,
} from '../../features/compendium/compendium-filters';
import {
  Background,
  ClassOption,
  DndClass,
  Entry,
  EntryType,
  Feat,
  Item,
  Prerequisites,
  Spell,
  Species,
  Subclass,
} from '../../core/models/compendium';

/**
 * Facets the pickers and the compendium lists filter by, derived from the data fields (and, for a
 * few spell facts only found in the text, from conservative regexes). The compendium's original
 * filters (level, school, class, category, rarity, magic, group, edition) keep their keys; every
 * key is also the URL query parameter of the compendium lists.
 */
export type FacetKey =
  | FilterKey
  // spells
  | 'castingTime'
  | 'duration'
  | 'concentration'
  | 'ritual'
  | 'components'
  | 'range'
  | 'area'
  | 'resolve'
  | 'damage'
  // classes and subclasses
  | 'primary'
  | 'caster'
  | 'hitDie'
  | 'armor'
  | 'saves'
  | 'casting'
  // species
  | 'size'
  | 'darkvision'
  | 'speed'
  | 'creatureType'
  // backgrounds
  | 'feat'
  | 'ability'
  | 'skill'
  | 'tool'
  // feats and options
  | 'increase'
  | 'prerequisite'
  | 'repeatable'
  | 'minLevel'
  // items
  | 'attunement'
  | 'weaponKind'
  | 'weaponRange'
  | 'property'
  | 'mastery'
  | 'armorKind'
  | 'stealth'
  | 'price';

/**
 * Facets offered for each type, the most used first: the first `PRIMARY_FACETS[type]` are always
 * visible, the rest go under "Más filtros".
 */
export const ENTRY_FACETS: Record<EntryType, FacetKey[]> = {
  class: ['primary', 'caster', 'hitDie', 'armor', 'saves', 'edition'],
  subclass: ['class', 'casting', 'edition'],
  option: ['group', 'class', 'minLevel', 'prerequisite', 'edition'],
  spell: [
    'level',
    'school',
    'castingTime',
    'concentration',
    'class',
    'duration',
    'ritual',
    'components',
    'range',
    'area',
    'resolve',
    'damage',
    'edition',
  ],
  feat: ['category', 'increase', 'prerequisite', 'repeatable', 'edition'],
  species: ['size', 'speed', 'darkvision', 'creatureType', 'edition'],
  background: ['feat', 'ability', 'skill', 'tool', 'edition'],
  item: [
    'category',
    'magic',
    'rarity',
    'price',
    'attunement',
    'weaponKind',
    'weaponRange',
    'damage',
    'property',
    'mastery',
    'armorKind',
    'stealth',
    'edition',
  ],
  rule: ['category'],
};

export const PRIMARY_FACETS: Record<EntryType, number> = {
  class: 4,
  subclass: 3,
  option: 3,
  spell: 4,
  feat: 3,
  species: 4,
  background: 4,
  item: 4,
  rule: 1,
};

// -- spells --------------------------------------------------------------------------------------

export type CastingBucket = 'action' | 'bonus' | 'reaction' | 'longer';

/** Action, bonus action, reaction, or longer (1 minute or more). */
export function castingBucket(spell: Pick<Spell, 'castingTime'>): CastingBucket {
  switch (spell.castingTime.unit) {
    case 'action':
      return 'action';
    case 'bonus-action':
      return 'bonus';
    case 'reaction':
      return 'reaction';
    default:
      return 'longer';
  }
}

const SECONDS: Record<string, number> = { round: 6, minute: 60, hour: 3600, day: 86400 };

export type DurationBucket = 'instant' | 'minute' | 'hour' | 'longer' | 'dispelled' | 'special';

/**
 * "Instantaneous" → instant; "Concentration, up to 1 minute" / "1 round" → minute (up to 1 minute);
 * "10 minutes" / "1 hour" → hour (up to 1 hour); "8 hours", "10 days" → longer; "Until dispelled" →
 * dispelled; anything else → special. "Instantaneous or 1 hour" counts by its first part.
 */
export function durationBucket(duration: string): DurationBucket {
  const d = duration.trim().toLowerCase();
  if (/^instant/.test(d)) return 'instant';
  if (/^until dispelled/.test(d)) return 'dispelled';
  const m = /(\d+)\s*(round|minute|hour|day)s?/.exec(d);
  if (!m) return 'special';
  const s = Number(m[1]) * SECONDS[m[2]];
  return s <= 60 ? 'minute' : s <= 3600 ? 'hour' : 'longer';
}

/** V, S, M, plus "cost" (material with a price) and "consumed". */
export function componentValues(spell: Pick<Spell, 'components'>): string[] {
  const c = spell.components;
  return [
    ...(c.v ? ['V'] : []),
    ...(c.s ? ['S'] : []),
    ...(c.m ? ['M'] : ['noM']),
    ...(c.cost ? ['cost'] : []),
    ...(c.consumed ? ['consumed'] : []),
  ];
}

/** "Self", "Touch", or at a distance ("60 feet", "1 mile", "Sight", "Unlimited"). */
export function rangeKind(range: string): 'self' | 'touch' | 'ranged' | 'special' {
  const r = range.trim().toLowerCase();
  if (r.startsWith('self')) return 'self';
  if (r.startsWith('touch')) return 'touch';
  if (/\d|sight|unlimited/.test(r)) return 'ranged';
  return 'special';
}

export const AREA_SHAPES = ['cone', 'cube', 'cylinder', 'emanation', 'line', 'sphere'] as const;

/**
 * Area shapes named with a size ("a 20-foot-radius Sphere", "15-foot Cone", "Self (30-foot line)",
 * "a 10-foot Emanation"): only those, so a passing mention of a "line of sight" doesn't count.
 */
export function areaShapes(spell: Pick<Spell, 'range' | 'description'>): string[] {
  const text = `${spell.range} ${spell.description}`;
  const rx =
    /\b\d+-foot(?:[- ](?:radius|long|wide|tall|high))?[- ](cone|cube|cylinder|emanation|line|sphere)\b/gi;
  return [...new Set([...text.matchAll(rx)].map((m) => m[1].toLowerCase()))].sort();
}

const ABILITY_WORDS: Record<string, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

/** How it resolves: "attack" (a spell attack roll) and/or the saving throws it asks for. */
export function resolveValues(spell: Pick<Spell, 'description'>): string[] {
  const out = new Set<string>();
  if (/\bspell attack\b/i.test(spell.description)) out.add('attack');
  for (const m of spell.description.matchAll(
    /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/gi,
  ))
    out.add(ABILITY_WORDS[m[1].toLowerCase()]);
  return [...out];
}

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const;

/** Damage types dealt ("takes 8d6 Fire damage"), plus "healing" when it restores Hit Points. */
export function spellDamage(spell: Pick<Spell, 'description'>): string[] {
  const rx = new RegExp(`\\b(${DAMAGE_TYPES.join('|')}) damage\\b`, 'gi');
  const out = new Set([...spell.description.matchAll(rx)].map((m) => m[1].toLowerCase()));
  if (/\bregains?\b[^.]{0,60}\bhit points\b/i.test(spell.description)) out.add('healing');
  return [...out].sort();
}

// -- classes ---------------------------------------------------------------------------------------

export type ArmorTraining = 'light' | 'medium' | 'heavy' | 'shield';

/** "Light", "Medium armor", "Shields" → light, medium, shield (in that order). */
export function armorTraining(cls: Pick<DndClass, 'proficiencies'>): ArmorTraining[] {
  const out = new Set<ArmorTraining>();
  for (const a of cls.proficiencies.armor) {
    const s = a.toLowerCase();
    if (s.startsWith('light')) out.add('light');
    else if (s.startsWith('medium')) out.add('medium');
    else if (s.startsWith('heavy')) out.add('heavy');
    else if (s.startsWith('shield')) out.add('shield');
  }
  return (['light', 'medium', 'heavy', 'shield'] as const).filter((x) => out.has(x));
}

/** "Simple", "Martial weapons" → glossary keys ("simple weapons", "martial weapons"). */
export function weaponTraining(cls: Pick<DndClass, 'proficiencies'>): string[] {
  return cls.proficiencies.weapons.map((w) => {
    const s = w.trim().toLowerCase();
    return s === 'simple' || s === 'martial' ? `${s} weapons` : s;
  });
}

/** Subclass magic: its own spellcasting, an extra spell list, or none. */
export function subclassCasting(sub: Pick<Subclass, 'spellcasting' | 'spells'>): string {
  if (sub.spellcasting) return 'caster';
  return sub.spells?.length ? 'spells' : 'no';
}

// -- backgrounds -------------------------------------------------------------------------------

/** Category slugs of backgrounds that let you choose a feat of a kind ("a Dark Gift feat"). */
const FEAT_KINDS: [RegExp, string][] = [
  [/dark gift/i, 'dark-gift'],
  [/planar pact/i, 'planar-pact'],
];

/** The origin feat a background gives (its English name), or the kind of feat to choose. */
export function backgroundFeat(bg: Pick<Background, 'feat' | 'featId'>): string | null {
  if (!bg.feat) return null;
  if (bg.featId) return bg.feat;
  return FEAT_KINDS.find(([rx]) => rx.test(bg.feat!))?.[1] ?? bg.feat;
}

export function isFeatKind(value: string): boolean {
  return FEAT_KINDS.some(([, slug]) => slug === value);
}

/** Tool kinds a background may let you choose from. */
const TOOL_KINDS: [RegExp, string][] = [
  [/artisan/i, "Artisan's Tools"],
  [/gaming/i, 'Gaming Set'],
  [/instrument/i, 'Musical Instrument'],
];

/**
 * A background's tool as "tool:<name>" or "toolGroup:<kind>" ("Choose one kind of Gaming Set").
 * "Tinker's Tools (as engineer's toolkit)" → "tool:Tinker's Tools".
 */
export function backgroundTool(bg: Pick<Background, 'tools'>): string | null {
  if (!bg.tools) return null;
  if (/choose/i.test(bg.tools)) {
    const kind = TOOL_KINDS.find(([rx]) => rx.test(bg.tools!))?.[1];
    if (kind) return `toolGroup:${kind}`;
  }
  return `tool:${bg.tools.replace(/\s*\(.*\)\s*$/, '').trim()}`;
}

// -- species -----------------------------------------------------------------------------------

/** "walk:30" plus every other way of moving ("fly", "swim"...). */
export function speedValues(sp: Pick<Species, 'speed'>): string[] {
  const out = [`walk:${sp.speed.walk}`];
  for (const [kind, feet] of Object.entries(sp.speed)) if (kind !== 'walk' && feet) out.push(kind);
  return out;
}

// -- feats and options --------------------------------------------------------------------------

/** "yes" plus the abilities a feat can raise, or "no". */
export function increaseValues(feat: Pick<Feat, 'abilityIncrease' | 'id'>): string[] {
  if (feat.id === 'ability-score-improvement')
    return ['yes', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const from = feat.abilityIncrease?.from ?? [];
  return from.length ? ['yes', ...from] : ['no'];
}

/** none, or any plus what kind: level 4+, level 19+, a species, spellcasting. */
export function prerequisiteValues(p: Prerequisites | null): string[] {
  if (!p) return ['none'];
  const out = ['any'];
  if (p.level && p.level >= 19) out.push('level19');
  else if (p.level && p.level >= 4) out.push('level4');
  if (p.species?.length) out.push('species');
  if (p.spellcasting) out.push('spellcasting');
  return out;
}

// -- items -------------------------------------------------------------------------------------

/** "Ammunition (Range 80/320; Arrow)" → "ammunition". */
export function weaponProperties(item: Pick<Item, 'weapon'>): string[] {
  return (item.weapon?.properties ?? []).map((p) =>
    p
      .replace(/\s*\(.*$/, '')
      .trim()
      .toLowerCase(),
  );
}

/** Copper pieces per coin: 1 pp = 10 gp, 1 gp = 2 ep = 10 sp = 100 cp. */
export const COIN_CP: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

/** A price in copper pieces, to compare and sort; null without a price (or an unknown coin). */
export function priceInCp(cost: Item['cost']): number | null {
  if (!cost) return null;
  const rate = COIN_CP[cost.unit.toLowerCase()];
  return rate === undefined ? null : cost.amount * rate;
}

/** Price range in gold: none, < 1 gp, 1–10, 10–100, 100–1,000, > 1,000. */
export function priceBucket(cost: Item['cost']): string {
  const cp = priceInCp(cost);
  if (cp === null) return 'none';
  const gp = cp / 100;
  if (gp < 1) return 'lt1';
  if (gp <= 10) return '1-10';
  if (gp <= 100) return '10-100';
  if (gp <= 1000) return '100-1000';
  return 'gt1000';
}

/** Items by price (cheapest first, or dearest with `desc`); those without a price go last. */
export function sortByPrice<T extends Pick<Item, 'cost'>>(items: readonly T[], desc = false): T[] {
  return [...items].sort((a, b) => {
    const [x, y] = [priceInCp(a.cost), priceInCp(b.cost)];
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return desc ? y - x : x - y;
  });
}

// -- every facet -------------------------------------------------------------------------------

const yesNo = (b: boolean) => [b ? 'yes' : 'no'];
const as = <T>(e: Entry) => e as unknown as T;

/** The values an entry has for a facet. */
export function facetValues(e: Entry, key: FacetKey): string[] {
  switch (e.type) {
    case 'spell': {
      const s = as<Spell>(e);
      switch (key) {
        case 'castingTime':
          return [castingBucket(s), ...(s.ritual ? ['ritual'] : [])];
        case 'duration':
          return [durationBucket(s.duration)];
        case 'concentration':
          return yesNo(s.concentration);
        case 'ritual':
          return yesNo(s.ritual);
        case 'components':
          return componentValues(s);
        case 'range':
          return [rangeKind(s.range)];
        case 'area': {
          const shapes = areaShapes(s);
          return shapes.length ? ['yes', ...shapes] : ['none'];
        }
        case 'resolve':
          return resolveValues(s);
        case 'damage': {
          // "any" = deals some damage, so "No" + "any" leaves the spells that don't
          const d = spellDamage(s);
          const types = d.filter((v) => v !== 'healing');
          return d.length ? (types.length ? ['any', ...d] : d) : ['other'];
        }
      }
      break;
    }
    case 'class': {
      const c = as<DndClass>(e);
      switch (key) {
        case 'primary':
          return c.primaryAbility;
        case 'caster':
          return [c.spellcasting?.kind ?? 'none'];
        case 'hitDie':
          return [String(c.hitDie)];
        case 'armor': {
          const a = armorTraining(c);
          return a.length ? a : ['none'];
        }
        case 'saves':
          return c.savingThrows;
      }
      break;
    }
    case 'subclass':
      if (key === 'casting') return [subclassCasting(as<Subclass>(e))];
      break;
    case 'species': {
      const sp = as<Species>(e);
      switch (key) {
        case 'size':
          return sp.size.map((s) => s.toLowerCase());
        case 'darkvision':
          return [sp.darkvision ? String(sp.darkvision) : 'none'];
        case 'speed':
          return speedValues(sp);
        case 'creatureType':
          return [sp.creatureType];
      }
      break;
    }
    case 'background': {
      const b = as<Background>(e);
      switch (key) {
        case 'feat': {
          const f = backgroundFeat(b);
          return f ? [f] : [];
        }
        case 'ability':
          return b.abilityScores;
        case 'skill':
          return b.skills;
        case 'tool': {
          const t = backgroundTool(b);
          return t ? [t] : [];
        }
      }
      break;
    }
    case 'feat': {
      const f = as<Feat>(e);
      switch (key) {
        case 'increase':
          return increaseValues(f);
        case 'prerequisite':
          return prerequisiteValues(f.prerequisites);
        case 'repeatable':
          return yesNo(f.repeatable);
      }
      break;
    }
    case 'option': {
      const o = as<ClassOption>(e);
      switch (key) {
        case 'minLevel':
          return [o.prerequisites?.level ? String(o.prerequisites.level) : 'none'];
        case 'prerequisite':
          return yesNo(!!o.prerequisites);
      }
      break;
    }
    case 'item': {
      const i = as<Item>(e);
      switch (key) {
        case 'attunement':
          return i.magic ? yesNo(i.magic.attunement) : [];
        case 'weaponKind':
          return i.weapon?.kind ? [i.weapon.kind] : [];
        case 'weaponRange':
          return i.weapon ? [i.weapon.ranged ? 'ranged' : 'melee'] : [];
        case 'damage':
          return [...new Set((i.weapon?.damage ?? []).map((d) => d.type.toLowerCase()))];
        case 'property':
          return weaponProperties(i);
        case 'mastery':
          return i.weapon?.mastery ? [i.weapon.mastery.toLowerCase()] : [];
        case 'armorKind':
          return i.armor ? [i.armor.kind.toLowerCase()] : [];
        case 'price':
          return [priceBucket(i.cost)];
        case 'stealth':
          return i.armor && i.armor.kind !== 'shield' ? yesNo(i.armor.stealthDisadvantage) : [];
      }
      break;
    }
  }
  return isFilterKey(key) ? filterValues(e, key) : [];
}

const FILTER_KEYS = new Set<string>([
  'level',
  'school',
  'class',
  'category',
  'rarity',
  'magic',
  'group',
  'edition',
]);

function isFilterKey(key: FacetKey): key is FilterKey {
  return FILTER_KEYS.has(key);
}

const ORDER: Partial<Record<FacetKey, string[]>> = {
  castingTime: ['action', 'bonus', 'reaction', 'longer', 'ritual'],
  duration: ['instant', 'minute', 'hour', 'longer', 'dispelled', 'special'],
  components: ['V', 'S', 'M', 'noM', 'cost', 'consumed'],
  range: ['self', 'touch', 'ranged', 'special'],
  resolve: ['attack', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
  caster: ['full', 'half', 'third', 'pact', 'other', 'none'],
  armor: ['heavy', 'medium', 'light', 'shield', 'none'],
  armorKind: ['light', 'medium', 'heavy', 'shield'],
  area: ['yes', 'none', ...AREA_SHAPES],
  price: ['none', 'lt1', '1-10', '10-100', '100-1000', 'gt1000'],
  casting: ['caster', 'spells', 'no'],
  size: ['tiny', 'small', 'medium', 'large'],
  primary: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
  ability: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
  saves: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
  increase: ['yes', 'no', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
  prerequisite: ['none', 'any', 'level4', 'level19', 'species', 'spellcasting', 'yes', 'no'],
  weaponRange: ['melee', 'ranged'],
  weaponKind: ['simple', 'martial'],
};

/** Order of a facet's values when it isn't alphabetical by label (null = alphabetical). */
export function facetRank(key: FacetKey, value: string): number | null {
  const order = ORDER[key];
  if (order) {
    const i = order.indexOf(value);
    return i < 0 ? order.length : i;
  }
  switch (key) {
    case 'level':
    case 'hitDie':
      return Number(value);
    case 'minLevel':
    case 'darkvision':
      return value === 'none' ? 0 : Number(value);
    case 'speed':
      return value.startsWith('walk:') ? Number(value.slice(5)) : 1000;
    case 'damage':
      return value === 'any' ? -1 : value === 'healing' ? 1 : value === 'other' ? 2 : 0;
    case 'concentration':
    case 'ritual':
    case 'repeatable':
    case 'attunement':
    case 'stealth':
      return value === 'yes' ? 0 : 1;
    case 'tool':
      return value.startsWith('toolGroup:') ? 1 : 0;
    case 'rarity': {
      const i = RARITY_ORDER.indexOf(value.toLowerCase());
      return i < 0 ? RARITY_ORDER.length : i;
    }
    default:
      return null;
  }
}

/** A facet's values among the entries with their labels: in game order, else by label. */
export function facetOptionsFor(
  entries: readonly Entry[],
  key: FacetKey,
  label: (value: string) => string,
): { value: string; label: string }[] {
  const values = [...new Set(entries.flatMap((e) => facetValues(e, key)))];
  const rank = (v: string) => facetRank(key, v) ?? 0;
  return values
    .map((value) => ({ value, label: label(value) }))
    .sort((a, b) => rank(a.value) - rank(b.value) || a.label.localeCompare(b.label));
}
