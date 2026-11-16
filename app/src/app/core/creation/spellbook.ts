import { Character } from '../models/character';
import { DndClass, Spell } from '../models/compendium';
import { SpellsByClass, spellsOf } from './spell-choices';

/**
 * A class that writes its spells in a book (Wizard, Spellcasting: "**Spellbook.** ... It starts
 * with six level 1 Wizard spells of your choice ... Whenever you gain a Wizard level after 1, add
 * two Wizard spells of your choice to your spellbook"). Its prepared spells are chosen from the
 * book; the book holds more spells than it prepares. Everything is read from the text.
 */
export interface SpellbookRule {
  /** Spells it starts with ("six level 1 Wizard spells"). */
  start: number;
  /** Spells added at each level after the first ("add two Wizard spells"). */
  perLevel: number;
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

export function spellbookRule(cls: DndClass): SpellbookRule | null {
  const text = cls.features.find((f) => f.name === 'Spellcasting')?.description ?? '';
  if (!/\*\*Spellbook\.\*\*/.test(text)) return null;
  const start = /It starts with (\w+) level 1 \w+ spells of your choice/i.exec(text);
  const per =
    /Whenever you gain an? \w+ level after 1, add (\w+) \w+ spells of your choice to your spellbook/i.exec(
      text,
    );
  const n = (w: string | undefined) => (w ? (WORDS[w.toLowerCase()] ?? Number(w)) : NaN);
  if (!start || !per || isNaN(n(start[1])) || isNaN(n(per[1]))) return null;
  return { start: n(start[1]), perLevel: n(per[1]) };
}

/** How many spells the book gets for free up to this level (copying found ones adds more). */
export function spellbookSize(rule: SpellbookRule, level: number): number {
  return rule.start + rule.perLevel * Math.max(0, level - 1);
}

/**
 * The spell ids in the book: what the player wrote in it plus the level 1+ spells prepared for the
 * class, which come from the book ("choose four spells from your spellbook"). A character from
 * before the book was kept has only the second part: its prepared spells were all in the book.
 * Spells picked when creating or levelling up the character land in the book this way too.
 */
export function spellbookOf(
  ch: Character,
  classId: string,
  by: SpellsByClass,
  spells: ReadonlyMap<string, Spell>,
): string[] {
  const prepared = spellsOf(by, classId).filter((id) => (spells.get(id)?.level ?? 0) > 0);
  return [...new Set([...(ch.choices.spellbook ?? []), ...prepared])];
}

/**
 * Writes a spell in (on) or out of the book. A prepared spell taken out of the book stops being
 * prepared too: "choose four spells from your spellbook".
 */
export function toggleInBook(
  ch: Character,
  classId: string,
  by: SpellsByClass,
  spells: ReadonlyMap<string, Spell>,
  id: string,
  on: boolean,
): { book: string[]; by: SpellsByClass } {
  const book = spellbookOf(ch, classId, by, spells).filter((x) => x !== id);
  if (on) book.push(id);
  const mine = spellsOf(by, classId);
  return {
    book,
    by: on || !mine.includes(id) ? by : { ...by, [classId]: mine.filter((x) => x !== id) },
  };
}
