import { Ability } from '../models/compendium';

/**
 * Natural weapons that a species trait gives (Tabaxi claws, Lizardfolk bite, Minotaur horns,
 * Dhampir's Vampiric Bite...). They are Unarmed Strikes whose damage the trait states: "the strike
 * deals 1d6 + your Strength modifier slashing damage, instead of the bludgeoning damage normal for
 * an unarmed strike" / "you deal piercing damage equal to 1d4 + your Strength modifier". Read from
 * the text; nothing is assumed.
 */
export interface NaturalWeapon {
  /** English name of the trait ("Cat's Claws", "Bite"). */
  name: string;
  dice: string;
  /** Ability added to the damage. */
  ability: Ability;
  /** Damage type, lower case ("slashing"). */
  type: string;
}

const ABILITY: Record<string, Ability> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

const TYPES =
  '(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)';
const PLUS =
  '\\s*(?:\\+|plus)\\s*your (strength|dexterity|constitution|intelligence|wisdom|charisma) modifier';

// "the strike deals 1d6 + your Strength modifier slashing damage"
const A = new RegExp(`\\bdeals? (\\d+d\\d+)${PLUS} ${TYPES} damage`, 'i');
// "you deal bludgeoning damage equal to 1d4 + your Strength modifier"
const B = new RegExp(`${TYPES} damage equal to (\\d+d\\d+)${PLUS}`, 'i');

// "unarmed strikes, which deal 1d4 slashing damage on a hit": no modifier named, Strength
const C = new RegExp(`which deal (\\d+d\\d+) ${TYPES} damage`, 'i');

export function naturalWeaponOf(name: string, description: string): NaturalWeapon | null {
  const text = (description ?? '').replace(/\*+/g, '').replace(/\s+/g, ' ');
  // only a trait about unarmed strikes (not a damage trait that merely mentions dice)
  if (!/unarmed strike|natural weapon/i.test(text)) return null;
  // one option among several the player chooses (Shifter's Longtooth): not for everyone
  if (/\(choose when you select this species\)|choose one of the following/i.test(text))
    return null;
  const a = A.exec(text);
  if (a)
    return { name, dice: a[1], ability: ABILITY[a[2].toLowerCase()], type: a[3].toLowerCase() };
  const b = B.exec(text);
  if (b)
    return { name, dice: b[2], ability: ABILITY[b[3].toLowerCase()], type: b[1].toLowerCase() };
  const c = C.exec(text);
  if (c) return { name, dice: c[1], ability: 'STR', type: c[2].toLowerCase() };
  return null;
}

/** "Your Unarmed Strikes deal Slashing damage instead of Bludgeoning damage" (Lupin). */
export function unarmedTypeOf(description: string): string | null {
  const m = new RegExp(
    `Unarmed Strikes deal ${TYPES} damage instead of (?:bludgeoning|${TYPES}) damage`,
    'i',
  ).exec((description ?? '').replace(/\s+/g, ' '));
  return m ? m[1].toLowerCase() : null;
}
