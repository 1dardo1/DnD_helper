import { playResources } from '../play/play-state';
import { Subclass } from '../models/compendium';
import { attacksFor } from './attacks';
import { featRules } from './feat-effects';
import { DEFS, writtenDc } from './feature-stats';
import { REAL, REAL_SUBCLASSES, sheetOf } from './real-data.testing';
import { traitRules } from './trait-effects';

/**
 * Guard against a class or subclass feature with something to calculate or spend that the sheet
 * ignores (what happened to the Soulknife's Psychic Blades). Every feature of the 2024 Player's
 * Handbook classes and subclasses whose text has dice, a DC, a formula or limited uses must be
 * SUPPORTED (a counter, a number, an attack line, spells, a rule the engine applies) or listed in
 * TEXT_OK below with the reason it is fine as text. A new feature in the data fails here until
 * someone looks at it.
 */
const NEEDS =
  /\d+d\d+|Martial Arts die|Bardic Inspiration die|Superiority Die|Psionic Energy Die|number of times equal|can't (?:use|do so|cast|take)[^.]{0,60}again until|equal to (?:your|twice|three times|five times|half|two times)|\bDC\b|spell save DC|plus your .{0,20}(?:modifier|level)/i;

const TEXT_OK: Record<string, string> = {
  'barbarian/path-of-the-wild-heart:Power of the Wilds': 'option chosen at each Rage',
  'bard/college-of-dance:Tandem Footwork': 'uses the Bardic die shown on the counter',
  'bard/college-of-glamour:Mantle of Inspiration': 'uses the Bardic die shown on the counter',
  'bard/college-of-lore:Cutting Words': 'uses the Bardic die shown on the counter',
  'bard/college-of-lore:Peerless Skill': 'uses the Bardic die shown on the counter',
  'bard/college-of-valor:Combat Inspiration': 'uses the Bardic die shown on the counter',
  'cleric/life-domain:Supreme Healing': 'maximises dice: nothing to calculate',
  'cleric:Greater Divine Intervention': 'rest roll of 2d4 Long Rests: nothing to calculate',
  'cleric/trickery-domain:Improved Duplicity': 'no number of the character',
  'druid/circle-of-the-sea:Oceanic Gift': 'Wrath of the Sea on another creature',
  'fighter/battle-master:Improved Combat Superiority': 'die size shown on Superiority Dice',
  'fighter/battle-master:Relentless': 'fixed 1d8',
  'fighter/battle-master:Ultimate Combat Superiority': 'die size shown on Superiority Dice',
  'monk/warrior-of-the-elements:Stride of the Elements': 'speed while Attunement is active',
  'monk/warrior-of-the-elements:Elemental Epitome': 'choice at each turn',
  'monk/warrior-of-the-open-hand:Quivering Palm': 'uses the Focus DC shown',
  'ranger/beast-master:Primal Companion': 'creature of the Summons tab',
  'ranger/fey-wanderer:Fey Wanderer Spells': 'spell table (subclass.spells)',
  'ranger/fey-wanderer:Beguiling Twist': 'spell save DC',
  'rogue:Devious Strikes': 'Cunning Strike options; DC shown',
  'rogue/assassin:Envenom Weapons': 'fixed 2d6 on a Cunning Strike',
  'rogue/soulknife:Soul Blades': 'note on the Psychic Blade line',
  'rogue/thief:Supreme Sneak': 'Cunning Strike option',
  'rogue/thief:Use Magic Device': 'rule of items',
  'sorcerer/clockwork-sorcery:Clockwork Spells': 'spell table (subclass.spells)',
  'sorcerer/wild-magic-sorcery:Wild Magic Surge': 'roll on a table',
  'sorcerer/wild-magic-sorcery:Bend Luck': 'fixed 1d4, spends a Sorcery Point',
  'warlock/archfey-patron:Misty Escape': 'spell save DC',
  'wizard/evoker:Overchannel': 'maximum damage: nothing to calculate',
};

describe('class and subclass features with something to calculate are all on the sheet', () => {
  const missing: string[] = [];
  for (const sub of REAL_SUBCLASSES as unknown as Subclass[]) {
    if (sub.edition !== '2024' || sub.source !== "Player's Handbook") continue;
    const cls = REAL.classes.get(sub.classId)!;
    const sheet = sheetOf(cls.id, 20, sub.id);
    const res = playResources(sheet).map((r) => r.name.toLowerCase());
    const rows = attacksFor(sheet, []).map((r) => r.name.toLowerCase());
    const isCovered = (f: { name: string; description: string }) => {
      const n = f.name.toLowerCase();
      const tr = traitRules(f);
      const fr = featRules(f);
      return (
        DEFS.some(
          (d) => d.feature === f.name || (d.also ?? []).some((a) => a.feature === f.name),
        ) ||
        writtenDc(f.description).length > 0 ||
        res.includes(n) ||
        sheet.featUses.some((u) => u.feat.toLowerCase() === n) ||
        sheet.featSpells.some((s) => s.feat.name.toLowerCase() === n) ||
        sheet.combat.notes.some((x) => x.source.toLowerCase() === n) ||
        rows.some((r) => r.includes(n)) ||
        !!(tr.senses.length || tr.speeds.length || tr.resistances.length || tr.skills.length) ||
        !!(tr.unarmored.length || tr.speedTo || tr.initiative.pb) ||
        !!(fr.spells.length || fr.uses.length) ||
        /Psychic Blades|Martial Arts|Unarmed/.test(f.name)
      );
    };
    for (const [owner, list] of [
      [cls.id, cls.features],
      [sub.id, sub.features],
    ] as const)
      for (const f of list) {
        const key = `${owner}:${f.name}`;
        if (NEEDS.test(f.description.replace(/\s+/g, ' ')) && !isCovered(f) && !(key in TEXT_OK))
          missing.push(key);
      }
  }

  it('has no feature left unexamined', () => {
    expect([...new Set(missing)]).toEqual([]);
  });

  it('keeps the exceptions list honest: every entry still exists in the data', () => {
    const names = new Set<string>();
    for (const c of REAL.classes.values())
      for (const f of c.features) names.add(`${c.id}:${f.name}`);
    for (const s of REAL_SUBCLASSES) for (const f of s.features) names.add(`${s.id}:${f.name}`);
    for (const k of Object.keys(TEXT_OK)) expect(names.has(k), k).toBe(true);
  });
});
