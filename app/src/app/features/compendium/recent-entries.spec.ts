import { MAX_RECENT, RecentEntry, parseRecent, pushRecent } from './recent-entries';

const fireball: RecentEntry = { type: 'spell', id: 'fireball', name: 'Fireball' };
const aboleth: RecentEntry = { type: 'monster', id: 'aboleth', name: 'Aboleth' };
const alert: RecentEntry = { type: 'feat', id: 'alert', name: 'Alert' };

describe('recently viewed compendium pages', () => {
  it('puts the page just opened first, without repeating it', () => {
    let list = pushRecent([], fireball);
    list = pushRecent(list, aboleth);
    list = pushRecent(list, fireball);
    expect(list).toEqual([fireball, aboleth]);
  });

  it('tells apart entries of different types with the same id', () => {
    const item: RecentEntry = { type: 'item', id: 'alert', name: 'Alert' };
    expect(pushRecent([alert], item)).toEqual([item, alert]);
  });

  it('keeps only the last MAX_RECENT pages', () => {
    let list: RecentEntry[] = [];
    for (let i = 0; i < MAX_RECENT + 3; i++)
      list = pushRecent(list, { type: 'spell', id: `s${i}`, name: `S${i}` });
    expect(list.length).toBe(MAX_RECENT);
    expect(list[0].id).toBe(`s${MAX_RECENT + 2}`);
  });

  it('reads back what it stored and ignores anything malformed', () => {
    expect(parseRecent(JSON.stringify([fireball, aboleth]))).toEqual([fireball, aboleth]);
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent('not json')).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
    expect(
      parseRecent(JSON.stringify([{ type: 'planet', id: 'x', name: 'X' }, null, alert])),
    ).toEqual([alert]);
  });
});
