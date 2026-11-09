import {
  EMPTY_STACK,
  NavStack,
  describeUrl,
  popTo,
  previousEntry,
  resolveBack,
  visit,
} from './nav-stack';

const e = (url: string, id: number) => ({ url, id });

function walk(...steps: [string, number, boolean?][]): NavStack {
  return steps.reduce((s, [url, id, replace]) => visit(s, e(url, id), !!replace), EMPTY_STACK);
}

describe('nav stack', () => {
  it('has no previous page at the start of a visit', () => {
    const s = walk(['/compendium/spell/fireball', 1]);
    expect(previousEntry(s)).toBeNull();
    expect(resolveBack(s).kind).toBe('fallback');
  });

  it('goes back to the wizard it came from', () => {
    const s = walk(['/characters/new', 1], ['/compendium/spell/fireball', 2]);
    const t = resolveBack(s);
    expect(t.kind).toBe('history');
    expect(t.label?.key).toBe('back.creation');
  });

  it('replacing an entry does not add a step (sheet tabs, redirects)', () => {
    const s = walk(
      ['/characters', 1],
      ['/characters/a', 2],
      ['/characters/a/resumen', 3, true],
      ['/characters/a/rasgos', 4, true],
      ['/characters/a/conjuros', 5, true],
    );
    expect(s.entries.map((x) => x.url)).toEqual(['/characters', '/characters/a/conjuros']);
    expect(resolveBack(s).label?.key).toBe('characters.title');
  });

  it('chained entries go back one by one', () => {
    let s = walk(['/compendium/spell/a', 1], ['/compendium/rule/b', 2], ['/compendium/rule/c', 3]);
    s = popTo(s, e('/compendium/rule/b', 2));
    expect(s.index).toBe(1);
    expect(resolveBack(s).kind).toBe('history');
    s = popTo(s, e('/compendium/spell/a', 1));
    expect(resolveBack(s).kind).toBe('fallback');
  });

  it('going forward in the browser history is followed too', () => {
    let s = walk(['/a', 1], ['/b', 2], ['/c', 3]);
    s = popTo(s, e('/a', 1));
    s = popTo(s, e('/c', 3));
    expect(s.index).toBe(2);
  });

  it('a new page after going back drops the pages that were ahead', () => {
    let s = walk(['/a', 1], ['/b', 2], ['/c', 3]);
    s = popTo(s, e('/a', 1));
    s = visit(s, e('/d', 4), false);
    expect(s.entries.map((x) => x.url)).toEqual(['/a', '/d']);
  });

  it('an unknown history entry (after a reload) starts over without a previous page', () => {
    const s = popTo(walk(['/a', 1], ['/b', 2]), e('/x', 99));
    expect(s.entries).toHaveLength(1);
    expect(resolveBack(s).kind).toBe('fallback');
  });

  it('keeps a bounded number of entries', () => {
    let s = EMPTY_STACK;
    for (let i = 0; i < 500; i++) s = visit(s, e('/p' + i, i), false);
    expect(s.entries.length).toBeLessThanOrEqual(200);
    expect(s.entries[s.index].url).toBe('/p499');
  });
});

describe('describeUrl', () => {
  const key = (u: string) => describeUrl(u).key;
  it('names the pages a detour can start from', () => {
    expect(key('/characters/new')).toBe('back.creation');
    expect(key('/characters/x1/edit')).toBe('back.edit');
    expect(key('/characters/x1/level-up')).toBe('back.levelUp');
    expect(key('/characters/x1/conjuros')).toBe('back.sheet');
    expect(key('/characters/x1/invocaciones')).toBe('back.summons');
    expect(key('/characters')).toBe('characters.title');
    expect(key('/compendium/search?q=bola')).toBe('back.search');
    expect(key('/compendium/spell?school=Evocation')).toBe('type.spell');
    expect(key('/compendium/crafting?section=x')).toBe('crafting.title');
    expect(key('/compendium/subclass/barbarian%2Fberserker')).toBe('common.back');
    expect(key('/dm/encounters/e1')).toBe('back.encounter');
    expect(key('/dm/encounters')).toBe('dm.encounters.title');
    expect(key('/dm/combat?encounter=e1')).toBe('back.combat');
  });
});
