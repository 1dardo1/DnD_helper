import { cannonMonster } from '../artificer/cannon';
import { proficiencyBonus } from '../rules/tables';
import { Ability, Monster } from '../models/compendium';
import { SummonCatalog, SummonOption, SummonSource, resolveOption } from '../summons/catalog';
import { SummonContext } from '../summons/resolve';
import { CombatMonster, CombatState, MonsterInfo, addMonsters, setPlayerCount } from './combat';
import { CombatEncounter } from './combat-encounter';

/** What the combat helper needs of a compendium monster. */
export function monsterInfo(m: Monster): MonsterInfo {
  return {
    id: m.id,
    name: m.name,
    ac: m.ac,
    hp: m.hp,
    initiative: m.initiative,
    dex: m.abilities.DEX,
  };
}

/**
 * Adds an encounter's monsters and one player per party member (named after the saved character
 * or the name typed in the encounter; unnamed otherwise). Added to a combat in progress, the
 * players already there are kept and only the missing ones are added.
 */
export function addEncounter(
  state: CombatState,
  encounter: CombatEncounter,
  monsters: Map<string, Monster>,
  characterNames: Map<string, string>,
): CombatState {
  const before = state.players.length;
  let s = setPlayerCount(state, Math.max(before, encounter.party.length));
  s = {
    ...s,
    players: s.players.map((p, i) => {
      if (i < before) return p;
      const member = encounter.party[i];
      const name =
        (member?.characterId && characterNames.get(member.characterId)) || member?.name || '';
      return { ...p, name: name.trim() };
    }),
  };
  for (const group of encounter.monsters) {
    const m = monsters.get(group.monsterId);
    if (m) s = addMonsters(s, monsterInfo(m), group.count);
  }
  return { ...s, encounterId: encounter.id, encounterName: encounter.name };
}

// -- allies: summoned creatures and the Eldritch Cannon --------------------------------------

/** The Eldritch Cannon's stat block id (core/artificer/cannon.ts). */
export const CANNON_MONSTER_ID = 'eldritch-cannon';

/**
 * The caster's numbers, typed by the DM (no character sheet here): the caster's level (in its
 * spellcasting class) and its spellcasting modifier.
 */
export interface CasterNumbers {
  level: number;
  spellMod: number;
}

/**
 * The context a summon's stat block is worked out with, from the caster's numbers. Proficiency
 * Bonus and save DC follow the rules (8 + PB + modifier); every class level is taken as the
 * caster's level, and the other ability modifiers as 0 (no sheet to read them from).
 */
export function casterContext(slotLevel: number, caster: CasterNumbers): SummonContext {
  const pb = proficiencyBonus(caster.level);
  const mods = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 } as Record<Ability, number>;
  return {
    slotLevel,
    pb,
    spellAttack: pb + caster.spellMod,
    spellDc: 8 + pb + caster.spellMod,
    mods,
    spellMod: caster.spellMod,
    classLevels: new Proxy({}, { get: () => caster.level }) as Record<string, number>,
    totalLevel: caster.level,
  };
}

/**
 * The creature of a summon option at a slot level, as the catalog works it out for the caster
 * (the same resolution the summons page uses). null when the option has no creature.
 */
export function summonMonster(
  source: SummonSource,
  option: SummonOption,
  catalog: SummonCatalog,
  slotLevel: number,
  caster: CasterNumbers,
  type?: string,
): Monster | null {
  const ctx = casterContext(slotLevel, caster);
  return resolveOption(source, option, ctx, catalog, type)?.monster ?? null;
}

/**
 * The Eldritch Cannon at an Artificer level (cannon.ts: AC 18, 5 × level Hit Points, and its
 * Activate Cannon options). The spell save DC is 8 + PB + Intelligence modifier, as for any
 * Artificer. Size Small and legs: they don't change its numbers.
 */
export function cannonOf(artificerLevel: number, intMod: number): Monster {
  const dc = 8 + proficiencyBonus(artificerLevel) + intMod;
  return cannonMonster({ size: 'Small', aspect: 'legs' }, artificerLevel, dc, intMod);
}

/** Whether a combatant is the Eldritch Cannon. */
export const isCannon = (m: CombatMonster) => m.monsterId === CANNON_MONSTER_ID;
