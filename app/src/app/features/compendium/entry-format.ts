import { term } from '../../core/i18n/glossary';
import { AbilityGroup, Item, Spellcasting } from '../../core/models/compendium';

/** Words inside the parentheses of weapon properties: "Ammunition (Range 80/320; Arrow)". */
const PROPERTY_DETAIL_ES: [RegExp, string][] = [
  [/\brange\b/gi, 'distancia'],
  [/\b(\d+) shots\b/gi, '$1 disparos'],
  [/\bunless mounted\b/gi, 'salvo si vas montado'],
  [/\bEnergy Cell\b/gi, 'célula de energía'],
  [/\bArrow\b/gi, 'flecha'],
  [/\bBolt\b/gi, 'virote'],
  [/\bBullet\b/gi, 'bala'],
  [/\bNeedle\b/gi, 'aguja'],
];

/** "Ammunition (Range 80/320; Arrow)" → "Munición (distancia 80/320; flecha)" in Spanish. */
export function weaponProperty(lang: string, property: string): string {
  const m = /^([^(]+?)\s*(?:\((.*)\))?$/.exec(property.trim());
  if (!m) return property;
  const name = term(lang, 'property', m[1]);
  let detail = m[2];
  if (detail && lang === 'es') {
    detail = PROPERTY_DETAIL_ES.reduce((s, [rx, to]) => s.replace(rx, to), detail);
  }
  return detail ? `${name} (${detail})` : name;
}

/** How Dexterity counts for an armor's AC: all of it, up to a cap, not at all, or n/a (shields). */
export function armorDex(armor: NonNullable<Item['armor']>): 'full' | 'cap' | 'none' | null {
  if (armor.kind === 'shield') return null;
  if (armor.dexCap === null) return 'full';
  return armor.dexCap > 0 ? 'cap' : 'none';
}

/** Spell slots at a class level as "4 / 3 / 2" (1st, 2nd, 3rd level...); "—" without slots. */
export function slotsText(sc: Spellcasting, level: number): string {
  const row = sc.slotsByLevel[level - 1] ?? [];
  let last = row.length - 1;
  while (last >= 0 && !row[last]) last--;
  return last < 0 ? '—' : row.slice(0, last + 1).join(' / ');
}

/** "INT 13" groups: "STR or DEX 13 and WIS 13" with the words given. */
export function prerequisitesText(
  groups: AbilityGroup[],
  abbr: (ability: string) => string,
  or: string,
  and: string,
): string {
  return groups.map((g) => `${g.anyOf.map(abbr).join(` ${or} `)} ${g.min}`).join(` ${and} `);
}
