import { describe, expect, it } from 'vitest';

import {
  TabInput,
  hasSpellsTab,
  readLastTab,
  resolveTab,
  tabFromUrl,
  tabLink,
  visibleTabs,
  writeLastTab,
} from './sheet-tabs';

const noCast = (classes: TabInput['classes'] = [{ id: 'fighter', level: 5 }]): TabInput => ({
  spellcasting: { classes: [], slots: [0, 0, 0, 0, 0, 0, 0, 0, 0], pact: null },
  classes,
});
const wizard: TabInput = {
  spellcasting: {
    classes: [{ classId: 'wizard' }],
    slots: [4, 2, 0, 0, 0, 0, 0, 0, 0],
    pact: null,
  },
  classes: [{ id: 'wizard', level: 3 }],
};

describe('visibleTabs', () => {
  it('a Fighter without feat spells has no Spells nor Summons tab', () => {
    expect(visibleTabs(noCast(), { featSpells: 0, summonSources: 0 })).toEqual([
      'resumen',
      'rasgos',
      'equipo',
      'notas',
    ]);
  });

  it('feat spells bring the Spells tab', () => {
    expect(visibleTabs(noCast(), { featSpells: 1, summonSources: 0 })).toContain('conjuros');
  });

  it('a caster has Spells; Summons only with summonable creatures or tracked ones', () => {
    expect(visibleTabs(wizard, { featSpells: 0, summonSources: 0 })).toEqual([
      'resumen',
      'rasgos',
      'conjuros',
      'equipo',
      'notas',
    ]);
    expect(visibleTabs(wizard, { featSpells: 0, summonSources: 2 })).toContain('invocaciones');
    expect(visibleTabs(wizard, { featSpells: 0, summonSources: 0, summoned: 1 })).toContain(
      'invocaciones',
    );
  });

  it('Warlock pact slots and Artificer 2+ (Replicate Magic Item) show Spells', () => {
    const warlock: TabInput = {
      spellcasting: { classes: [], slots: [], pact: { slots: 1, level: 1 } },
      classes: [{ id: 'warlock', level: 1 }],
    };
    expect(hasSpellsTab(warlock, 0)).toBe(true);
    expect(hasSpellsTab(noCast([{ id: 'artificer', level: 2 }]), 0)).toBe(true);
    expect(hasSpellsTab(noCast([{ id: 'artificer', level: 1 }]), 0)).toBe(false);
  });
});

describe('resolveTab', () => {
  const visible = visibleTabs(noCast(), { featSpells: 0, summonSources: 0 });

  it('keeps a visible tab and falls back to the summary otherwise', () => {
    expect(resolveTab('equipo', visible)).toBe('equipo');
    expect(resolveTab('conjuros', visible)).toBe('resumen');
    expect(resolveTab('edit', visible)).toBe('resumen');
    expect(resolveTab(null, visible)).toBe('resumen');
  });
});

describe('URLs', () => {
  it('every tab has its own explicit URL', () => {
    expect(tabLink('a', 'resumen')).toEqual(['/characters', 'a', 'resumen']);
    expect(tabLink('a', 'invocaciones')).toEqual(['/characters', 'a', 'invocaciones']);
  });

  it('reads the tab out of a URL', () => {
    expect(tabFromUrl('/characters/a/conjuros', 'a')).toBe('conjuros');
    expect(tabFromUrl('/characters/a/conjuros?x=1#top', 'a')).toBe('conjuros');
    expect(tabFromUrl('/characters/a/', 'a')).toBeNull();
    expect(tabFromUrl('/characters/b/conjuros', 'a')).toBeNull();
    expect(tabFromUrl('/compendium/spell', 'a')).toBeNull();
  });
});

describe('last tab used', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };

  it('is remembered per character and ignores junk', () => {
    const s = memory();
    writeLastTab(s, 'a', 'equipo');
    expect(readLastTab(s, 'a')).toBe('equipo');
    expect(readLastTab(s, 'b')).toBeNull();
    s.setItem('dnd-helper.sheet.tab.c', 'nonsense');
    expect(readLastTab(s, 'c')).toBeNull();
  });

  it('works without storage', () => {
    expect(readLastTab(null, 'a')).toBeNull();
    expect(() => writeLastTab(null, 'a', 'notas')).not.toThrow();
  });
});
