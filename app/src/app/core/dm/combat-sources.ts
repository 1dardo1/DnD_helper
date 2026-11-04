import { Character } from '../models/character';
import { Monster } from '../models/compendium';
import { RulesData, computeSheet } from '../rules/engine';
import { CombatState, CombatantInput, MonsterInfo, addCombatant, addMonsters } from './combat';
import { CombatEncounter } from './combat-encounter';

/** What the tracker needs of a compendium monster. */
export function monsterInfo(m: Monster): MonsterInfo {
  return {
    id: m.id,
    name: m.name,
    ac: m.ac,
    hp: m.hp,
    hitDice: m.hitDice,
    initiative: m.initiative,
    dex: m.abilities.DEX,
    xp: m.xp,
  };
}

/** A saved character as a combatant: AC, hit points and initiative from its sheet. */
export function characterCombatant(
  ch: Character,
  data: RulesData,
): (CombatantInput & { characterId: string; ac: number; hpMax: number; hp: number }) | null {
  try {
    const sheet = computeSheet(ch, data);
    return {
      kind: 'character',
      name: ch.name,
      characterId: ch.id,
      ac: sheet.armorClass.value,
      hpMax: sheet.hitPoints.max,
      hp: sheet.hitPoints.current,
      temp: sheet.hitPoints.temp,
      initBonus: sheet.initiative,
      dex: sheet.abilities.DEX.score,
    };
  } catch {
    return null;
  }
}

/**
 * Adds an encounter's monsters and party: characters with a sheet on this device come with their
 * numbers; the rest as custom entries with their name (or "label 1, 2...").
 */
export function addEncounter(
  state: CombatState,
  encounter: CombatEncounter,
  monsters: Map<string, Monster>,
  characters: Map<string, CombatantInput>,
  playerLabel: string,
): CombatState {
  let s = state;
  encounter.party.forEach((p, i) => {
    const known = p.characterId ? characters.get(p.characterId) : undefined;
    s = addCombatant(
      s,
      known ?? { kind: 'custom', name: p.name?.trim() || `${playerLabel} ${i + 1}` },
    );
  });
  for (const group of encounter.monsters) {
    const m = monsters.get(group.monsterId);
    if (m) s = addMonsters(s, monsterInfo(m), group.count);
  }
  return { ...s, encounterId: encounter.id, encounterName: encounter.name };
}
