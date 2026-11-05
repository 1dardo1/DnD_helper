import { Ability, Item } from '../models/compendium';
import { Sheet } from './sheet';

/** One line of the attacks table. */
export interface Attack {
  /** Inventory entry id ('' for the unarmed strike). */
  entryId: string;
  /** English name of the weapon (shown with the data texts). */
  name: string;
  ability: Ability;
  /** Attack roll bonus: ability modifier + proficiency bonus when proficient. */
  bonus: number;
  proficient: boolean;
  /** "1d8+3", plus the damage type (English, for the glossary). */
  damage: string;
  damageType: string;
  /** Damage when wielded with two hands (Versatile), if any. */
  versatile: string | null;
  /** Reach in feet for melee, "normal/long" in feet for ranged and thrown. */
  reach: number | null;
  range: string | null;
  /** Properties without their parenthesised details ("Finesse", "Thrown"...). */
  properties: string[];
  mastery: string | null;
  equipped: boolean;
  /** English name of the weapon a magic weapon is based on ("Longsword" for a Vorpal Sword). */
  base: string | null;
  /** Magic bonus already added to the attack roll and the damage (0 for plain weapons). */
  magic: number;
}

/** What the attacks table needs of an inventory entry. */
export interface WeaponEntry {
  id: string;
  equipped: boolean;
  /** The weapon whose damage, properties and mastery it has: the base of a magic weapon. */
  item: Item;
  /** A magic weapon (Weapon +1, Vorpal Sword...): the item itself and its bonus. */
  magic?: { item: Item; bonus: number };
}

const prop = (item: Item, name: string) =>
  item.weapon?.properties.find((p) => p.toLowerCase().startsWith(name.toLowerCase())) ?? null;

/**
 * Proficiency with a weapon from the sheet's weapon proficiencies: "Simple weapons", "Martial
 * weapons", "Martial weapons that have the Finesse or Light property", or the weapon's name.
 */
export function proficientWith(weapons: string[], item: Item): boolean {
  const kind = item.weapon?.kind;
  const name = item.name.toLowerCase();
  return weapons.some((w) => {
    const t = w.toLowerCase();
    if (t.includes(name)) return true;
    if (kind === 'simple' && /simple weapons/.test(t)) return true;
    if (kind !== 'martial' || !/martial weapons/.test(t)) return false;
    const needs = [...t.matchAll(/\b(finesse|light)\b/g)].map((m) => m[1]);
    return needs.length === 0 || needs.some((p) => !!prop(item, p));
  });
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : '');

/**
 * Attacks with the weapons of the inventory, plus the unarmed strike. Melee weapons use STR,
 * ranged ones DEX, and Finesse weapons the higher of the two.
 */
export function attacksFor(sheet: Sheet, weapons: WeaponEntry[]): Attack[] {
  const mod = (a: Ability) => sheet.abilities[a].modifier;
  const pb = sheet.proficiencyBonus;
  const out: Attack[] = [];
  for (const { id, equipped, item, magic } of weapons) {
    const w = item.weapon;
    if (!w) continue;
    const ability: Ability = prop(item, 'finesse')
      ? mod('DEX') > mod('STR')
        ? 'DEX'
        : 'STR'
      : w.ranged
        ? 'DEX'
        : 'STR';
    const proficient = proficientWith(sheet.proficiencies.weapons, item);
    const m = mod(ability);
    const plus = magic?.bonus ?? 0;
    const dice = w.damage[0]?.dice ?? '1';
    const versatileDie = /\(([^)]+)\)/.exec(prop(item, 'versatile') ?? '')?.[1] ?? null;
    const thrown = /(\d+\/\d+)/.exec(prop(item, 'thrown') ?? '')?.[1] ?? null;
    out.push({
      entryId: id,
      name: magic ? magic.item.name : item.name,
      ability,
      bonus: m + plus + (proficient ? pb : 0),
      proficient,
      damage: `${dice}${signed(m + plus)}`,
      damageType: w.damage[0]?.type ?? '',
      versatile: versatileDie ? `${versatileDie}${signed(m + plus)}` : null,
      reach: w.ranged ? null : prop(item, 'reach') ? 10 : 5,
      range: w.ranged ? w.range : thrown,
      properties: w.properties.map((p) => p.replace(/\s*\(.*$/, '')),
      mastery: w.mastery,
      equipped,
      base: magic ? item.name : null,
      magic: plus,
    });
  }
  // equipped weapons first
  out.sort((a, b) => Number(b.equipped) - Number(a.equipped));
  const str = mod('STR');
  out.push({
    entryId: '',
    name: 'Unarmed Strike',
    ability: 'STR',
    bonus: str + pb,
    proficient: true,
    damage: `${Math.max(0, 1 + str)}`,
    damageType: 'bludgeoning',
    versatile: null,
    reach: 5,
    range: null,
    properties: [],
    mastery: null,
    equipped: true,
    base: null,
    magic: 0,
  });
  return out;
}
