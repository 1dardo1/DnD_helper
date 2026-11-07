import { CombatMonster, applyDamage, applyHealing, isDefeated, setTemp } from '../dm/combat';
import type { Character } from '../models/character';
import { Monster, MonsterFeature } from '../models/compendium';

/**
 * The Artillerist's Eldritch Cannon (Artificer subclass feature, level 3): not a summoned
 * creature but an object the character creates with a Magic action. Kept in
 * character.state.cannon (absent while none is out). Rules (data/subclasses.json,
 * "artificer/artillerist-ua", feature "Eldritch Cannon" and "Explosive Cannon"):
 *
 * - Small or Tiny Object, AC 18, HP 5 × Artificer level, immune to Poison and Psychic.
 * - You choose its look (legs or wheels) and its size (Small or Tiny) when you create it.
 * - It disappears at 0 Hit Points or after 1 hour; you can dismiss it early as a Magic action.
 * - Only one at a time. Once you create one, you can't create another until you finish a Long
 *   Rest or expend a spell slot to create one. Casting Mending on it restores 2d6 Hit Points
 *   (it does not require creating a new one).
 * - Activate Cannon (Bonus Action, within 60 feet): Flamethrower, Force Ballista or Protector.
 * - Explosive Cannon (Artificer 9): its damage rolls gain 1d8, and you can detonate it as a
 *   Reaction when it drops to 0 Hit Points.
 *
 * Pure functions over the character; the sheet saves what they return.
 */

export type CannonAspect = 'legs' | 'wheels';
export type CannonSize = 'Small' | 'Tiny';

export interface CannonState {
  active: boolean;
  size: CannonSize;
  aspect: CannonAspect;
  /** Hit points lost (0 = full). */
  damage: number;
  temp: number;
}

export function emptyCannon(): CannonState {
  return { active: false, size: 'Small', aspect: 'legs', damage: 0, temp: 0 };
}

const nonNegative = (n: unknown) => (typeof n === 'number' && n > 0 ? Math.floor(n) : 0);

/** Accepts what any version saved; anything else (or none active) → undefined. */
export function normalizeCannon(raw: unknown): CannonState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<CannonState>;
  if (r.active !== true) return undefined;
  return {
    active: true,
    size: r.size === 'Tiny' ? 'Tiny' : 'Small',
    aspect: r.aspect === 'wheels' ? 'wheels' : 'legs',
    damage: nonNegative(r.damage),
    temp: nonNegative(r.temp),
  };
}

// -- who has it -----------------------------------------------------------------------------

/** Subclass id of the Artillerist (2024 UA). */
export const ARTILLERIST_ID = 'artificer/artillerist-ua';
/** Artificer level the Eldritch Cannon feature is gained at. */
export const CANNON_FEATURE_LEVEL = 3;
/** Artificer level Explosive Cannon (extra 1d8 damage, Detonate) is gained at. */
export const EXPLOSIVE_CANNON_LEVEL = 9;

export function artificerClassOf(
  ch: Pick<Character, 'classes'>,
): Character['classes'][number] | undefined {
  return ch.classes.find((k) => k.id === 'artificer');
}

/** Whether the character has the Eldritch Cannon feature (Artillerist, Artificer level 3+). */
export function hasEldritchCannon(ch: Pick<Character, 'classes'>): boolean {
  const art = artificerClassOf(ch);
  return !!art && art.subclassId === ARTILLERIST_ID && art.level >= CANNON_FEATURE_LEVEL;
}

export function explosiveCannon(ch: Pick<Character, 'classes'>): boolean {
  const art = artificerClassOf(ch);
  return !!art && art.level >= EXPLOSIVE_CANNON_LEVEL;
}

export function cannonHpMax(artificerLevel: number): number {
  return Math.max(1, 5 * artificerLevel);
}

// -- creating ---------------------------------------------------------------------------------

/** Key in state.resources: the free creation (once per Long Rest; a Long Rest clears it). */
export const CANNON_CREATE_KEY = 'artificer:eldritch-cannon';

/** Whether the free creation (Long Rest) hasn't been spent yet. */
export function hasFreeCreate(ch: Pick<Character, 'state'>): boolean {
  return !(ch.state.resources[CANNON_CREATE_KEY] > 0);
}

/** Spell slot levels (1-9) with at least one left, from the shared slot pool. */
export function availableSlotLevels(
  state: Pick<Character['state'], 'spentSlots'>,
  slots: readonly number[],
): number[] {
  const out: number[] = [];
  slots.forEach((max, i) => {
    if (max - Math.min(max, state.spentSlots[i] ?? 0) > 0) out.push(i + 1);
  });
  return out;
}

/** Where a new cannon's creation is paid from. */
export type CreateSource = { kind: 'free' } | { kind: 'slot'; level: number };

/** Whether a new cannon can be created right now: none out, and a free use or a slot to spend. */
export function canCreateCannon(ch: Pick<Character, 'state'>, slots: readonly number[]): boolean {
  if (ch.state.cannon?.active) return false;
  return hasFreeCreate(ch) || availableSlotLevels(ch.state, slots).length > 0;
}

function withCannon(
  state: Character['state'],
  cannon: CannonState | undefined,
): Character['state'] {
  const { cannon: _old, ...rest } = state;
  return cannon?.active ? { ...rest, cannon } : rest;
}

/**
 * Creates a new cannon at full Hit Points. null when one is already out, or the chosen source
 * (the free use, or a slot of that level) isn't available.
 */
export function createCannon(
  ch: Character,
  size: CannonSize,
  aspect: CannonAspect,
  source: CreateSource,
  slots: readonly number[],
): Character | null {
  if (ch.state.cannon?.active) return null;
  let state = ch.state;
  if (source.kind === 'free') {
    if (!hasFreeCreate(ch)) return null;
    state = { ...state, resources: { ...state.resources, [CANNON_CREATE_KEY]: 1 } };
  } else {
    const level = source.level;
    const cap = slots[level - 1] ?? 0;
    const spent = Math.min(cap, state.spentSlots[level - 1] ?? 0);
    if (level < 1 || cap - spent <= 0) return null;
    const spentSlots = [...state.spentSlots];
    while (spentSlots.length < 9) spentSlots.push(0);
    spentSlots[level - 1] = spent + 1;
    state = { ...state, spentSlots };
  }
  const cannon: CannonState = { active: true, size, aspect, damage: 0, temp: 0 };
  return { ...ch, state: withCannon(state, cannon) };
}

// -- healing, dismissing, damage ---------------------------------------------------------------

/** Casting Mending on the cannon restores 2d6 Hit Points (average 7); the text's own wording. */
export const MENDING_HEAL_DICE = '2d6';
export const MENDING_HEAL_AVERAGE = 7;

/** Restores Hit Points to a cannon that is out (e.g. casting Mending on it); clamped to its max. */
export function healCannon(ch: Character, amount: number): Character {
  const cannon = ch.state.cannon;
  if (!cannon?.active || !(amount > 0)) return ch;
  const damage = Math.max(0, cannon.damage - amount);
  return { ...ch, state: withCannon(ch.state, { ...cannon, damage }) };
}

/** Dismissing it early (a Magic action per the feature's text). */
export function dismissCannon(ch: Character): Character {
  if (!ch.state.cannon?.active) return ch;
  return { ...ch, state: withCannon(ch.state, undefined) };
}

/** The cannon as the combat card shows it (same shape the combat helper uses for monsters). */
export function toCannonInstance(cannon: CannonState, hpMax: number): CombatMonster {
  return {
    id: 'artificer:eldritch-cannon',
    monsterId: 'eldritch-cannon',
    name: 'Eldritch Cannon',
    number: 1,
    ac: 18,
    hpMax,
    hp: Math.max(0, hpMax - cannon.damage),
    temp: cannon.temp,
    initBonus: 0,
    dex: 10,
    initiative: null,
    used: {},
  };
}

/** Applies a damage/heal/temp-HP change made on the card; 0 Hit Points makes it disappear. */
export function updateCannon(
  ch: Character,
  artificerLevel: number,
  change: (m: CombatMonster) => CombatMonster,
): Character {
  const cannon = ch.state.cannon;
  if (!cannon?.active) return ch;
  const hpMax = cannonHpMax(artificerLevel);
  const next = change(toCannonInstance(cannon, hpMax));
  if (isDefeated(next)) return { ...ch, state: withCannon(ch.state, undefined) };
  return {
    ...ch,
    state: withCannon(ch.state, {
      ...cannon,
      damage: Math.max(0, next.hpMax - next.hp),
      temp: next.temp,
    }),
  };
}

export const applyCannonDamage = applyDamage;
export const applyCannonHealing = applyHealing;
export const setCannonTemp = setTemp;

// -- the stat block -----------------------------------------------------------------------------

const avg = (n: number, sides: number) => Math.floor((n * (sides + 1)) / 2);

/** "9 (2d8)"; `extra` is the die added by Explosive Cannon. */
function dice(n: number, sides: number, extraDie: boolean): string {
  const dieCount = n + (extraDie ? 1 : 0);
  return `${avg(dieCount, sides)} (${dieCount}d${sides})`;
}

export interface CannonOptionText {
  key: 'flamethrower' | 'force-ballista' | 'protector';
  name: string;
  description: string;
}

/** The known "Activate Cannon" options, with the caster's spell save DC and the Int modifier. */
export function cannonOptions(
  spellDc: number,
  intMod: number,
  explosive: boolean,
): CannonOptionText[] {
  return [
    {
      key: 'flamethrower',
      name: 'Flamethrower',
      description:
        `The cannon exhales fire in a 15-foot Cone. Each creature in that area makes a ` +
        `Dexterity Saving Throw: DC ${spellDc}. Failure: ${dice(2, 8, explosive)} Fire damage. ` +
        `Success: Half damage. Flammable objects in the Cone that aren't being worn or carried ` +
        `start burning.`,
    },
    {
      key: 'force-ballista',
      name: 'Force Ballista',
      description:
        `Ranged Spell Attack: originating from the cannon, at one creature or object within ` +
        `120 feet of it. Hit: ${dice(2, 8, explosive)} Force damage, and if the target is a ` +
        `creature, it is pushed up to 5 feet away from the cannon.`,
    },
    {
      key: 'protector',
      name: 'Protector',
      description:
        `The cannon emits a burst of positive energy that grants itself and each creature of ` +
        `your choice within 10 feet of it a number of Temporary Hit Points equal to 1d8 + ` +
        `${intMod} (minimum of 1).`,
    },
  ];
}

const detonateText = (spellDc: number, explosive: boolean): MonsterFeature => ({
  name: 'Detonate',
  description:
    `When the cannon is reduced to 0 Hit Points, you can take a Reaction to command it to ` +
    `detonate if you are within 60 feet of it, destroying it. Each creature within 20 feet of ` +
    `it makes a Dexterity Saving Throw: DC ${spellDc}. Failure: ${dice(3, 10, explosive)} Force ` +
    `damage. Success: Half damage.`,
});

/**
 * The synthetic Monster the combat card and the stat block show for the cannon: AC, HP, the
 * immunities and the known "Activate Cannon" options as its actions. `spellDc` and `intMod` are
 * the Artificer's; both come from the caster's sheet.
 */
export function cannonMonster(
  cannon: Pick<CannonState, 'size' | 'aspect'>,
  artificerLevel: number,
  spellDc: number,
  intMod: number,
): Monster {
  const explosive = artificerLevel >= EXPLOSIVE_CANNON_LEVEL;
  const traits: MonsterFeature[] = [
    {
      name: 'Activate Cannon',
      description:
        `Requires you to be within 60 feet of the cannon. As a Bonus Action, you order the ` +
        `cannon to use the Flamethrower, Force Ballista or Protector option below; you can ` +
        `direct the cannon to move up to 15 feet before or after that option.`,
    },
  ];
  const actions: MonsterFeature[] = cannonOptions(spellDc, intMod, explosive).map((o) => ({
    name: o.name,
    description: o.description,
  }));
  const reactions: MonsterFeature[] = explosive ? [detonateText(spellDc, explosive)] : [];
  return {
    id: 'eldritch-cannon',
    type: 'monster',
    name: 'Eldritch Cannon',
    edition: '2024',
    source: 'Artificer UA (17.12.2024)',
    description: '',
    url: '',
    category: 'monster',
    size: [cannon.size],
    creatureType: 'construct',
    tags: [],
    alignment: 'unaligned',
    ac: 18,
    armor: [],
    hp: cannonHpMax(artificerLevel),
    hitDice: `5 × ${artificerLevel}`,
    speed: { walk: 0 },
    initiative: null,
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    saves: {},
    skills: {},
    vulnerabilities: [],
    resistances: [],
    immunities: ['poison', 'psychic'],
    conditionImmunities: [],
    senses: {},
    passivePerception: 10,
    languages: '',
    cr: 0,
    xp: 0,
    xpInLair: null,
    proficiencyBonus: 0,
    gear: [],
    traits,
    actions,
    bonusActions: [],
    reactions,
    legendaryActions: [],
    legendaryActionUses: null,
    legendary: false,
    spellcasting: false,
  };
}
