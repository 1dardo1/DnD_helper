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
  /** Upgrades of the weapon from other magic items (Repeating Shot). */
  upgrades: AttackUpgrade[];
  /** Effects the line already includes or that go with it (fighting styles...): UI text id and parameters. */
  notes: { id: string; params?: Record<string, string | number> }[];
}

/** What an upgrade does to one attack line. */
export interface AttackUpgrade {
  /** English name of the upgrade. */
  name: string;
  plus: number;
  /** Its bonus is already in the attack and damage of the line (else only for ranged use). */
  applied: boolean;
  /** The weapon has Loading and the upgrade ignores it. */
  ignoresLoading: boolean;
  freeAmmo: boolean;
}

/** What the attacks table needs of an inventory entry. */
export interface WeaponEntry {
  id: string;
  equipped: boolean;
  /** The weapon whose damage, properties and mastery it has: the base of a magic weapon. */
  item: Item;
  /** A magic weapon (Weapon +1, Vorpal Sword...): the item itself and its bonus. */
  magic?: { item: Item; bonus: number };
  /** Upgrades put on this weapon (core/characters/enhancement.ts). */
  upgrades?: {
    item: Item;
    bonus: number;
    rangedOnly: boolean;
    ignoresLoading: boolean;
    freeAmmo: boolean;
  }[];
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

const faces = (dice: string) => Number(/d(\d+)/.exec(dice)?.[1] ?? 1);

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : '');

/**
 * Attacks with the weapons of the inventory, plus the unarmed strike. Melee weapons use STR,
 * ranged ones DEX, and Finesse weapons the higher of the two.
 */
export function attacksFor(sheet: Sheet, weapons: WeaponEntry[]): Attack[] {
  const mod = (a: Ability) => sheet.abilities[a].modifier;
  const pb = sheet.proficiencyBonus;
  const out: Attack[] = [];
  for (const { id, equipped, item, magic, upgrades = [] } of weapons) {
    const w = item.weapon;
    if (!w) continue;
    const combat = sheet.combat;
    const notes: Attack['notes'] = [];
    // Martial Arts: Monk weapons are Simple Melee weapons without Two-Handed or Heavy
    const monkWeapon =
      !!combat?.martialArts &&
      !w.ranged &&
      (w.kind === 'simple' || item.name === 'Shortsword') &&
      !prop(item, 'two-handed') &&
      !prop(item, 'heavy');
    const ability: Ability =
      prop(item, 'finesse') || monkWeapon
        ? mod('DEX') > mod('STR')
          ? 'DEX'
          : 'STR'
        : w.ranged
          ? 'DEX'
          : 'STR';
    const proficient = proficientWith(sheet.proficiencies.weapons, item);
    const m = mod(ability);
    // an upgrade for ranged attacks does not reach the melee use of a Thrown weapon
    const ups: AttackUpgrade[] = upgrades.map((u) => ({
      name: u.item.name,
      plus: u.bonus,
      applied: !u.rangedOnly || !!w.ranged,
      ignoresLoading: u.ignoresLoading && !!prop(item, 'loading'),
      freeAmmo: u.freeAmmo,
    }));
    const plus = (magic?.bonus ?? 0) + ups.reduce((n, u) => n + (u.applied ? u.plus : 0), 0);
    // Archery: +2 to attack rolls with Ranged weapons; Dueling: +2 damage with one hand
    const styleAttack = w.ranged ? (combat?.rangedAttack ?? 0) : 0;
    if (styleAttack) notes.push({ id: 'archery', params: { n: styleAttack } });
    const oneHanded = !w.ranged && !prop(item, 'two-handed');
    const dueling = oneHanded ? (combat?.duelingDamage ?? 0) : 0;
    if (dueling) notes.push({ id: 'dueling', params: { n: dueling } });
    const thrownStyle = prop(item, 'thrown') ? (combat?.thrownDamage ?? 0) : 0;
    if (thrownStyle) notes.push({ id: 'thrown', params: { n: thrownStyle } });
    let dice = w.damage[0]?.dice ?? '1';
    if (monkWeapon && combat?.martialArts && faces(combat.martialArts) > faces(dice)) {
      dice = combat.martialArts;
      notes.push({ id: 'martial', params: { die: dice } });
    }
    const versatileDie = /\(([^)]+)\)/.exec(prop(item, 'versatile') ?? '')?.[1] ?? null;
    const thrown = /(\d+\/\d+)/.exec(prop(item, 'thrown') ?? '')?.[1] ?? null;
    out.push({
      entryId: id,
      name: magic ? magic.item.name : item.name,
      ability,
      bonus: m + plus + styleAttack + (proficient ? pb : 0),
      proficient,
      damage: `${dice}${signed(m + plus + dueling)}`,
      damageType: w.damage[0]?.type ?? '',
      versatile: versatileDie ? `${versatileDie}${signed(m + plus + dueling)}` : null,
      reach: w.ranged ? null : prop(item, 'reach') ? 10 : 5,
      range: w.ranged ? w.range : thrown,
      properties: w.properties.map((p) => p.replace(/\s*\(.*$/, '')),
      // only the classes with Weapon Mastery use it (the choice of kinds is the player's)
      mastery: combat && sheet.classes.length && combat.masterySlots === 0 ? null : w.mastery,
      equipped,
      base: magic ? item.name : null,
      magic: plus,
      upgrades: ups,
      notes,
    });
  }
  // equipped weapons first
  out.sort((a, b) => Number(b.equipped) - Number(a.equipped));
  const combat = sheet.combat;
  const unarmedAbility: Ability = combat?.martialArts && mod('DEX') > mod('STR') ? 'DEX' : 'STR';
  const str = mod(unarmedAbility);
  const notes: Attack['notes'] = [];
  // Martial Arts die, or Unarmed Fighting (1d6, 1d8 with no weapon or shield), or 1 + STR
  let unarmedDie: string | null = null;
  if (combat?.martialArts) {
    unarmedDie = combat.martialArts;
    notes.push({ id: 'martial', params: { die: unarmedDie } });
  }
  if (combat?.unarmedFighting && faces('1d6') > faces(unarmedDie ?? '1d1')) {
    unarmedDie = '1d6';
    notes.push({ id: 'unarmedFighting' });
  }
  out.push({
    entryId: '',
    name: 'Unarmed Strike',
    ability: unarmedAbility,
    bonus: str + pb,
    proficient: true,
    damage: unarmedDie ? `${unarmedDie}${signed(str)}` : `${Math.max(0, 1 + str)}`,
    damageType: 'bludgeoning',
    versatile: null,
    reach: 5,
    range: null,
    properties: [],
    mastery: null,
    equipped: true,
    base: null,
    magic: 0,
    upgrades: [],
    notes,
  });
  return out;
}
