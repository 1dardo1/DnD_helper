/**
 * Types of the files in data/*.json, as produced by tools/scraper.
 * Every entry shares Entry; each type adds its own fields.
 */

export type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
export type Edition = '2014' | '2024';

export type EntryType =
  | 'class'
  | 'subclass'
  | 'option'
  | 'spell'
  | 'feat'
  | 'species'
  | 'background'
  | 'item'
  | 'rule'
  | 'monster';

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
  /** Made by the user (homebrew, core/homebrew), not part of the extracted compendium. */
  custom?: boolean;
  /** Custom entries: the user says the DM approved it (honour system). */
  dmApproved?: boolean;
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
  /** "Dwarf or a Small race": also any species that can be of one of these sizes. */
  size?: string[];
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

/** A trait or an action of a monster's stat block. */
export interface MonsterFeature {
  name: string;
  /** Markdown. */
  description: string;
}

/** A creature of the SRD 5.2 (2024 Monster Manual), from tools/scraper/dndscraper/monsters.py. */
export interface Monster extends Entry {
  type: 'monster';
  /** "animal" for the creatures of the SRD's Animals appendix. */
  category: 'monster' | 'animal';
  /** "Large"; ["Medium", "Small"] when it can be either. */
  size: string[];
  creatureType: string;
  /** "swarm" for swarms of Tiny creatures. */
  tags: string[];
  alignment: string;
  ac: number;
  /** Armor worn (equipment names), if any. */
  armor: string[];
  hp: number;
  /** "20d10 + 40". */
  hitDice: string;
  speed: {
    walk: number;
    fly?: number;
    swim?: number;
    climb?: number;
    burrow?: number;
    hover?: boolean;
  };
  initiative: number | null;
  abilities: Record<Ability, number>;
  /** Only the proficient saving throws (the rest use the ability modifier). */
  saves: Partial<Record<Ability, number>>;
  /** skill id ("animal-handling") → bonus. */
  skills: Record<string, number>;
  vulnerabilities: string[];
  resistances: string[];
  immunities: string[];
  conditionImmunities: string[];
  /** Range in feet of each special sense (darkvision, blindsight, tremorsense, truesight). */
  senses: Partial<Record<'darkvision' | 'blindsight' | 'tremorsense' | 'truesight', number>>;
  passivePerception: number;
  /** As written ("Common, Draconic"); empty when it speaks none. */
  languages: string;
  /** Challenge rating: 0, 0.125, 0.25, 0.5, 1…30. */
  cr: number;
  xp: number;
  xpInLair: number | null;
  proficiencyBonus: number;
  gear: string[];
  traits: MonsterFeature[];
  actions: MonsterFeature[];
  bonusActions: MonsterFeature[];
  reactions: MonsterFeature[];
  legendaryActions: MonsterFeature[];
  legendaryActionUses: { uses: number; inLair: number | null } | null;
  legendary: boolean;
  /** It casts spells (a Spellcasting action or trait, or actions that cast a spell). */
  spellcasting: boolean;
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
  monster: Monster;
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
  monster: 'monsters',
  rule: 'rules',
};

export const ENTRY_TYPES = Object.keys(DATA_FILES) as EntryType[];

export interface DataMeta {
  generatedAt: string;
  /** Last run of the translator (data/es/*.json). */
  translatedAt?: string;
  counts: Partial<Record<EntryType, number>>;
}
