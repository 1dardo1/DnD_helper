import { CLASS_THEMES } from './class-theme';
import { ORNAMENT_CLASSES, ornamentFor, ornamentMarkup } from './class-ornaments';

describe('class ornaments', () => {
  it('draws an ornament of its own for every themed class', () => {
    expect([...ORNAMENT_CLASSES].sort()).toEqual(Object.keys(CLASS_THEMES).sort());
    const runs = new Set(ORNAMENT_CLASSES.map((id) => ornamentFor(id).run));
    expect(runs.size).toBe(ORNAMENT_CLASSES.length);
  });

  it('builds well-formed markup in theme colours only', () => {
    for (const id of ORNAMENT_CLASSES) {
      const { html, cw } = ornamentMarkup(id);
      expect(cw).toBeGreaterThan(0);
      expect(html, id).not.toMatch(/NaN|undefined|\{u\}/);
      // every colour comes from the theme (CSS variables), never a literal
      expect(html, id).not.toMatch(/class="s?[a-el]"|fill="#|stroke="#/);
      const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
      expect(doc.querySelectorAll('.th-orn-corner').length).toBe(4);
      expect(doc.querySelectorAll('.th-orn-side').length).toBe(2);
    }
  });

  it('gives every frame its own ids (several themed boxes on one page)', () => {
    const a = ornamentMarkup('wizard').html.match(/id="([^"]+)"/g);
    const b = ornamentMarkup('wizard').html.match(/id="([^"]+)"/g);
    expect(a?.length).toBeGreaterThan(0);
    for (const x of a ?? []) expect(b).not.toContain(x);
  });

  it('falls back to a generic ornament for unknown classes', () => {
    expect(ornamentFor('homebrew-class')).toBe(ornamentFor('wizard'));
  });
});
