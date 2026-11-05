import {
  Measure,
  PdfColor,
  Seg,
  firstSentence,
  fitText,
  plainText,
  toWinAnsi,
  wrapSegs,
} from './pdf-text';

/**
 * The character sheet as PDF pages: what goes where, with the same zones and proportions as the
 * official 2024 sheet (603 x 774 pt, page 1: identity, abilities, combat, features; page 2:
 * spellcasting, spell list, notes, equipment, coins). Pure: the data goes in as already
 * translated text and the pages come out as drawing operations (sheet-pdf-render.ts draws them).
 * What does not fit a box is never dropped: it goes on extra pages, or is cut with "…" only where
 * the full text is on those pages too.
 */

export const PAGE_W = 603;
export const PAGE_H = 774;
/** Points per pixel of the 838-pixel-wide reference the layout was drawn on. */
const K = PAGE_W / 838;

export type PdfOp =
  | {
      k: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      r?: number;
      fill?: PdfColor;
      stroke?: PdfColor;
      lw?: number;
    }
  | {
      k: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color?: PdfColor;
      lw?: number;
    }
  | {
      k: 'circle';
      cx: number;
      cy: number;
      r: number;
      fill?: PdfColor;
      stroke?: PdfColor;
      lw?: number;
    }
  /** The left half of a circle, filled (half proficiency). */
  | { k: 'half'; cx: number; cy: number; r: number; fill: PdfColor }
  | { k: 'diamond'; cx: number; cy: number; r: number; filled: boolean; color?: PdfColor }
  | {
      k: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      bold?: boolean;
      align?: 'left' | 'center' | 'right';
      color?: PdfColor;
    };

export interface PdfPage {
  width: number;
  height: number;
  ops: PdfOp[];
}

export const PDF_LABEL_KEYS = [
  'characterName',
  'background',
  'class',
  'subclass',
  'species',
  'level',
  'xp',
  'armorClass',
  'shield',
  'hitPoints',
  'hpCurrent',
  'hpTemp',
  'hpMax',
  'hitDice',
  'hdTotal',
  'hdSpent',
  'deathSaves',
  'successes',
  'failures',
  'proficiencyBonus',
  'modifier',
  'score',
  'savingThrow',
  'initiative',
  'speed',
  'size',
  'passivePerception',
  'heroicInspiration',
  'weaponsTitle',
  'attName',
  'attBonus',
  'attDamage',
  'attNotes',
  'classFeatures',
  'speciesTraits',
  'feats',
  'equipTraining',
  'armorTraining',
  'light',
  'medium',
  'heavy',
  'shields',
  'weapons',
  'tools',
  'spellAbility',
  'spellMod',
  'spellDc',
  'spellAttack',
  'spellcasting',
  'abilityShort',
  'modShort',
  'dcShort',
  'atkShort',
  'spellSlots',
  'slotTotal',
  'slotSpent',
  'slotLevel',
  'spellList',
  'spPrep',
  'spLevel',
  'spName',
  'spTime',
  'spRange',
  'spMarks',
  'spNotes',
  'cantripShort',
  'appearance',
  'backstory',
  'alignment',
  'languages',
  'equipment',
  'attunement',
  'coins',
  'coinCP',
  'coinSP',
  'coinEP',
  'coinGP',
  'coinPP',
  'continues',
  'pageWord',
  'appendixAttacks',
  'appendixFeatures',
  'appendixSpells',
  'appendixLanguages',
  'appendixNotes',
  'appendixEquipment',
  'appendixWeapons',
  'appendixTools',
  'legendNone',
  'legendProficient',
  'legendExpertise',
  'legendHalf',
  'pact',
  'noName',
] as const;
export type PdfLabelKey = (typeof PDF_LABEL_KEYS)[number];
export type PdfLabels = Record<PdfLabelKey, string>;

export type Proficiency = 'none' | 'half' | 'full' | 'expertise';

export interface PdfAbility {
  /** "Fuerza". */
  name: string;
  score: number;
  modifier: number;
  save: { modifier: number; proficient: boolean };
  skills: { name: string; modifier: number; proficiency: Proficiency }[];
}

export interface PdfFeature {
  /** Which box of page 1 it goes in: class and subclass, species, feats and background. */
  group: 'class' | 'species' | 'feat';
  name: string;
  /** "Nv. 3" for class features; empty otherwise. */
  level: string;
  /** Where it comes from ("Cazador de sangre", "Enano", "Soldado"). */
  source: string;
  /** Markdown, as the data has it. */
  text: string;
}

export interface PdfSpell {
  /** 0 = cantrip. */
  level: number;
  name: string;
  time: string;
  range: string;
  concentration: boolean;
  ritual: boolean;
  material: boolean;
  /** Duration, class, the feat that gives it... */
  notes: string;
  /** A leveled spell prepared for a class. */
  prepared: boolean;
}

export interface SheetPdfInput {
  labels: PdfLabels;
  name: string;
  background: string;
  /** "Cazador de sangre 5 / Guerrero 1". */
  classes: string;
  subclass: string;
  species: string;
  level: number;
  armorClass: number;
  shield: boolean;
  hp: { current: number; max: number; temp: number };
  hitDice: { total: string; spent: number };
  deathSaves: { successes: number; failures: number };
  proficiencyBonus: number;
  initiative: number;
  speed: string;
  size: string;
  passivePerception: number;
  inspiration: boolean;
  /** STR, DEX, CON, INT, WIS, CHA. */
  abilities: PdfAbility[];
  attacks: { name: string; bonus: number; damage: string; notes: string }[];
  features: PdfFeature[];
  armorTraining: { light: boolean; medium: boolean; heavy: boolean; shields: boolean };
  weapons: string;
  tools: string;
  languages: string;
  spellcasting: {
    classes: {
      name: string;
      ability: string;
      abbr: string;
      modifier: number;
      dc: number;
      attack: number;
    }[];
    /** Slots per level 1-9: total and spent. */
    slots: { total: number; spent: number }[];
    pact: { total: number; spent: number; level: number } | null;
    /** "Preparados: 4 / 6". */
    summary: string;
  } | null;
  spells: PdfSpell[];
  /** One line per item ("Espada larga x1 (equipado)"). */
  equipment: string[];
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number };
  notes: string;
}

// -- low-level drawing (coordinates in the pixels of the 838-wide reference unless said) ----------

type Opts = { fill?: PdfColor; stroke?: PdfColor; lw?: number; r?: number };

class Pg {
  readonly ops: PdfOp[] = [];
  constructor(readonly m: Measure) {}

  box(x: number, y: number, w: number, h: number, o: Opts = {}): void {
    this.ops.push({
      k: 'rect',
      x: x * K,
      y: y * K,
      w: w * K,
      h: h * K,
      r: (o.r ?? 6) * K,
      fill: o.fill,
      stroke: o.stroke ?? 'line',
      lw: o.lw ?? 0.9,
    });
  }

  line(x1: number, y1: number, x2: number, y2: number, color: PdfColor = 'line', lw = 0.6): void {
    this.ops.push({ k: 'line', x1: x1 * K, y1: y1 * K, x2: x2 * K, y2: y2 * K, color, lw });
  }

  circle(cx: number, cy: number, r: number, o: Opts = {}): void {
    this.ops.push({
      k: 'circle',
      cx: cx * K,
      cy: cy * K,
      r: r * K,
      fill: o.fill,
      stroke: o.stroke ?? 'line',
      lw: o.lw ?? 0.8,
    });
  }

  diamond(cx: number, cy: number, r: number, filled: boolean, color: PdfColor = 'line'): void {
    this.ops.push({ k: 'diamond', cx: cx * K, cy: cy * K, r: r * K, filled, color });
  }

  /** Text with its baseline at y. */
  text(
    text: string,
    x: number,
    y: number,
    size: number,
    o: { bold?: boolean; align?: 'left' | 'center' | 'right'; color?: PdfColor } = {},
  ): void {
    if (!text) return;
    this.ops.push({
      k: 'text',
      x: x * K,
      y: y * K,
      text: toWinAnsi(text),
      size,
      bold: o.bold,
      align: o.align ?? 'left',
      color: o.color ?? 'ink',
    });
  }

  /** Text that must fit a width in pixels: smaller first, "…" last. Returns whether it was cut. */
  fit(
    text: string,
    x: number,
    y: number,
    wPx: number,
    size: number,
    o: { bold?: boolean; align?: 'left' | 'center' | 'right'; color?: PdfColor; min?: number } = {},
  ): boolean {
    const t = toWinAnsi(text);
    const f = fitText(t, wPx * K, size, o.min ?? size * 0.6, this.m, !!o.bold);
    this.text(f.text, x, y, f.size, o);
    return f.cut;
  }

  /** Small caps-like caption (muted). */
  caption(text: string, x: number, y: number, align: 'left' | 'center' | 'right' = 'left'): void {
    this.text(text.toUpperCase(), x, y, 4.8, { color: 'muted', align, bold: true });
  }

  /** A box heading: the title centred over a rule. */
  heading(text: string, x: number, w: number, y: number, size = 7): void {
    this.fit(text.toUpperCase(), x + w / 2, y, w - 16, size, {
      bold: true,
      align: 'center',
      color: 'accent',
      min: 5,
    });
    this.line(x + 6, y + 8, x + w - 6, y + 8, 'line', 0.8);
  }

  /** A short title that may take two lines (centred), baseline of the first at y. */
  wrapped(
    text: string,
    cx: number,
    y: number,
    wPx: number,
    size: number,
    o: { color?: PdfColor; lead?: number } = {},
  ): number {
    const lines = wrapSegs([{ t: text.toUpperCase(), b: true }], wPx * K, size, this.m);
    lines.forEach((l, i) =>
      this.text(l.map((s) => s.t).join(''), cx, y + i * (o.lead ?? 8), size, {
        bold: true,
        align: 'center',
        color: o.color ?? 'ink',
      }),
    );
    return lines.length;
  }
}

// -- text flowing into boxes --------------------------------------------------------------------

interface FlowLine {
  segs: Seg[];
  size: number;
  /** Line height in points. */
  lead: number;
  /** Extra space above, in points. */
  before: number;
  /** Which item it belongs to (to know which ones did not fit). */
  ref: number;
}

/** A region in points. */
interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

const region = (x: number, y: number, w: number, h: number): Region => ({
  x: x * K,
  y: y * K,
  w: w * K,
  h: h * K,
});

/** Lays lines top to bottom through the regions; returns how many were placed. */
function placeLines(
  pg: Pg,
  lines: FlowLine[],
  regions: Region[],
  reserve: number,
  draw: boolean,
): number {
  let i = 0;
  regions.forEach((r, ri) => {
    const limit = r.y + r.h - (ri === regions.length - 1 ? reserve : 0);
    let cursor = r.y;
    let first = true;
    while (i < lines.length) {
      const l = lines[i];
      const top = cursor + (first ? 0 : l.before);
      const bottom = top + l.lead;
      if (bottom > limit + 0.01) break;
      if (draw) drawFlowLine(pg, l, r.x, bottom - l.lead * 0.27);
      cursor = bottom;
      first = false;
      i++;
    }
  });
  return i;
}

function drawFlowLine(pg: Pg, l: FlowLine, x: number, baseline: number): void {
  let cx = x;
  for (const s of l.segs) {
    if (s.t) {
      pg.ops.push({
        k: 'text',
        x: cx,
        y: baseline,
        text: toWinAnsi(s.t),
        size: l.size,
        bold: s.b,
        color: s.c ?? 'ink',
        align: 'left',
      });
    }
    cx += pg.m(toWinAnsi(s.t), l.size, !!s.b);
  }
}

/** Wraps paragraphs of segments into flow lines. */
function flowParagraph(
  pg: Pg,
  segs: Seg[],
  width: number,
  size: number,
  ref: number,
  before = 1.5,
  indent = 0,
): FlowLine[] {
  const clean = segs.map((s) => ({ ...s, t: toWinAnsi(s.t) }));
  const lead = size * 1.22;
  return wrapSegs(clean, width, size, pg.m).map((segsOfLine, n) => ({
    segs: n && indent ? [{ t: ' '.repeat(indent) }, ...segsOfLine] : segsOfLine,
    size,
    lead,
    before: n === 0 ? before : 0,
    ref,
  }));
}

/** A box of text: what does not fit is kept for the extra pages and the box says so. */
function textBox(
  pg: Pg,
  paragraphs: string[],
  reg: Region,
  size: number,
  note: string,
  appendix: { title: string; lines: string[] }[],
  title: string,
): void {
  let gap = false;
  const lines = paragraphs.flatMap((p, i) => {
    if (!p.trim()) {
      gap = true;
      return [];
    }
    const l = flowParagraph(pg, [{ t: p }], reg.w, size, i, gap ? 5 : 1.5);
    gap = false;
    return l;
  });
  const placed = placeLines(pg, lines, [reg], 0, false);
  if (placed >= lines.length) {
    placeLines(pg, lines, [reg], 0, true);
    return;
  }
  const noteLead = 5 * 1.3;
  const kept = placeLines(pg, lines, [reg], noteLead, true);
  const missing = new Set(lines.slice(kept).map((l) => l.ref));
  // the paragraphs that were not completely in the box go to the extra pages
  const firstMissing = Math.min(...missing);
  appendix.push({ title, lines: paragraphs.slice(firstMissing) });
  pg.ops.push({
    k: 'text',
    x: reg.x + reg.w,
    y: reg.y + reg.h - 1.5,
    text: toWinAnsi(note),
    size: 5,
    align: 'right',
    color: 'accent',
    bold: true,
  });
}

// -- the rows of the spell table (page 2 and extra pages) ----------------------------------------

const SPELL_COLS = [0.04, 0.045, 0.24, 0.12, 0.1, 0.17, 0.285];

function spellHeader(pg: Pg, x: number, y: number, w: number, L: PdfLabels): void {
  const xs = colX(x, w);
  const heads = [L.spPrep, L.spLevel, L.spName, L.spTime, L.spRange, L.spMarks, L.spNotes];
  heads.forEach((h, i) => {
    const f = fitText(toWinAnsi(h), SPELL_COLS[i] * w - 2, 5.4, 3.4, pg.m);
    pg.ops.push({
      k: 'text',
      x: xs[i] + (i === 5 ? 0 : 1),
      y,
      text: f.text,
      size: f.size,
      color: 'muted',
      align: 'left',
    });
  });
  pg.ops.push({ k: 'line', x1: x, y1: y + 2.5, x2: x + w, y2: y + 2.5, color: 'line', lw: 0.6 });
}

function colX(x: number, w: number): number[] {
  const xs: number[] = [];
  let acc = x;
  for (const f of SPELL_COLS) {
    xs.push(acc);
    acc += f * w;
  }
  return xs;
}

const ROW_H = 19;

/** Draws as many rows as fit in the height; returns how many. */
function spellRows(
  pg: Pg,
  rows: PdfSpell[],
  x: number,
  y: number,
  w: number,
  h: number,
  L: PdfLabels,
  cut: PdfSpell[] = [],
): number {
  const xs = colX(x, w);
  const cw = SPELL_COLS.map((f) => f * w);
  const fit = Math.max(0, Math.floor(h / ROW_H));
  const text = (
    t: string,
    cx: number,
    base: number,
    size: number,
    o: { bold?: boolean; color?: PdfColor; align?: 'left' | 'center' } = {},
  ) =>
    pg.ops.push({
      k: 'text',
      x: cx,
      y: base,
      text: toWinAnsi(t),
      size,
      bold: o.bold,
      color: o.color ?? 'ink',
      align: o.align ?? 'left',
    });
  rows.slice(0, fit).forEach((s, i) => {
    const top = y + i * ROW_H;
    const mid = top + ROW_H / 2;
    pg.ops.push({
      k: 'line',
      x1: x,
      y1: top + ROW_H - 1,
      x2: x + w,
      y2: top + ROW_H - 1,
      color: 'soft',
      lw: 0.5,
    });
    if (s.prepared) {
      pg.ops.push({ k: 'diamond', cx: xs[0] + cw[0] / 2, cy: mid, r: 3.2, filled: true });
    }
    text(s.level === 0 ? L.cantripShort : String(s.level), xs[1] + cw[1] / 2, mid + 2.5, 7.5, {
      bold: true,
      align: 'center',
    });
    const name = fitText(toWinAnsi(s.name), cw[2] - 3, 7.5, 5.2, pg.m, true);
    text(name.text, xs[2] + 1, mid + 2.5, name.size, { bold: true });
    let wasCut = name.cut;
    for (const [col, value] of [
      [3, s.time],
      [4, s.range],
      [6, s.notes],
    ] as const) {
      const lines = wrapSegs([{ t: toWinAnsi(value) }], cw[col] - 3, 5.5, pg.m).map((l) =>
        l.map((q) => q.t).join(''),
      );
      const shown = lines.slice(0, 3);
      if (lines.length > 3) {
        wasCut = true;
        shown[2] = fitText(
          shown.slice(2).concat(lines.slice(3)).join(' '),
          cw[col] - 3,
          5.2,
          5.2,
          pg.m,
        ).text;
      }
      const lead = 5.9;
      const first = mid + 2 - ((shown.length - 1) * lead) / 2;
      shown.forEach((t, n) => text(t, xs[col] + 1, first + n * lead, 5.2));
    }
    // C R M marks
    const mw = cw[5] / 3;
    (
      [
        ['C', s.concentration],
        ['R', s.ritual],
        ['M', s.material],
      ] as const
    ).forEach(([letter, on], n) => {
      const cx = xs[5] + n * mw + 6;
      pg.ops.push({ k: 'diamond', cx, cy: mid, r: 3.4, filled: on });
      text(letter, cx + 6, mid + 2, 5.5, { color: 'muted' });
    });
    if (wasCut) cut.push(s);
  });
  return Math.min(fit, rows.length);
}

// -- the composer ---------------------------------------------------------------------------------

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

interface Appendix {
  title: string;
  lines: string[];
}

export function composeSheetPdf(input: SheetPdfInput, measure: Measure): PdfPage[] {
  const appendix: Appendix[] = [];
  const spillAttacks: string[] = [];
  const p1 = new Pg(measure);
  const p2 = new Pg(measure);

  // pending: features whose full text goes to the extra pages
  const fullFeatures: PdfFeature[] = [];
  page1(p1, input, appendix, spillAttacks, fullFeatures);
  const spellOverflow = page2(p2, input, appendix);

  const pages: Pg[] = [p1, p2];
  const extras = composeExtras(input, measure, appendix, spillAttacks, fullFeatures, spellOverflow);
  pages.push(...extras);

  const total = pages.length;
  return pages.map((pg, i) => {
    footer(pg, input, i + 1, total);
    return { width: PAGE_W, height: PAGE_H, ops: pg.ops };
  });
}

function footer(pg: Pg, input: SheetPdfInput, n: number, total: number): void {
  pg.ops.push({
    k: 'text',
    x: PAGE_W - 15 * K,
    y: PAGE_H - 5,
    text: toWinAnsi(
      `${input.name || input.labels.noName} · ${input.labels.pageWord} ${n}/${total}`,
    ),
    size: 5,
    align: 'right',
    color: 'muted',
  });
}

function featureSummary(
  pg: Pg,
  list: { f: PdfFeature; index: number }[],
  width: number,
  size: number,
): { lines: FlowLine[]; more: Set<number> } {
  const lines: FlowLine[] = [];
  const more = new Set<number>();
  let source = '';
  for (const { f, index } of list) {
    if (f.source !== source) {
      source = f.source;
      lines.push(
        ...flowParagraph(
          pg,
          [{ t: source.toUpperCase(), b: true, c: 'accent' }],
          width,
          size - 0.6,
          index,
          list[0].f === f ? 0 : 4,
        ),
      );
    }
    const s = firstSentence(plainText(f.text));
    if (s.more) more.add(index);
    const segs: Seg[] = [
      { t: f.level ? `${f.name} (${f.level}). ` : `${f.name}. `, b: true },
      { t: s.text + (s.more ? ' …' : '') },
    ];
    const wrapped = flowParagraph(pg, segs, width, size, index, 2);
    // at most three lines per feature in the box; the full text is on the extra pages
    if (wrapped.length > 3) {
      more.add(index);
      const kept = wrapped.slice(0, 3);
      const last = kept[2];
      const t = last.segs.map((q) => q.t).join('');
      const cut = fitText(t + ' …', width, size, size, pg.m);
      last.segs = [{ t: cut.cut ? cut.text : t + ' …' }];
      lines.push(...kept);
    } else {
      lines.push(...wrapped);
    }
  }
  return { lines, more };
}

function page1(
  pg: Pg,
  d: SheetPdfInput,
  appendix: Appendix[],
  spillAttacks: string[],
  fullFeatures: PdfFeature[],
): void {
  const L = d.labels;

  // --- identity -----------------------------------------------------------------------------
  pg.box(15, 15, 343, 108);
  pg.fit(d.name || L.noName, 24, 46, 325, 14, { bold: true, min: 8 });
  pg.line(24, 50, 350, 50, 'soft');
  pg.caption(L.characterName, 24, 58);
  pg.fit(d.background, 24, 77, 165, 9, { bold: true, min: 5.5 });
  pg.line(24, 80, 192, 80, 'soft');
  pg.caption(L.background, 24, 88);
  pg.fit(d.classes, 202, 77, 148, 9, { bold: true, min: 5.5 });
  pg.line(202, 80, 350, 80, 'soft');
  pg.caption(L.class, 202, 88);
  pg.fit(d.species, 24, 107, 165, 9, { bold: true, min: 5.5 });
  pg.line(24, 110, 192, 110, 'soft');
  pg.caption(L.species, 24, 118);
  pg.fit(d.subclass, 202, 107, 148, 9, { bold: true, min: 5.5 });
  pg.line(202, 110, 350, 110, 'soft');
  pg.caption(L.subclass, 202, 118);

  pg.circle(385, 69, 41, { lw: 1.2 });
  pg.caption(L.level, 385, 43, 'center');
  pg.text(String(d.level), 385, 78, 24, { bold: true, align: 'center', color: 'accent' });
  pg.line(364, 98, 406, 98, 'soft');
  pg.caption(L.xp, 385, 106, 'center');

  // armor class
  pg.box(435, 15, 80, 108, { r: 14 });
  pg.wrapped(L.armorClass, 475, 31, 66, 6.2);
  pg.text(String(d.armorClass), 475, 80, 26, { bold: true, align: 'center', color: 'accent' });
  pg.diamond(455, 111, 4.5, d.shield);
  pg.caption(L.shield, 463, 113.5);

  // hit points
  pg.box(520, 15, 305, 108);
  pg.line(676, 15, 676, 123);
  pg.line(744, 15, 744, 123);
  pg.heading(L.hitPoints, 520, 156, 30, 6.8);
  pg.text(String(d.hp.current), 559, 84, 22, { bold: true, align: 'center' });
  pg.line(532, 90, 588, 90, 'soft');
  pg.caption(L.hpCurrent, 560, 100, 'center');
  pg.text(d.hp.temp ? String(d.hp.temp) : '', 640, 66, 11, { bold: true, align: 'center' });
  pg.line(610, 69, 668, 69, 'soft');
  pg.caption(L.hpTemp, 640, 77, 'center');
  pg.text(String(d.hp.max), 640, 97, 11, { bold: true, align: 'center' });
  pg.line(610, 100, 668, 100, 'soft');
  pg.caption(L.hpMax, 640, 108, 'center');
  pg.wrapped(L.hitDice, 710, 28, 62, 6.2);
  pg.fit(d.hitDice.total, 710, 66, 60, 11, { bold: true, align: 'center', min: 6 });
  pg.line(686, 69, 734, 69, 'soft');
  pg.caption(L.hdTotal, 710, 77, 'center');
  pg.text(String(d.hitDice.spent), 710, 97, 11, { bold: true, align: 'center' });
  pg.line(686, 100, 734, 100, 'soft');
  pg.caption(L.hdSpent, 710, 108, 'center');
  pg.wrapped(L.deathSaves, 785, 28, 74, 6.2);
  for (let n = 0; n < 3; n++) {
    pg.diamond(764 + n * 21, 61, 6, n < d.deathSaves.successes);
    pg.diamond(764 + n * 21, 87, 6, n < d.deathSaves.failures);
  }
  pg.caption(L.successes, 785, 75, 'center');
  pg.caption(L.failures, 785, 101, 'center');

  // --- left columns: proficiency, abilities ------------------------------------------------------
  pg.box(15, 155, 137, 95);
  pg.wrapped(L.proficiencyBonus, 83.5, 171, 118, 6.2);
  pg.text(signed(d.proficiencyBonus), 83.5, 209, 20, {
    bold: true,
    align: 'center',
    color: 'accent',
  });
  const legend: [string, 'none' | 'full' | 'expertise' | 'half'][] = [
    [L.legendNone, 'none'],
    [L.legendProficient, 'full'],
    [L.legendHalf, 'half'],
    [L.legendExpertise, 'expertise'],
  ];
  legend.forEach(([label, kind], i) => {
    const lx = 24 + (i % 2) * 64;
    const ly = 224 + Math.floor(i / 2) * 14;
    mark(pg, lx + 3, ly - 2, kind);
    pg.fit(label, lx + 12, ly, 52, 5.4, { color: 'muted', min: 4 });
  });

  const boxes: { x: number; y: number; w: number; h: number; i: number }[] = [
    { x: 15, y: 262, w: 137, h: 153, i: 0 },
    { x: 15, y: 425, w: 137, h: 195, i: 1 },
    { x: 15, y: 630, w: 137, h: 125, i: 2 },
    { x: 163, y: 155, w: 132, h: 227, i: 3 },
    { x: 163, y: 397, w: 132, h: 228, i: 4 },
    { x: 163, y: 640, w: 132, h: 210, i: 5 },
  ];
  for (const b of boxes) abilityBox(pg, d.abilities[b.i], b, L);

  // heroic inspiration
  pg.box(15, 765, 137, 85);
  pg.wrapped(L.heroicInspiration, 83.5, 781, 118, 6.2);
  pg.diamond(83.5, 825, 17, false, 'line');
  pg.diamond(83.5, 825, 11, d.inspiration, d.inspiration ? 'accent' : 'soft');

  // --- the four combat boxes -------------------------------------------------------------------
  const combat: [string, string, number, number][] = [
    [L.initiative, signed(d.initiative), 308, 117],
    [L.speed, d.speed, 435, 125],
    [L.size, d.size, 570, 118],
    [L.passivePerception, String(d.passivePerception), 697, 125],
  ];
  for (const [label, value, x, w] of combat) {
    pg.box(x, 155, w, 57);
    pg.fit(label.toUpperCase(), x + w / 2, 170, w - 14, 6.4, {
      bold: true,
      align: 'center',
      min: 4.5,
    });
    pg.line(x + 8, 175, x + w - 8, 175, 'soft');
    pg.fit(value, x + w / 2, 203, w - 16, 17, {
      bold: true,
      align: 'center',
      color: 'accent',
      min: 7,
    });
  }

  // --- attacks ----------------------------------------------------------------------------------
  pg.box(308, 228, 514, 212);
  pg.heading(L.weaponsTitle, 308, 514, 243);
  const cols = [316, 470, 536, 644];
  const colW = [146, 56, 100, 170];
  [L.attName, L.attBonus, L.attDamage, L.attNotes].forEach((h, i) =>
    pg.fit(h, cols[i], 266, colW[i], 5.4, { color: 'muted', min: 4, align: 'left' }),
  );
  const rowsFit = 6;
  for (let i = 0; i < rowsFit; i++) {
    const top = 272 + i * 27;
    cols.forEach((cx, c) => pg.line(cx, top + 25, cx + colW[c], top + 25, 'soft', 0.5));
  }
  d.attacks.slice(0, rowsFit).forEach((a, i) => {
    const top = 272 + i * 27;
    cols.forEach((cx, c) => pg.line(cx, top + 25, cx + colW[c], top + 25, 'soft', 0.5));
    const cutName = pg.fit(a.name, cols[0], top + 19, colW[0], 7.5, { bold: true, min: 5.2 });
    pg.text(signed(a.bonus), cols[1] + colW[1] / 2, top + 20, 9, { bold: true, align: 'center' });
    const cutDmg = pg.fit(a.damage, cols[2], top + 19, colW[2], 7, { min: 5 });
    const lines = wrapSegs([{ t: toWinAnsi(a.notes) }], colW[3] * K, 5.3, pg.m).map((l) =>
      l.map((q) => q.t).join(''),
    );
    let cutNotes = false;
    const shown = lines.slice(0, 3);
    if (lines.length > 3) {
      cutNotes = true;
      shown[2] = fitText(
        shown[2] + ' ' + lines.slice(3).join(' '),
        colW[3] * K,
        5.3,
        5.3,
        pg.m,
      ).text;
    }
    shown.forEach((t, n) => pg.text(t, cols[3], top + 8 + (n * 5.9) / K, 5.3, {}));
    if (cutName || cutDmg || cutNotes) {
      spillAttacks.push(`${a.name}: ${signed(a.bonus)}, ${a.damage}. ${a.notes}`.trim());
    }
  });
  if (d.attacks.length > rowsFit) {
    d.attacks.slice(rowsFit).forEach((a) => {
      spillAttacks.push(`${a.name}: ${signed(a.bonus)}, ${a.damage}. ${a.notes}`.trim());
    });
    pg.text(L.continues, 814, 437, 5, { align: 'right', color: 'accent', bold: true });
  }

  // --- features ---------------------------------------------------------------------------------
  const group = (types: ('class' | 'species' | 'feat')[]) =>
    d.features.map((f, index) => ({ f, index })).filter(({ f }) => types.includes(f.group));
  const placeFeatures = (
    list: { f: PdfFeature; index: number }[],
    regs: Region[],
    note: Region,
  ): void => {
    const { lines, more } = featureSummary(pg, list, regs[0].w, 6.2);
    const all = placeLines(pg, lines, regs, 0, false);
    let missing = new Set<number>();
    if (all < lines.length) {
      // a feature cut in the middle counts as missing: its full text goes to the extra pages
      const placed = placeLines(pg, lines, regs, 5 * 1.3, true);
      missing = new Set(lines.slice(placed).map((l) => l.ref));
      pg.ops.push({
        k: 'text',
        x: note.x + note.w,
        y: note.y + note.h - 1.5,
        text: toWinAnsi(L.continues),
        size: 5,
        bold: true,
        align: 'right',
        color: 'accent',
      });
    } else {
      placeLines(pg, lines, regs, 0, true);
    }
    for (const { f, index } of list) {
      if (more.has(index) || missing.has(index)) fullFeatures.push(f);
    }
  };
  pg.box(308, 455, 514, 320);
  pg.heading(L.classFeatures, 308, 514, 471);
  pg.line(565, 487, 565, 768, 'soft', 0.5);
  const cf = [region(316, 486, 242, 282), region(572, 486, 242, 282)];
  placeFeatures(group(['class']), cf, region(572, 486, 242, 282));
  pg.box(308, 790, 242, 270);
  pg.heading(L.speciesTraits, 308, 242, 805);
  placeFeatures(group(['species']), [region(316, 821, 228, 232)], region(316, 821, 228, 232));
  pg.box(565, 790, 257, 270);
  pg.heading(L.feats, 565, 257, 805);
  placeFeatures(group(['feat']), [region(573, 821, 243, 232)], region(573, 821, 243, 232));

  // --- training and proficiencies ---------------------------------------------------------------
  pg.box(15, 858, 280, 202);
  pg.heading(L.equipTraining, 15, 280, 874, 6.6);
  pg.caption(L.armorTraining, 23, 898);
  const armor: [string, boolean, number][] = [
    [L.light, d.armorTraining.light, 82],
    [L.medium, d.armorTraining.medium, 131],
    [L.heavy, d.armorTraining.heavy, 188],
    [L.shields, d.armorTraining.shields, 235],
  ];
  for (const [label, on, x] of armor) {
    pg.diamond(x + 4, 897, 4.5, on);
    pg.fit(label, x + 11, 899.5, 48, 6.6, { min: 4.5 });
  }
  pg.line(22, 905, 288, 905, 'soft', 0.5);
  pg.caption(L.weapons, 23, 916);
  textBox(
    pg,
    d.weapons ? [d.weapons] : [],
    region(23, 920, 265, 74),
    6.6,
    L.continues,
    appendix,
    L.appendixWeapons,
  );
  pg.line(22, 998, 288, 998, 'line', 0.8);
  pg.caption(L.tools, 23, 1008);
  textBox(
    pg,
    d.tools ? [d.tools] : [],
    region(23, 1012, 265, 43),
    6.6,
    L.continues,
    appendix,
    L.appendixTools,
  );
}

function mark(pg: Pg, cx: number, cy: number, kind: Proficiency): void {
  const r = 5;
  if (kind === 'expertise') {
    pg.circle(cx, cy, r + 2, { stroke: 'line', lw: 0.6 });
    pg.circle(cx, cy, r - 0.5, { fill: 'ink', stroke: 'ink' });
  } else if (kind === 'full') {
    pg.circle(cx, cy, r, { fill: 'ink', stroke: 'ink' });
  } else if (kind === 'half') {
    pg.circle(cx, cy, r, { stroke: 'line' });
    pg.ops.push({ k: 'half', cx: cx * K, cy: cy * K, r: r * K, fill: 'ink' });
  } else {
    pg.circle(cx, cy, r, { stroke: 'line' });
  }
}

function abilityBox(
  pg: Pg,
  a: PdfAbility,
  b: { x: number; y: number; w: number; h: number },
  L: PdfLabels,
): void {
  const { x, y, w, h } = b;
  pg.box(x, y, w, h);
  pg.fit(a.name.toUpperCase(), x + w / 2, y + 17, w - 14, 7.6, {
    bold: true,
    align: 'center',
    min: 5,
  });
  pg.line(x + 6, y + 24, x + w - 6, y + 24, 'line', 0.8);
  pg.circle(x + 45, y + 64, 30, { lw: 1.2 });
  pg.text(signed(a.modifier), x + 45, y + 72, 18, { bold: true, align: 'center', color: 'accent' });
  pg.caption(L.modifier, x + 45, y + 106, 'center');
  pg.box(x + w - 50, y + 46, 40, 30, { r: 5, lw: 1 });
  pg.text(String(a.score), x + w - 30, y + 66, 13, { bold: true, align: 'center' });
  pg.caption(L.score, x + w - 30, y + 90, 'center');
  const rows: { label: string; mod: number; prof: Proficiency; bold?: boolean }[] = [
    {
      label: L.savingThrow,
      mod: a.save.modifier,
      prof: a.save.proficient ? 'full' : 'none',
      bold: true,
    },
    ...a.skills.map((s) => ({ label: s.name, mod: s.modifier, prof: s.proficiency })),
  ];
  const top = y + 119;
  const pitch = Math.min(21, (h - 119 - 5) / rows.length);
  rows.forEach((r, i) => {
    const base = top + i * pitch + pitch * 0.55;
    mark(pg, x + 13, base - 2.4, r.prof);
    pg.line(x + 23, base + 1.5, x + 44, base + 1.5, 'soft', 0.5);
    pg.text(signed(r.mod), x + 33.5, base, 8, { bold: true, align: 'center' });
    pg.fit(r.label, x + 49, base, w - 49 - 5, 6.8, { bold: r.bold, min: 4.8 });
    if (i === 0 && rows.length > 1) pg.line(x + 6, base + 5, x + w - 6, base + 5, 'soft', 0.5);
  });
}

// -- page 2 ----------------------------------------------------------------------------------------

/** Returns the spells that did not fit the list. */
function page2(pg: Pg, d: SheetPdfInput, appendix: Appendix[]): PdfSpell[] {
  const L = d.labels;
  const sc = d.spellcasting;

  // spellcasting box
  pg.box(15, 15, 175, 165);
  if (sc && sc.classes.length === 1) {
    const c = sc.classes[0];
    pg.fit(c.ability, 102, 44, 155, 10, { bold: true, align: 'center', min: 6 });
    pg.line(24, 48, 181, 48, 'soft');
    pg.caption(L.spellAbility, 102, 57, 'center');
    const rows: [string, string][] = [
      [L.spellMod, signed(c.modifier)],
      [L.spellDc, String(c.dc)],
      [L.spellAttack, signed(c.attack)],
    ];
    rows.forEach(([label, value], i) => {
      const top = 64 + i * 38.5;
      pg.line(15, top, 190, top, 'line', 0.8);
      pg.line(68, top, 68, top + 38.5, 'line', 0.8);
      pg.text(value, 41.5, top + 26, 17, { bold: true, align: 'center', color: 'accent' });
      pg.wrapped(label, 129, top + 17, 112, 6.6, { lead: 8.5 });
    });
  } else if (sc) {
    pg.heading(L.spellcasting, 15, 175, 30, 6.8);
    const xs = [22, 92, 116, 141, 165];
    [L.class, L.abilityShort, L.modShort, L.dcShort, L.atkShort].forEach((h, i) =>
      pg.fit(h, xs[i], 52, (xs[i + 1] ?? 188) - xs[i] - 2, 5.2, { color: 'muted', min: 3.6 }),
    );
    sc.classes.slice(0, 7).forEach((c, i) => {
      const y = 70 + i * 15;
      pg.line(22, y + 4, 183, y + 4, 'soft', 0.5);
      pg.fit(c.name, xs[0], y, 68, 6.6, { bold: true, min: 4.5 });
      pg.fit(c.abbr, xs[1], y, 22, 6.6, { min: 4.5 });
      pg.text(signed(c.modifier), xs[2], y, 7.5, { bold: true });
      pg.text(String(c.dc), xs[3], y, 7.5, { bold: true });
      pg.text(signed(c.attack), xs[4], y, 7.5, { bold: true });
    });
  } else {
    pg.heading(L.spellcasting, 15, 175, 30, 6.8);
  }

  // banner
  pg.box(205, 15, 345, 47, { fill: 'tint', r: 8 });
  pg.fit(d.name || L.noName, 377.5, 38, 320, 17, {
    bold: true,
    align: 'center',
    color: 'accent',
    min: 8,
  });
  pg.fit(`${d.classes}${d.species ? ' · ' + d.species : ''}`, 377.5, 53, 320, 7.5, {
    align: 'center',
    color: 'muted',
    min: 5,
  });

  // slots
  pg.box(205, 77, 345, 118);
  pg.heading(L.spellSlots, 205, 345, 92, 7);
  for (let c = 0; c < 3; c++) {
    const x0 = 213 + c * 114;
    pg.caption(L.slotTotal, x0 + 40, 111, 'center');
    pg.caption(L.slotSpent, x0 + 82, 111, 'center');
    for (let r = 0; r < 3; r++) {
      const level = c * 3 + r + 1;
      const slot = sc?.slots[level - 1] ?? { total: 0, spent: 0 };
      const y = 130 + r * 20;
      pg.fit(`${L.slotLevel} ${level}`, x0, y, 30, 6.4, { bold: true, min: 4.5 });
      pg.line(x0 + 33, y + 2, x0 + 48, y + 2, 'soft', 0.5);
      pg.text(String(slot.total), x0 + 40.5, y, 8, { bold: true, align: 'center' });
      for (let n = 0; n < Math.min(slot.total, 6); n++) {
        pg.diamond(x0 + 58 + n * 11, y - 2.5, 4.3, n < slot.spent);
      }
    }
  }
  if (sc?.pact) {
    pg.fit(`${L.pact}: ${sc.pact.total} (${L.slotLevel} ${sc.pact.level})`, 213, 188, 250, 6.4, {
      bold: true,
      min: 4.5,
    });
    for (let n = 0; n < Math.min(sc.pact.total, 6); n++) {
      pg.diamond(500 + n * 11, 185.5, 4.3, n < sc.pact.spent);
    }
  }

  // spell list
  pg.box(15, 205, 535, 855);
  pg.heading(L.spellList, 15, 535, 221);
  if (sc?.summary) pg.text(sc.summary, 541, 221, 5.8, { align: 'right', color: 'muted' });
  const x = 22 * K;
  const w = 521 * K;
  spellHeader(pg, x, 243 * K, w, L);
  const cut: PdfSpell[] = [];
  const placed = spellRows(pg, d.spells, x, 248 * K, w, (1056 - 248) * K, L, cut);
  // rows whose text was cut with "…": the whole line goes to the extra pages
  if (cut.length) {
    appendix.push({
      title: L.appendixSpells,
      lines: cut.map(
        (s) => `${s.name} (${[s.time, s.range].filter(Boolean).join('; ')}): ${s.notes}`,
      ),
    });
  }
  const rest = d.spells.slice(placed);
  if (rest.length) {
    pg.text(L.continues, 543, 1052, 5, { align: 'right', color: 'accent', bold: true });
  }

  // appearance (to write on)
  pg.box(565, 15, 257, 133);
  pg.heading(L.appearance, 565, 257, 30);
  // notes
  pg.box(565, 165, 257, 265);
  pg.heading(L.backstory, 565, 257, 181);
  textBox(
    pg,
    d.notes.replace(/\r/g, '').split('\n'),
    region(573, 193, 243, 190),
    6.6,
    L.continues,
    appendix,
    L.appendixNotes,
  );
  pg.caption(L.alignment, 573, 396);
  pg.line(573, 420, 814, 420, 'soft');
  // languages
  pg.box(565, 450, 257, 75);
  pg.heading(L.languages, 565, 257, 466);
  textBox(
    pg,
    d.languages ? [d.languages] : [],
    region(573, 478, 243, 42),
    6.6,
    L.continues,
    appendix,
    L.appendixLanguages,
  );
  // equipment
  pg.box(565, 540, 257, 375);
  pg.heading(L.equipment, 565, 257, 556);
  textBox(
    pg,
    d.equipment,
    region(573, 568, 243, 242),
    6.4,
    L.continues,
    appendix,
    L.appendixEquipment,
  );
  pg.caption(L.attunement, 573, 826);
  for (let n = 0; n < 3; n++) {
    pg.diamond(580, 846 + n * 25, 5, false);
    pg.line(592, 849 + n * 25, 814, 849 + n * 25, 'soft');
  }
  // coins
  pg.box(565, 930, 257, 105);
  pg.heading(L.coins, 565, 257, 946);
  const coins: [string, number][] = [
    [L.coinCP, d.coins.cp],
    [L.coinSP, d.coins.sp],
    [L.coinEP, d.coins.ep],
    [L.coinGP, d.coins.gp],
    [L.coinPP, d.coins.pp],
  ];
  coins.forEach(([label, value], i) => {
    const bx = 572 + i * 49.5;
    pg.caption(label, bx + 22, 972, 'center');
    pg.box(bx, 978, 44, 38, { r: 5 });
    pg.fit(String(value), bx + 22, 1002, 38, 10, { bold: true, align: 'center', min: 5 });
  });
  return rest;
}

// -- extra pages -------------------------------------------------------------------------------------

function composeExtras(
  d: SheetPdfInput,
  m: Measure,
  appendix: Appendix[],
  spillAttacks: string[],
  fullFeatures: PdfFeature[],
  spells: PdfSpell[],
): Pg[] {
  const L = d.labels;
  const pages: Pg[] = [];
  const titleBar = (pg: Pg, title: string) => {
    pg.ops.push({
      k: 'rect',
      x: 30,
      y: 26,
      w: PAGE_W - 60,
      h: 24,
      r: 6,
      fill: 'tint',
      stroke: 'line',
      lw: 0.8,
    });
    pg.ops.push({
      k: 'text',
      x: 40,
      y: 42,
      text: toWinAnsi(d.name || L.noName),
      size: 11,
      bold: true,
      color: 'accent',
      align: 'left',
    });
    pg.ops.push({
      k: 'text',
      x: PAGE_W - 40,
      y: 42,
      text: toWinAnsi(title),
      size: 8,
      bold: true,
      color: 'ink',
      align: 'right',
    });
  };

  // spells that did not fit page 2: the same table, full width
  let rest = spells;
  while (rest.length) {
    const pg = new Pg(m);
    pages.push(pg);
    titleBar(pg, `${L.appendixSpells}`);
    pg.ops.push({
      k: 'rect',
      x: 30,
      y: 62,
      w: PAGE_W - 60,
      h: PAGE_H - 62 - 30,
      r: 6,
      stroke: 'line',
      lw: 0.9,
    });
    spellHeader(pg, 38, 78, PAGE_W - 76, L);
    const n = spellRows(pg, rest, 38, 83, PAGE_W - 76, PAGE_H - 83 - 40, L);
    rest = rest.slice(n);
  }

  // text: attacks, features, then what spilled out of the boxes
  const sections: { title: string; paragraphs: Para[] }[] = [];
  if (spillAttacks.length) {
    sections.push({ title: L.appendixAttacks, paragraphs: spillAttacks.map((t) => ({ text: t })) });
  }
  const seen = new Set<PdfFeature>();
  const feats = fullFeatures.filter((f) => (seen.has(f) ? false : (seen.add(f), true)));
  if (feats.length) {
    const paragraphs: Para[] = [];
    let source = '';
    for (const f of feats) {
      if (f.source !== source) {
        source = f.source;
        paragraphs.push({ text: source.toUpperCase(), kind: 'source' });
      }
      paragraphs.push({ text: f.level ? `${f.name} (${f.level})` : f.name, kind: 'name' });
      for (const p of plainText(f.text)) paragraphs.push({ text: p });
    }
    sections.push({ title: L.appendixFeatures, paragraphs });
  }
  for (const a of appendix) {
    sections.push({ title: a.title, paragraphs: a.lines.map((t) => ({ text: t })) });
  }

  const flow: FlowLine[] = [];
  const colW = (PAGE_W - 60 - 14) / 2;
  const scratch = new Pg(m);
  let ref = 0;
  for (const s of sections) {
    flow.push(
      ...flowParagraph(
        scratch,
        [{ t: s.title.toUpperCase(), b: true, c: 'accent' }],
        colW,
        8.5,
        ref++,
        10,
      ),
    );
    for (const p of s.paragraphs) {
      if (p.kind === 'source') {
        flow.push(
          ...flowParagraph(scratch, [{ t: p.text, b: true, c: 'accent' }], colW, 7, ref++, 6),
        );
      } else if (p.kind === 'name') {
        flow.push(...flowParagraph(scratch, [{ t: p.text, b: true }], colW, 7.4, ref++, 5));
      } else {
        flow.push(...flowParagraph(scratch, [{ t: p.text }], colW, 6.8, ref++, 2.2));
      }
    }
  }
  let from = 0;
  while (from < flow.length) {
    const pg = new Pg(m);
    pages.push(pg);
    titleBar(pg, sections.map((s) => s.title).join(' · '));
    const regs: Region[] = [
      { x: 30, y: 64, w: colW, h: PAGE_H - 64 - 34 },
      { x: 30 + colW + 14, y: 64, w: colW, h: PAGE_H - 64 - 34 },
    ];
    const rem = flow.slice(from);
    const n = placeLines(pg, rem, regs, 0, true);
    if (n === 0) break; // cannot happen: one line always fits a page
    from += n;
  }
  return pages;
}

interface Para {
  text: string;
  kind?: 'source' | 'name';
}
