import { REAL, REAL_SPELLS, hero } from '../rules/real-data.testing';
import { spellbookOf, spellbookRule, spellbookSize, toggleInBook } from './spellbook';

const spells = new Map(REAL_SPELLS.map((s) => [s.id, s]));

describe('Wizard spellbook (Spellcasting: "**Spellbook.**")', () => {
  it('reads six to start and two per level from the text', () => {
    const rule = spellbookRule(REAL.classes.get('wizard')!);
    expect(rule).toEqual({ start: 6, perLevel: 2 });
    expect(spellbookSize(rule!, 1)).toBe(6);
    expect(spellbookSize(rule!, 5)).toBe(14);
  });

  it('only the Wizard keeps one', () => {
    expect(spellbookRule(REAL.classes.get('cleric')!)).toBeNull();
    expect(spellbookRule(REAL.classes.get('sorcerer')!)).toBeNull();
  });

  it('an old character: the book is its prepared level 1+ spells (cantrips left out)', () => {
    const ch = hero('wizard', 1);
    const by = { wizard: ['fire-bolt', 'magic-missile', 'shield'] };
    expect(spellbookOf(ch, 'wizard', by, spells).sort()).toEqual(['magic-missile', 'shield']);
  });

  it('writing a spell in and taking a prepared one out of the book', () => {
    const ch = hero('wizard', 1);
    const by = { wizard: ['magic-missile', 'shield'] };
    const added = toggleInBook(ch, 'wizard', by, spells, 'sleep', true);
    expect(added.book.sort()).toEqual(['magic-missile', 'shield', 'sleep']);
    const withBook = { ...ch, choices: { ...ch.choices, spellbook: added.book } };
    const removed = toggleInBook(withBook, 'wizard', by, spells, 'shield', false);
    expect(removed.book.sort()).toEqual(['magic-missile', 'sleep']);
    expect(removed.by['wizard']).toEqual(['magic-missile']);
  });
});
