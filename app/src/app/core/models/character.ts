import { ReplicatedItem, normalizeReplicated } from '../artificer/replicated-state';
import { TempSlot, normalizeCharges, normalizeTempSlots } from '../artificer/tinker';
import { SummonsState, normalizeSummons } from '../summons/summon-state';
import { Ability } from './compendium';

/**
 * A character file (characters/<id>.json). It stores choices only; everything derivable
 * (modifiers, proficiency bonus, slots...) is computed by the rules engine when loaded.
 */
export interface Character {
  schemaVersion: 1;
  id: string;
  name: string;
  /**
   * Free-text folder name the player put this character in, for organizing the character list
   * (core/organize/folders.ts); null/absent = no folder. It's just a label kept on the character,
   * not a separate entity, so it's synced like the rest of the file (GitHub + IndexedDB) with no
   * extra plumbing. The list of folders the user has created (so an empty one doesn't disappear)
   * is a local-only preference (core/organize/folder-prefs.ts), not synced between devices.
   */
  folder?: string | null;
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
    /**
     * What each feat asks the player to choose (spellcasting ability, spell list and spells, skills,
     * tools...), by where the feat came from: "background", "species", a feat slot ("fighter:4")
     * or "feat:<id>". See core/rules/feat-effects.ts.
     */
    featChoices?: Record<string, FeatChoice>;
    /** Ability increases other than the background's (ASIs, half feats...), by feat and slot. */
    abilityIncreases: { source: string; ability: Ability; amount: number; slot?: string }[];
    /** Class option ids (invocations, maneuvers, blood curses...). */
    options: string[];
    /** Every spell the character has, once (kept for older versions of the app). */
    spells: string[];
    /**
     * The class each spell was picked for, by class id (cantrips and leveled spells together). The
     * same spell can be under two classes: it is one spell but a pick from each. Absent in
     * characters from before it existed; core/creation/spell-choices.ts works it out from `spells`.
     */
    spellsByClass?: Record<string, string[]>;
    /** Languages besides Common, and those granted by features (Druidic, Thieves' Cant). */
    languages: string[];
    /**
     * Tools picked where a background or class says "choose one kind of ...".
     * slot: "background", "class:<id>" or "multiclass:<id>".
     */
    toolChoices: { slot: string; tools: string[] }[];
    /** Starting equipment package letters (class, background) and what was bought with gold. */
    startingEquipment?: {
      class: string | null;
      background: string | null;
      bought: { itemId: string; qty: number }[];
      /** 'gold': the gold instead of the packages, to buy everything in the shop. */
      mode?: 'packages' | 'gold';
    };
  };
  /** Item ids from data/items.json, used for Armor Class (kept in step with the inventory). */
  equipped: { armorId: string | null; shield: boolean };
  /** Free text (starting equipment written by the wizard). */
  equipment: string;
  /** Carried items: from the compendium (itemId) or written by hand (itemId null). */
  inventory: InventoryEntry[];
  /** Coins carried (absent in older files: none). */
  money?: Coins;
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
    /** Creatures summoned by spells and features (absent until the first one is marked). */
    summons?: SummonsState;
    /** Items created with Replicate Magic Item, oldest first (absent: none). */
    replicated?: ReplicatedItem[];
    /** A Long Rest asked whether to keep or change the created items; cleared once answered. */
    replicatePrompt?: boolean;
    /** Charges left of created items with charges, by inventory id (absent: full). */
    charges?: Record<string, number>;
    /** Extra slots from Drain Magic Item; they disappear at the end of a Long Rest. */
    tempSlots?: TempSlot[];
  };
  notes: string;
}

/** The player's choices for one feat; what is asked depends on the feat (feat-effects.ts). */
export interface FeatChoice {
  /** Spellcasting ability, where the feat lets you choose INT, WIS or CHA. */
  ability?: Ability;
  /** Spell list picked for Magic Initiate: 'cleric' | 'druid' | 'wizard'. */
  list?: string;
  /** Spell ids picked as cantrips / as the leveled spell. */
  cantrips?: string[];
  spell?: string;
  /** Skill ids (Skilled, Purple Dragon Rook...), tools and languages picked. */
  skills?: string[];
  tools?: string[];
  languages?: string[];
  /** Damage type picked (Portal Jumper's Resistance). */
  resistance?: string;
}

export interface InventoryEntry {
  id: string;
  itemId: string | null;
  name: string;
  qty: number;
  equipped: boolean;
  /**
   * 'start': put there by the wizard's starting equipment (rebuilt when that choice changes).
   * 'replicate': created by the Artificer's Replicate Magic Item (planId says from which plan).
   */
  source?: 'start' | 'replicate';
  planId?: string;
  /**
   * Magic weapons, armor and ammunition (core/characters/magic-base.ts): the compendium item the
   * player chose as its base (Longsword for "Weapon, +1", Chain Mail for "Armor of Resistance").
   */
  baseId?: string;
  /** The +1, +2 or +3 chosen for the items that come in all three. */
  bonus?: number;
  /**
   * Upgrades of a weapon the character owns (Repeating Shot): the id of the inventory entry of
   * that weapon. If the entry is gone the upgrade has no effect (core/characters/enhancement.ts).
   */
  onEntryId?: string;
  /** Items that hold a spell of the player's choice (Spell Scroll...): the spell's id. */
  spellId?: string;
}

export interface Coins {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
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
    inventory: [],
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
/** Characters from before the inventory: their worn armor and shield become its first entries. */
function inventoryFromEquipped(equipped: Character['equipped'] | undefined): InventoryEntry[] {
  const out: InventoryEntry[] = [];
  if (equipped?.armorId)
    out.push({ id: equipped.armorId, itemId: equipped.armorId, name: '', qty: 1, equipped: true });
  if (equipped?.shield)
    out.push({ id: 'shield', itemId: 'shield', name: '', qty: 1, equipped: true });
  return out;
}

function normalizeState(base: Character['state'], raw: Character['state'] | undefined) {
  const state = { ...base, ...(raw ?? {}) };
  const summons = normalizeSummons(raw?.summons);
  if (summons) state.summons = summons;
  else delete state.summons;
  const replicated = normalizeReplicated(raw?.replicated);
  if (replicated.length) state.replicated = replicated;
  else delete state.replicated;
  if (raw?.replicatePrompt !== true) delete state.replicatePrompt;
  const charges = normalizeCharges(raw?.charges);
  if (Object.keys(charges).length) state.charges = charges;
  else delete state.charges;
  const tempSlots = normalizeTempSlots(raw?.tempSlots);
  if (tempSlots.length) state.tempSlots = tempSlots;
  else delete state.tempSlots;
  return state;
}

/** '' or anything that isn't a string becomes null: "no folder" has one spelling everywhere. */
function normalizeFolder(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

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
    folder: normalizeFolder(c.folder),
    choices: { ...base.choices, ...(c.choices ?? {}) },
    equipped: { ...base.equipped, ...(c.equipped ?? {}) },
    inventory: c.inventory ?? inventoryFromEquipped(c.equipped),
    state: normalizeState(base.state, c.state),
    classes: (c.classes ?? []).map((k) => ({
      ...k,
      hp: k.hp ?? [],
      subclassId: k.subclassId ?? null,
    })),
  };
}
