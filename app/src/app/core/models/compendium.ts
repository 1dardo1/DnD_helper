/**
 * Types of the files in data/*.json, as produced by tools/scraper.
 * Every entry shares Entry; each type adds its own fields.
 */

export type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
export type Edition = '2014' | '2024';

export type EntryType =
  'class' | 'subclass' | 'option' | 'spell' | 'feat' | 'species' | 'background' | 'item' | 'rule';

export interface Entry {
  id: string;
  type: EntryType;
  name: string;
  edition: Edition;
  source: string | null;
  /** Markdown. */
  description: string;
  url: string;
  /** 2014 pages this 2024 entry replaced. */
  replaced?: string[];
  /** Changes made to adapt a 2014 entry to 2024 rules. */
  adjustments?: string[];
}

export interface Feature {
  name: string;
  level: number;
  description: string;
  optional?: boolean;
}

export interface AbilityGroup {
  anyOf: Ability[];
  min: number;
}

export interface ProgressionRow {
  level: number;
  proficiencyBonus: number | null;
  features: string[];
  values: Record<string, string>;
}

export interface Spellcasting {
  ability: Ability | null;
  /** When the caster picks it (Profane Soul: Intelligence or Wisdom); ability is the default. */
  abilityChoices?: Ability[] | null;
  /** Whose spell list it uses, for subclass casters (Eldritch Knight → "wizard"). */
  spellList?: string | null;
  kind: 'full' | 'half' | 'third' | 'pact' | 'other';
  preparation: 'prepared' | 'known';
  cantripsByLevel: number[] | null;
  preparedByLevel: number[] | null;
  /** 20 rows × 9 slot levels. */
  slotsByLevel: number[][];
}

export interface DndClass extends Entry {
  type: 'class';
  hitDie: number;
  primaryAbility: Ability[];
  savingThrows: Ability[];
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    skills: { choose: number; from: string[] };
  };
  startingEquipment: string;
  /** Every group is required; any ability within a group satisfies it. */
  multiclass: {
    prerequisites: AbilityGroup[];
    proficienciesGained: string | null;
    /** What multiclassing into it grants; origin "estimate" = deduced, not from the source. */
    gains?: {
      armor: string[];
      weapons: string[];
      tools: string[];
      skill: 'list' | 'any' | null;
      instrument: boolean;
      origin: 'text' | 'table' | 'estimate';
    };
  };
  subclassTitle: string;
  subclassLevel: number;
  subclassFeatureLevels: number[];
  progression: { columns: string[]; rows: ProgressionRow[] };
  spellcasting: Spellcasting | null;
  features: Feature[];
}

export interface Subclass extends Entry {
  type: 'subclass';
  classId: string;
  shortName: string;
  features: Feature[];
  spells: { classLevel: number; spells: string[] }[] | null;
  /** Subclasses that cast on their own (Eldritch Knight, Arcane Trickster, Profane Soul...). */
  spellcasting?: Spellcasting | null;
}

export interface Prerequisites {
  raw: string;
  level?: number;
  abilities?: { ability: Ability; min: number }[];
  abilitiesMode?: 'all' | 'any';
  species?: string[];
  spellcasting?: boolean;
  proficiency?: string[];
}

export interface ClassOption extends Entry {
  type: 'option';
  group: string;
  classId: string | null;
  subclassId: string | null;
  prerequisites: Prerequisites | null;
}

export interface Spell extends Entry {
  type: 'spell';
  level: number;
  school: string;
  ritual: boolean;
  castingTime: { raw: string; amount: number; unit: string };
  reactionTrigger: string | null;
  range: string;
  components: {
    v: boolean;
    s: boolean;
    m: boolean;
    material: string | null;
    cost: number | null;
    consumed: boolean;
  };
  duration: string;
  concentration: boolean;
  classes: string[];
  higherLevels: string | null;
}

export interface Feat extends Entry {
  type: 'feat';
  category: string;
  prerequisites: Prerequisites | null;
  repeatable: boolean;
  abilityIncrease: { choose: number; from: Ability[]; amount: number; max: number } | null;
}

export interface SpeciesVariant {
  name: string;
  description: string;
  traits: Feature[];
  spells: { level: number; spells: string[] }[] | null;
}

export interface Species extends Entry {
  type: 'species';
  creatureType: string;
  size: string[];
  speed: { walk: number; fly?: number; swim?: number; climb?: number; burrow?: number };
  darkvision: number | null;
  traits: Feature[];
  variants: SpeciesVariant[];
  /** Picture on a Fandom wiki (shown without a Referer), or null. */
  image?: string | null;
}

export interface Background extends Entry {
  type: 'background';
  abilityScores: Ability[];
  feat: string | null;
  featId: string | null;
  skills: string[];
  tools: string | null;
  equipment: string;
}

export interface Item extends Entry {
  type: 'item';
  category: string;
  cost: { amount: number; unit: string } | null;
  weight: number | null;
  weapon?: {
    kind: 'simple' | 'martial' | null;
    ranged: boolean;
    damage: { dice: string; type: string }[];
    properties: string[];
    range: string | null;
    mastery: string | null;
  };
  armor?: {
    kind: string;
    baseAC: number | null;
    dexCap: number | null;
    strength: number | null;
    stealthDisadvantage: boolean;
  };
  magic?: {
    rarity: string | null;
    type: string;
    subtype: string | null;
    attunement: boolean;
    attunementBy: string | null;
  };
}

export interface Rule extends Entry {
  type: 'rule';
  category: string;
}

export interface EntryByType {
  class: DndClass;
  subclass: Subclass;
  option: ClassOption;
  spell: Spell;
  feat: Feat;
  species: Species;
  background: Background;
  item: Item;
  rule: Rule;
}

/** data/<file>.json for each type. */
export const DATA_FILES: Record<EntryType, string> = {
  class: 'classes',
  subclass: 'subclasses',
  option: 'options',
  spell: 'spells',
  feat: 'feats',
  species: 'species',
  background: 'backgrounds',
  item: 'items',
  rule: 'rules',
};

export const ENTRY_TYPES = Object.keys(DATA_FILES) as EntryType[];

export interface DataMeta {
  generatedAt: string;
  /** Last run of the translator (data/es/*.json). */
  translatedAt?: string;
  counts: Partial<Record<EntryType, number>>;
}
