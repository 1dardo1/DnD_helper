import { pdfFileName } from '../characters/backup';
import { Measure, firstSentence, fitText, plainText, toWinAnsi, wrapSegs } from './pdf-text';
import {
  PAGE_H,
  PAGE_W,
  PDF_LABEL_KEYS,
  PdfLabels,
  PdfOp,
  PdfSpell,
  SheetPdfInput,
  composeSheetPdf,
} from './sheet-pdf';

/** About the width of Helvetica: half an em per character. */
const measure: Measure = (text, size, bold) => text.length * size * (bold ? 0.55 : 0.5);

const labels = Object.fromEntries(PDF_LABEL_KEYS.map((k) => [k, k])) as PdfLabels;

function input(over: Partial<SheetPdfInput> = {}): SheetPdfInput {
  const skills = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      name: `Skill ${i}`,
      modifier: 1,
      proficiency: 'none' as const,
    }));
  return {
    labels,
    name: 'Thorin Ñandú',
    background: 'Soldado',
    classes: 'Guerrero 5',
    subclass: 'Campeón',
    species: 'Enano',
    level: 5,
    armorClass: 16,
    shield: true,
    hp: { current: 30, max: 44, temp: 0 },
    hitDice: { total: '5d10', spent: 1 },
    deathSaves: { successes: 1, failures: 0 },
    proficiencyBonus: 3,
    initiative: 1,
    speed: '30 pies',
    size: 'Mediano',
    passivePerception: 12,
    inspiration: false,
    abilities: [2, 5, 1, 6, 6, 5].map((n, i) => ({
      name: `Ab${i}`,
      score: 10,
      modifier: 0,
      save: { modifier: 0, proficient: false },
      skills: skills(Math.min(n, 5)),
    })),
    attacks: [{ name: 'Hacha', bonus: 5, damage: '1d12+3 cortante', notes: 'Pesada' }],
    features: [
      {
        group: 'class',
        name: 'Ataque extra',
        level: 'Nivel 5',
        source: 'Guerrero',
        text: 'Puedes atacar **dos** veces. Más texto.\n\n| a | b |\n|---|---|\n| 1 | 2 |',
      },
    ],
    armorTraining: { light: true, medium: true, heavy: false, shields: true },
    weapons: 'Armas marciales',
    tools: '',
    languages: 'Común',
    spellcasting: null,
    spells: [],
    equipment: ['Espada larga ×1'],
    coins: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 },
    notes: 'Notas cortas',
    ...over,
  };
}

const texts = (pages: { ops: PdfOp[] }[]) =>
  pages.flatMap((p) => p.ops.flatMap((o) => (o.k === 'text' ? [o.text] : [])));

const spell = (i: number, over: Partial<PdfSpell> = {}): PdfSpell => ({
  level: 1 + (i % 9),
  name: `Conjuro número ${i}`,
  time: 'acción',
  range: '60 pies',
  concentration: i % 2 === 0,
  ritual: false,
  material: i % 3 === 0,
  notes: 'Instantáneo',
  prepared: true,
  ...over,
});

describe('composeSheetPdf', () => {
  it('draws two pages of the size of the official sheet', () => {
    const short = [
      {
        group: 'class' as const,
        name: 'Ataque extra',
        level: '',
        source: 'Guerrero',
        text: 'Atacas dos veces.',
      },
    ];
    const pages = composeSheetPdf(input({ features: short }), measure);
    expect(pages).toHaveLength(2);
    expect(pages.every((p) => p.width === PAGE_W && p.height === PAGE_H)).toBe(true);
    const all = texts(pages);
    expect(all).toContain('Thorin Ñandú');
    expect(all).toContain('+3');
    expect(all).toContain('1d12+3 cortante');
  });

  it('keeps everything inside the page', () => {
    const many = Array.from({ length: 80 }, (_, i) => spell(i));
    const pages = composeSheetPdf(
      input({ spells: many, notes: 'línea\n'.repeat(120), equipment: many.map((s) => s.name) }),
      measure,
    );
    for (const p of pages) {
      for (const o of p.ops) {
        if (o.k === 'text') {
          expect(o.y).toBeGreaterThan(0);
          expect(o.y).toBeLessThan(PAGE_H);
          expect(o.x).toBeGreaterThanOrEqual(0);
          expect(o.x).toBeLessThanOrEqual(PAGE_W);
        }
      }
    }
  });

  it('puts the spells that do not fit page 2 on extra pages, none lost', () => {
    const many = Array.from({ length: 80 }, (_, i) => spell(i));
    const pages = composeSheetPdf(input({ spells: many }), measure);
    expect(pages.length).toBeGreaterThan(2);
    const all = new Set(texts(pages));
    for (const s of many) expect(all.has(s.name)).toBe(true);
  });

  it('sends the long text of the features and the overflowing notes to extra pages', () => {
    const notes = Array.from({ length: 150 }, (_, i) => `Nota ${i}`).join('\n');
    const pages = composeSheetPdf(input({ notes }), measure);
    expect(pages.length).toBeGreaterThan(2);
    const all = texts(pages).join('\n');
    for (let i = 0; i < 150; i++) expect(all).toContain(`Nota ${i}`);
    // the full text of a feature cut in its box
    expect(all).toContain('Más texto.');
  });

  it('marks what was cut with an ellipsis where it is shortened', () => {
    const pages = composeSheetPdf(
      input({ attacks: [{ name: 'x'.repeat(80), bonus: 1, damage: '1d4', notes: '' }] }),
      measure,
    );
    expect(texts([pages[0]]).some((t) => t.endsWith('…'))).toBe(true);
    // ... and the full line is on the extra pages
    expect(texts(pages.slice(2)).join('')).toContain('x'.repeat(80));
  });

  it('lists the attacks over the six rows on an extra page', () => {
    const attacks = Array.from({ length: 8 }, (_, i) => ({
      name: `Arma ${i}`,
      bonus: i,
      damage: '1d6',
      notes: '',
    }));
    const pages = composeSheetPdf(input({ attacks }), measure);
    const extra = texts(pages.slice(2)).join('\n');
    expect(extra).toContain('Arma 7');
    expect(extra).not.toContain('Arma 2');
  });
});

describe('portrait on page 1', () => {
  const portrait = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

  it('adds one image op next to the name only when there is a portrait', () => {
    const images = (over: Partial<SheetPdfInput>) =>
      composeSheetPdf(input(over), measure)[0].ops.filter((o) => o.k === 'image');
    expect(images({})).toHaveLength(0);
    expect(images({ portrait: null })).toHaveLength(0);
    const [img] = images({ portrait });
    expect(img).toMatchObject({ k: 'image', data: portrait });
    expect(composeSheetPdf(input({ portrait }), measure)).toHaveLength(
      composeSheetPdf(input(), measure).length,
    );
  });
});

describe('text helpers', () => {
  it('writes accents and drops what the fonts cannot', () => {
    expect(toWinAnsi('Ñandú — “hola” ≥ 3 → ✦')).toBe('Ñandú — “hola” >= 3 -> *');
    expect(toWinAnsi('日')).toBe('?');
    expect(toWinAnsi('ā')).toBe('a');
  });

  it('turns markdown into plain paragraphs', () => {
    expect(plainText('**Bold.** text\n\n- item\n\n| a | b |\n|---|---|\n| 1 | 2 |')).toEqual([
      'Bold. text',
      '• item',
      'a | b',
      '1 | 2',
    ]);
  });

  it('takes the first sentence', () => {
    expect(firstSentence(['Uno. Dos.'])).toEqual({ text: 'Uno.', more: true });
    expect(firstSentence(['Solo'])).toEqual({ text: 'Solo', more: false });
  });

  it('wraps and fits text', () => {
    const lines = wrapSegs([{ t: 'aaa bbb ccc' }], 20, 10, measure);
    expect(lines.map((l) => l.map((s) => s.t).join(''))).toEqual(['aaa', 'bbb', 'ccc']);
    const f = fitText('abcdefghij', 20, 10, 8, measure);
    expect(f.cut).toBe(true);
    expect(f.text.endsWith('…')).toBe(true);
  });

  it('names the file after the character', () => {
    expect(pdfFileName('Thorin (ejemplo)')).toBe('Thorin-ejemplo.pdf');
    expect(pdfFileName('a/b:c')).toBe('a-b-c.pdf');
    expect(pdfFileName('  ')).toBe('personaje.pdf');
  });
});
