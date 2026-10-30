import { Sheet } from '../rules/sheet';
import { replaceSpell, swapRule, swapsAfterLongRest } from './spell-swap';

describe('changing prepared spells', () => {
  it('follows each class: any after a long rest, one after a long rest, one on level up', () => {
    expect(swapRule('wizard')).toEqual({ longRest: 'any', levelUp: null });
    expect(swapRule('paladin')).toEqual({ longRest: 'one', levelUp: null });
    expect(swapRule('sorcerer')).toEqual({ longRest: null, levelUp: 'one' });
    // subclass casters (Eldritch Knight, Profane Soul...) cast through fighter, blood-hunter...
    expect(swapRule('blood-hunter')).toEqual({ longRest: null, levelUp: 'one' });
  });

  it('lists the casters that may change spells after a long rest', () => {
    const sheet = {
      spellcasting: {
        classes: [{ classId: 'cleric' }, { classId: 'warlock' }, { classId: 'ranger' }],
      },
    } as unknown as Sheet;
    expect(swapsAfterLongRest(sheet)).toEqual({ cleric: 'any', ranger: 'one' });
  });

  it('replaces one spell keeping the order, and ignores invalid swaps', () => {
    expect(replaceSpell(['a', 'b', 'c'], 'b', 'x')).toEqual(['a', 'x', 'c']);
    expect(replaceSpell(['a', 'b'], 'b', 'a')).toEqual(['a', 'b']);
    expect(replaceSpell(['a', 'b'], '', 'x')).toEqual(['a', 'b']);
  });
});
