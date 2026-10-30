import { Ability } from './compendium';

/**
 * A character file (characters/<id>.json). It stores choices only; everything derivable
 * (modifiers, proficiency bonus, slots...) is computed by the rules engine when loaded.
 */
export interface Character {
  schemaVersion: 1;
  id: string;
  name: string;
  /** meta.generatedAt of the data the character was built with. */
  dataVersion: string | null;
  /** When and from which device (Settings → device name) it was last edited. */
  updatedAt: string;
  updatedBy: string;
  species: { id: string; variant: string | null } | null;
  /** Chosen size when the species allows more than one ("Small" / "Medium"). */
  size: string | null;
  background: { id: string; abilityIncreases: Partial<Record<Ability, number>> } | null;
  /**
   * In the order they were taken; the first one is the starting class (its saving throws,
   * full HP die at level 1). hp: hit points gained at each level of that class (null = average).
   * spellAbility: the spellcasting ability picked when the subclass lets you choose (Profane Soul:
   * INT or WIS); absent = the default one.
   */
  classes: {
    id: string;
    level: number;
    subclassId: string | null;
    hp: (number | null)[];
    spellAbility?: Ability | null;
  }[];
  abilityScores: {
    method: 'standard' | 'point-buy' | 'roll' | 'manual';
    base: Record<Ability, number>;
  } | null;
  choices: {
    /** Skill proficiencies chosen from class, background, species, feats... */
    skills: string[];
    /** Skills with Expertise (double proficiency). */
    expertise: string[];
    /** Extra saving throw proficiencies (e.g. the Resilient feat). */
    saves: Ability[];
    /** Feat ids, including origin feats and Ability Score Improvement. */
    feats: string[];
    /**
     * Feats taken at the levels that grant one: ASI levels ("ability-score-improvement" or a
     * general feat), Fighting Style, Epic Boon. slot = "<classId>:<level>".
     */
    featSlots: { slot: string; featId: string | null }[];
    /** Ability increases other than the background's (ASIs, half feats...), by feat and slot. */
    abilityIncreases: { source: string; ability: Ability; amount: number; slot?: string }[];
    /** Class option ids (invocations, maneuvers, blood curses...). */
    options: string[];
    spells: string[];
    /** Languages besides Common, and those granted by features (Druidic, Thieves' Cant). */
    languages: string[];
    /**
     * Tools picked where a background or class says "choose one kind of ...".
     * slot: "background", "class:<id>" or "multiclass:<id>".
     */
    toolChoices: { slot: string; tools: string[] }[];
  };
  /** Item ids from data/items.json, used for Armor Class. */
  equipped: { armorId: string | null; shield: boolean };
  equipment: string;
  state: {
    hpCurrent: number | null;
    hpTemp: number;
    /** Spell slots spent per level (1–9). */
    spentSlots: number[];
    /** Uses spent per class resource, by "<classId>:<name>" (see core/play). */
    resources: Record<string, number>;
    pactSlotsSpent: number;
    /** Hit Dice spent per size ("d10"). */
    hitDiceSpent: Record<string, number>;
    deathSaves: { successes: number; failures: number };
    heroicInspiration: boolean;
    /** Active conditions (ids from core/play/conditions.ts) and the Exhaustion level (0-6). */
    conditions: string[];
    exhaustion: number;
    /**
     * Prepared spells that may be changed now, by class id: after a Long Rest, 'any' (Cleric,
     * Druid, Wizard...) or 'one' (Paladin, Ranger). Cleared once changed or dismissed.
     */
    spellSwap: Record<string, 'any' | 'one'>;
  };
  notes: string;
}

/**
 * Where a character stands with respect to the repository ("the cloud").
 *
 * local          → only on this device, or changed here since the last save to the repo
 * sent           → commit sent to GitHub, not yet confirmed by reading it back
 * synced         → the repo file is identical to the local copy
 * conflict       → the repo has a different version than the one this device started from
 * pending-delete → deleted here; the repo file will be removed on the next sync
 */
export type SyncStatus = 'local' | 'sent' | 'synced' | 'conflict' | 'pending-delete';

/** What the device stores for each character. */
export interface CharacterRecord {
  character: Character;
  status: SyncStatus;
  /** Git blob sha of the repo version this local copy is based on (null if never in the repo). */
  baseSha: string | null;
  /** Git blob sha of the content sent in the last commit, while status is 'sent'. */
  sentSha: string | null;
  /** The repo version, while status is 'conflict'. */
  remote: Character | null;
}

export function newCharacter(name: string, device: string): Character {
  const slug =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // "José" → "jose"
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'character';
  return {
    schemaVersion: 1,
    id: `${slug}-${Date.now()}`,
    name,
    dataVersion: null,
    updatedAt: new Date().toISOString(),
    updatedBy: device,
    species: null,
    size: null,
    background: null,
    classes: [],
    abilityScores: null,
    choices: {
      skills: [],
      expertise: [],
      saves: [],
      feats: [],
      featSlots: [],
      abilityIncreases: [],
      options: [],
      spells: [],
      languages: [],
      toolChoices: [],
    },
    equipped: { armorId: null, shield: false },
    equipment: '',
    state: {
      hpCurrent: null,
      hpTemp: 0,
      spentSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      resources: {},
      pactSlotsSpent: 0,
      hitDiceSpent: {},
      deathSaves: { successes: 0, failures: 0 },
      heroicInspiration: false,
      conditions: [],
      exhaustion: 0,
      spellSwap: {},
    },
    notes: '',
  };
}

/**
 * Fills in what an older or hand-written character file may lack, so the rest of the app can
 * rely on every field. Returns null if the JSON isn't a character at all.
 */
export function normalizeCharacter(raw: unknown): Character | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<Character>;
  if (typeof c.id !== 'string' || typeof c.name !== 'string') return null;
  const base = newCharacter(c.name, c.updatedBy ?? '');
  return {
    ...base,
    ...c,
    id: c.id,
    schemaVersion: 1,
    choices: { ...base.choices, ...(c.choices ?? {}) },
    equipped: { ...base.equipped, ...(c.equipped ?? {}) },
    state: { ...base.state, ...(c.state ?? {}) },
    classes: (c.classes ?? []).map((k) => ({
      ...k,
      hp: k.hp ?? [],
      subclassId: k.subclassId ?? null,
    })),
  };
}
