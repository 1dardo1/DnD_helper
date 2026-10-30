import classes from '../../../../../data/classes.json';
import subclasses from '../../../../../data/subclasses.json';
import {
  CLASS_THEMES,
  MOTIFS,
  PAPER_DARK,
  PAPER_LIGHT,
  SUBCLASS_THEMES,
  contrast,
  hslToHex,
  themeFor,
  themeVars,
} from './class-theme';

const classIds = (classes as { id: string }[]).map((c) => c.id);
const subs = (subclasses as { id: string; classId: string }[]).map((s) => ({
  id: s.id,
  classId: s.classId,
}));

describe('class themes', () => {
  it('has a hand-made theme for every class in the data', () => {
    for (const id of classIds) {
      expect(CLASS_THEMES[id], id).toBeDefined();
      expect(themeFor(id).known).toBe(true);
    }
  });

  it('gives every class a different look', () => {
    const looks = classIds.map((id) => {
      const t = themeFor(id);
      return `${t.hue}|${t.motif}`;
    });
    expect(new Set(looks).size).toBe(classIds.length);
  });

  it('gives every subclass a deterministic variation, distinct from its class and siblings', () => {
    const seen = new Set<string>();
    for (const s of subs) {
      const t = themeFor(s.classId, s.id);
      expect(themeFor(s.classId, s.id)).toEqual(t);
      expect(t.subclassId).toBe(s.id);
      expect(MOTIFS).toContain(t.motif);
      const cls = themeFor(s.classId);
      expect(`${t.hue}|${t.motif}|${t.hue2}`).not.toBe(`${cls.hue}|${cls.motif}|${cls.hue2}`);
      const key = `${s.classId}|${t.hue}|${t.motif}|${t.hue2}`;
      expect(seen.has(key), `${s.id} looks like a sibling`).toBe(false);
      seen.add(key);
    }
  });

  it('only hand-picks existing subclasses', () => {
    const ids = new Set(subs.map((s) => s.id));
    for (const id of Object.keys(SUBCLASS_THEMES)) expect(ids.has(id), id).toBe(true);
  });

  it('keeps accents readable (text 4.5:1, ornaments 3:1) on light and dark paper', () => {
    const all = [
      ...classIds.map((id) => themeFor(id)),
      ...subs.map((s) => themeFor(s.classId, s.id)),
    ];
    for (const t of all) {
      expect(contrast(t.accentLight, PAPER_LIGHT)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accentDark, PAPER_DARK)).toBeGreaterThanOrEqual(4.5);
      // ornaments only: non-text contrast
      const min = CLASS_THEMES[t.classId]?.decoContrast ?? 3;
      expect(contrast(t.accent2Light, PAPER_LIGHT)).toBeGreaterThanOrEqual(min);
      expect(contrast(t.accent2Dark, PAPER_DARK)).toBeGreaterThanOrEqual(min);
    }
  });

  it('falls back to a neutral theme for unknown classes', () => {
    const t = themeFor('homebrew-class');
    expect(t.known).toBe(false);
    expect(themeFor('homebrew-class', 'homebrew-class/x').subclassId).toBe('homebrew-class/x');
  });

  it('exposes CSS variables', () => {
    const vars = themeVars(themeFor('wizard'));
    expect(vars['--th-accent-light']).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--th-hue']).toBe('204');
  });

  it('converts colours', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
});
