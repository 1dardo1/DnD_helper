import { Character } from '../models/character';
import { Ability } from '../models/compendium';
import { RulesData, computeSheet } from '../rules/engine';
import { ABILITIES } from '../rules/tables';

/**
 * One thing that differs between two versions of a character, in game terms
 * ("Level", "Hit Points", "Feats"...), never as JSON. label is a translation key.
 */
export interface Difference {
  label: string;
  /** Value in this device's version and in the repo's. */
  mine: string;
  theirs: string;
}

/** What changed between this device's version and the repo's, for the conflict screen. */
export function describeDifferences(
  mine: Character,
  theirs: Character,
  data: RulesData,
  labels: {
    /** Skill id → name in the current language. */
    skill?: (id: string) => string;
    /** English name from the data → name shown. */
    data?: (name: string) => string;
    /** Spell id → name shown. */
    spell?: (id: string) => string;
  } = {},
): Difference[] {
  const skillName = labels.skill ?? ((id: string) => id);
  const shown = labels.data ?? ((n: string) => n);
  const spellName = labels.spell ?? ((id: string) => id);
  const a = computeSheet(mine, data);
  const b = computeSheet(theirs, data);
  const out: Difference[] = [];
  const add = (label: string, x: string, y: string) => {
    if (x !== y) out.push({ label, mine: x || '—', theirs: y || '—' });
  };
  const name = (map: Map<string, { name: string }>, id: string) => {
    const n = map.get(id)?.name;
    return n ? shown(n) : id;
  };
  const classLine = (sheet: typeof a) =>
    sheet.classes
      .map((c) => `${shown(c.name)} ${c.level}${c.subclass ? ` (${shown(c.subclass)})` : ''}`)
      .join(' / ');
  const names = (map: Map<string, { name: string }>, ids: string[]) =>
    ids
      .map((id) => name(map, id))
      .sort()
      .join(', ');
  const optionName = (id: string) => id.split('/').pop()!.replace(/-/g, ' ');

  add('conflict.field.name', mine.name, theirs.name);
  add('conflict.field.classes', classLine(a), classLine(b));
  add('conflict.field.species', shown(a.species ?? ''), shown(b.species ?? ''));
  add('conflict.field.background', shown(a.background ?? ''), shown(b.background ?? ''));
  for (const ab of ABILITIES as Ability[]) {
    add(`ability.${ab}`, String(a.abilities[ab].score), String(b.abilities[ab].score));
  }
  add(
    'conflict.field.hp',
    `${a.hitPoints.current} / ${a.hitPoints.max}`,
    `${b.hitPoints.current} / ${b.hitPoints.max}`,
  );
  add('conflict.field.armorClass', String(a.armorClass.value), String(b.armorClass.value));
  add(
    'conflict.field.skills',
    mine.choices.skills.map(skillName).sort().join(', '),
    theirs.choices.skills.map(skillName).sort().join(', '),
  );
  add(
    'conflict.field.feats',
    names(data.feats, mine.choices.feats),
    names(data.feats, theirs.choices.feats),
  );
  add(
    'conflict.field.options',
    mine.choices.options.map(optionName).sort().join(', '),
    theirs.choices.options.map(optionName).sort().join(', '),
  );
  add(
    'conflict.field.spells',
    mine.choices.spells.map(spellName).sort().join(', '),
    theirs.choices.spells.map(spellName).sort().join(', '),
  );
  add(
    'conflict.field.armor',
    mine.equipped.armorId ? name(data.items, mine.equipped.armorId) : '',
    theirs.equipped.armorId ? name(data.items, theirs.equipped.armorId) : '',
  );
  add('conflict.field.equipment', mine.equipment, theirs.equipment);
  add('conflict.field.notes', mine.notes, theirs.notes);
  return out;
}
