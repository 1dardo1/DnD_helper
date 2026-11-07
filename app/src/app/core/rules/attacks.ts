import { Ability, Item } from '../models/compendium';
import { Sheet } from './sheet';

/** One line of the attacks table. */
export interface Attack {
  /** Inventory entry id ('' for a synthetic row: the unarmed strike or a Psychic Blade). */
  entryId: string;
  /** English name of the weapon (shown with the data texts). */
  name: string;
  /** UI text key for the name of a synthetic row (entryId ''); null for an inventory weapon. */
  nameKey: string | null;
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
      nameKey: null,
      ability,
      bonus: m + plus + styleAttack + (proficient ? pb : 0),
      proficient,
      damage: `${dice}${signed(m + plus + dueling)}`,
      damageType: w.damage[0]?.type ?? '',
      versatile: versatileDie ? `${versatileDie}${signed(m + plus + dueling)}` : null,
      reach: w.ranged ? null : prop(item, 'reach') ? 10 : 5,
      range: w.ranged ? w.range : thrown,
      properties: w.properties.map((p) => p.replace(/\s*\(.*$/, '')),
      // only the kinds of weapon the player chose for Weapon Mastery show its mastery property
      mastery: combat?.masteryChosen?.includes(item.id) ? w.mastery : null,
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
    nameKey: 'sheet.unarmedStrike',
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
  out.push(...psychicBladesFor(sheet, weapons));
  return out;
}

/**
 * Soulknife Rogue 3+ (Psychic Blades): a Simple Melee weapon manifested on the Attack action or
 * an Opportunity Attack, 1d6 Psychic + the attack's ability modifier, Finesse and Thrown (range
 * 60/120 ft), Vex mastery (doesn't count against the mastery kinds known). It isn't inventory: it
 * manifests in a free hand and vanishes on a hit or a miss.
 *
 * After attacking with it, a second blade can be thrown or swung as a Bonus Action (1d4 instead
 * of 1d6) if the other hand is free. Any equipped Two-Handed weapon makes that calculable (no
 * free hand left); a shield or dual-wielding another one-handed weapon cannot be checked here, so
 * the row carries a note instead of being hidden.
 */
function psychicBladesFor(sheet: Sheet, weapons: WeaponEntry[]): Attack[] {
  const combat = sheet.combat;
  if (!combat?.psychicBlades) return [];
  const mod = (a: Ability) => sheet.abilities[a].modifier;
  const pb = sheet.proficiencyBonus;
  // Finesse: the higher of STR and DEX, as for any other Finesse weapon.
  const ability: Ability = mod('DEX') > mod('STR') ? 'DEX' : 'STR';
  const m = mod(ability);
  const bonus = m + pb; // always proficient: it's a feature, not a weapon the character picked up
  const homingNote: Attack['notes'] = combat.soulBlades ? [{ id: 'soulBladesHoming' }] : [];
  const main: Attack = {
    entryId: '',
    name: 'Psychic Blade',
    nameKey: 'sheet.psychicBlade',
    ability,
    bonus,
    proficient: true,
    damage: `1d6${signed(m)}`,
    damageType: 'psychic',
    versatile: null,
    reach: 5,
    range: '60/120',
    properties: ['Finesse', 'Thrown'],
    mastery: 'Vex',
    equipped: true,
    base: null,
    magic: 0,
    upgrades: [],
    notes: [{ id: 'psychicBlade' }, ...homingNote],
  };
  // a Two-Handed weapon equipped takes both hands: no free hand for the bonus-action blade
  const twoHandedEquipped = weapons.some(
    ({ equipped, item }) => equipped && !!prop(item, 'two-handed'),
  );
  if (twoHandedEquipped) return [main];
  const bonusAction: Attack = {
    ...main,
    name: 'Psychic Blade (bonus action)',
    nameKey: 'sheet.psychicBladeBonus',
    damage: `1d4${signed(m)}`,
    notes: [{ id: 'psychicBlade' }, { id: 'psychicBladeBonus' }, ...homingNote],
  };
  return [main, bonusAction];
}
