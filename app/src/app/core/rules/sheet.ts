import { Ability } from '../models/compendium';
import type { FeatureNote } from './feature-stats';

/** Everything the character sheet shows, computed from a Character and the compendium. */
export interface Sheet {
  name: string;
  totalLevel: number;
  proficiencyBonus: number;
  /** "Blood Hunter 5 (Order of the Lycan) / Fighter 1" pieces. */
  classes: {
    id: string;
    name: string;
    level: number;
    subclass: string | null;
    subclassId?: string | null;
  }[];
  species: string | null;
  background: string | null;
  /** The background is the user's own: waiting for the DM's approval, or approved. */
  backgroundHomebrew: 'pending' | 'approved' | null;

  abilities: Record<Ability, { score: number; modifier: number; base: number; bonuses: Bonus[] }>;
  savingThrows: Record<Ability, { modifier: number; proficient: boolean }>;
  skills: {
    id: string;
    ability: Ability;
    modifier: number;
    proficiency: 'none' | 'half' | 'full' | 'expertise';
  }[];
  passivePerception: number;
  initiative: number;

  hitPoints: {
    max: number;
    current: number;
    temp: number;
    hitDice: { die: number; count: number }[];
  };
  armorClass: { value: number; formula: string };
  speed: Record<string, number>;
  darkvision: number | null;
  /** Senses besides Darkvision (Blindsight, Truesight, Tremorsense, Devil's Sight) and where they come from. */
  senses: {
    kind: 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight' | 'devils-sight';
    range: number;
    source: string;
  }[];
  size: string[];
  /** Bonuses of fighting styles and class features that go into the attacks table. */
  combat: CombatInfo;

  spellcasting: {
    classes: {
      classId: string;
      ability: Ability;
      saveDc: number;
      attack: number;
      cantrips: number | null;
      prepared: number | null;
    }[];
    /** Shared slots (all non-pact casters), 9 slot levels. */
    slots: number[];
    /** Warlock Pact Magic, kept apart. */
    pact: { slots: number; level: number } | null;
  };

  proficiencies: { armor: string[]; weapons: string[]; tools: string[] };
  /** Common plus the chosen and feature-granted languages. */
  languages: string[];
  /** Values of each class's table at its current level (Rages, Focus Points, Hemocraft Die...). */
  resources: { classId: string; name: string; value: string }[];
  features: SheetFeature[];
  /** Spells the feats give (Familiar Friend's Find Familiar, Magic Initiate's picks...). */
  featSpells: SheetFeatSpell[];
  /** Countable uses of the feats (Luck Points, free casts, benefits "PB times per Long Rest"). */
  featUses: SheetFeatUse[];
  /** Damage types the character resists because of a feat (Portal Jumper). */
  resistances: string[];
  /** Choices a feat asks for that are not made yet (the sheet works with what is there). */
  featMissing: {
    feat: string;
    key: string;
    what: 'ability' | 'list' | 'cantrips' | 'spell' | 'proficiencies' | 'resistance';
  }[];
  /** Things the engine couldn't resolve (ids not in the compendium, missing choices...). */
  warnings: SheetWarning[];
}

export interface CombatInfo {
  /** Archery (+2) and the like: bonus to attack rolls with Ranged weapons. */
  rangedAttack: number;
  /** Dueling: damage with a one-handed Melee weapon and no other weapon. */
  duelingDamage: number;
  /** Thrown Weapon Fighting: damage with a Thrown weapon in a ranged attack. */
  thrownDamage: number;
  /** Monk's Martial Arts die ("1d8") or null. */
  martialArts: string | null;
  /** Unarmed Fighting style. */
  unarmedFighting: boolean;
  /** Weapon Mastery: how many kinds the classes allow (0 = none). */
  masterySlots: number;
  /** Soulknife Rogue 3+ (Psychic Blades): adds the Psychic Blade attack(s) to the table. */
  psychicBlades: boolean;
  /** Soulknife Rogue 9+ (Soul Blades): Homing Strikes and Psychic Teleportation, noted on the blade. */
  soulBlades: boolean;
  /**
   * The weapon ids (character.choices.weaponMasteries) actually active: a proficient weapon,
   * valid under the current masterySlots, at most masterySlots of them. Empty when none are
   * chosen yet, even if masterySlots > 0 — attacksFor then shows no mastery on any weapon.
   */
  masteryChosen: string[];
  /**
   * Reminders of effects that go on top of an attack or need a roll or a choice (Rage damage,
   * Sneak Attack dice, Hunter's Mark...): id of a UI text (combat.note.<id>) and its parameters.
   */
  notes: FeatureNote[];
  /** Healing, temporary hit points, bonuses and save DCs of the features (combat.stat.<id>). */
  stats: FeatureNote[];
  /** Attack rolls score a critical hit from this number (Champion: 19, 18); 20 = normal. */
  critRange: number;
}

export interface SheetFeatSpell {
  /** Where it comes from: absent = a feat. */
  origin?: 'feat' | 'species' | 'class' | 'subclass' | 'option';
  /** Always prepared (domain, oath and circle spells) and does not count against the prepared spells. */
  always?: boolean;
  /** Can be cast whenever without a spell slot (Armor of Shadows, Mask of Many Faces...). */
  atWill?: boolean;
  /** Id in the compendium; name is the English one. */
  id: string;
  name: string;
  /** True for a cantrip, false for a leveled spell, null when only the compendium knows. */
  cantrip: boolean | null;
  feat: { id: string; name: string };
  /** Where the feat came from: "background", "species" or a feat slot. */
  sourceKey: string;
  ability: Ability;
  /** The ability was picked by the player (otherwise it's the best of INT, WIS, CHA). */
  abilityChosen: boolean;
  saveDc: number;
  attack: number;
  /** Key of the use counter when it can be cast once without a spell slot per Long Rest. */
  freeKey: string | null;
  /** Can also be cast with spell slots. */
  slots: boolean;
}

export interface SheetFeatUse {
  /** Key in state.resources: "feat:<source>:<benefit>". */
  key: string;
  /** English name of the benefit (or of the spell, for a free cast). */
  label: string;
  /** UI text key for a benefit with its own name ("play.res.luckPoints"). */
  labelKey: string | null;
  feat: string;
  kind: 'use' | 'spell';
  max: number;
  rest: 'long' | 'short-or-long';
}

export interface Bonus {
  source: string;
  amount: number;
}

export interface SheetFeature {
  name: string;
  /** Character level for species/feats, class level for class and subclass features. */
  level: number;
  source: {
    type: 'class' | 'subclass' | 'species' | 'feat' | 'background';
    id: string;
    name: string;
  };
  description: string;
}

/** Something the engine couldn't work out; key is a UI text (sheet.warn.*), params fill it in. */
export interface SheetWarning {
  key:
    | 'sheet.warn.notFound'
    | 'sheet.warn.customBackgroundMissing'
    | 'sheet.warn.noSubclass'
    | 'sheet.warn.twoPacts'
    | 'sheet.warn.armorBase'
    | 'sheet.warn.traitChoiceMissing'
    | 'sheet.warn.weaponMastery';
  params?: Record<string, string>;
}
