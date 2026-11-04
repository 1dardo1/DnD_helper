import { Monster } from '../models/compendium';
import { CombatState, MonsterInfo, addMonsters, setPlayerCount } from './combat';
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
