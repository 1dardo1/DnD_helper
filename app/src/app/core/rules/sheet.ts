import { Ability } from '../models/compendium';

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
  size: string[];

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
  /** Things the engine couldn't resolve (ids not in the compendium, missing choices...). */
  warnings: SheetWarning[];
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
    | 'sheet.warn.twoPacts';
  params?: Record<string, string>;
}
