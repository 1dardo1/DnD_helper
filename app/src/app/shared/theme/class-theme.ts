/**
 * Class and subclass themes: every class has a hand-made theme (colour, motif)
 * and every subclass gets its own variation of it: hand-picked where the name suggests a clear
 * motif, otherwise derived deterministically from the subclass id.
 *
 * Pure data → CSS custom properties; `ClassThemeDirective` applies them and `themes.scss`
 * draws the motifs.
 */

/** Ornaments drawn by themes.scss (one small SVG each). */
export const MOTIFS = [
  'arrow',
  'bolt',
  'book',
  'claw',
  'cross',
  'crown',
  'crystal',
  'dagger',
  'drop',
  'enso',
  'eye',
  'feather',
  'flame',
  'gear',
  'hammer',
  'heart',
  'hourglass',
  'leaf',
  'mask',
  'moon',
  'mountain',
  'note',
  'paw',
  'rune',
  'scales',
  'shield',
  'skull',
  'snowflake',
  'spark',
  'spiral',
  'star',
  'sun',
  'sword',
  'tentacle',
  'tree',
  'wave',
  'web',
  'gears',
  'axe',
  'fist',
  'bow',
  'scroll',
  'hat',
  'stars',
] as const;
export type Motif = (typeof MOTIFS)[number];

interface ClassDef {
  /** Base hue (0-359) and saturation (%). */
  hue: number;
  sat: number;
  /** First motif is the class's own; the rest are used for derived subclass variations. */
  motifs: readonly Motif[];
}

export const CLASS_THEMES: Record<string, ClassDef> = {
  artificer: {
    hue: 28,
    sat: 62,
    motifs: ['gears', 'hammer', 'crystal', 'book', 'bolt'],
  },
  barbarian: {
    hue: 12,
    sat: 68,
    motifs: ['axe', 'claw', 'flame', 'mountain', 'paw'],
  },
  bard: {
    hue: 305,
    sat: 52,
    motifs: ['note', 'mask', 'star', 'feather', 'heart'],
  },
  'blood-hunter': {
    hue: 352,
    sat: 78,
    motifs: ['drop', 'skull', 'eye', 'paw', 'flame'],
  },
  cleric: {
    hue: 42,
    sat: 72,
    motifs: ['cross', 'sun', 'crown', 'heart', 'scales'],
  },
  druid: { hue: 118, sat: 42, motifs: ['leaf', 'tree', 'moon', 'paw', 'wave'] },
  fighter: {
    hue: 212,
    sat: 32,
    motifs: ['sword', 'shield', 'arrow', 'crown', 'hammer'],
  },
  monk: { hue: 190, sat: 60, motifs: ['fist', 'enso', 'wave', 'sun', 'leaf'] },
  paladin: {
    hue: 222,
    sat: 62,
    motifs: ['shield', 'cross', 'sun', 'crown', 'sword'],
  },
  psion: {
    hue: 282,
    sat: 48,
    motifs: ['spiral', 'crystal', 'eye', 'star', 'bolt'],
  },
  ranger: {
    hue: 88,
    sat: 42,
    motifs: ['bow', 'arrow', 'leaf', 'paw', 'tree'],
  },
  rogue: {
    hue: 192,
    sat: 24,
    motifs: ['dagger', 'mask', 'eye', 'web', 'moon'],
  },
  sorcerer: {
    hue: 335,
    sat: 66,
    motifs: ['stars', 'spark', 'flame', 'bolt', 'wave'],
  },
  warlock: {
    hue: 266,
    sat: 56,
    motifs: ['scroll', 'eye', 'tentacle', 'skull', 'moon'],
  },
  wizard: {
    hue: 236,
    sat: 52,
    motifs: ['hat', 'rune', 'book', 'star', 'hourglass'],
  },
};

/** Secondary hue of each class (ornaments). */
export const CLASS_HUE2: Record<string, number> = {
  artificer: 200,
  barbarian: 38,
  bard: 45,
  'blood-hunter': 20,
  cleric: 210,
  druid: 32,
  fighter: 8,
  monk: 24,
  paladin: 44,
  psion: 185,
  ranger: 28,
  rogue: 355,
  sorcerer: 42,
  warlock: 140,
  wizard: 45,
};

interface SubclassDef {
  hue: number;
  motif: Motif;
  /** Secondary hue (ornament band); derived from the id when absent. */
  hue2?: number;
}

/** Subclasses whose name suggests a clear motif. The rest are derived (see themeFor). */
export const SUBCLASS_THEMES: Record<string, SubclassDef> = {
  // artificer
  'artificer/alchemist-ua': { hue: 145, motif: 'drop' },
  'artificer/armorer-ua': { hue: 210, motif: 'shield' },
  'artificer/artillerist-ua': { hue: 8, motif: 'flame' },
  'artificer/battle-smith-ua': { hue: 30, motif: 'hammer' },
  'artificer/cartographer-ua': { hue: 48, motif: 'arrow' },
  'artificer/reanimator-ua': { hue: 100, motif: 'bolt' },
  'artificer/archivist-ua': { hue: 230, motif: 'book' },
  // barbarian
  'barbarian/path-of-the-zealot': { hue: 38, motif: 'flame', hue2: 50 },
  'barbarian/path-of-the-berserker': { hue: 0, motif: 'claw', hue2: 20 },
  'barbarian/path-of-the-wild-heart': { hue: 95, motif: 'paw' },
  'barbarian/path-of-the-world-tree': { hue: 130, motif: 'tree' },
  'barbarian/path-of-the-giant': { hue: 30, motif: 'mountain' },
  'barbarian/path-of-the-storm-herald-ua': { hue: 205, motif: 'bolt' },
  'barbarian/path-of-wild-magic': { hue: 290, motif: 'spark' },
  'barbarian/path-of-the-beast': { hue: 20, motif: 'paw', hue2: 0 },
  'barbarian/path-of-the-ancestral-guardian-ua': { hue: 190, motif: 'shield' },
  'barbarian/path-of-unlight-ua': { hue: 250, motif: 'moon' },
  'barbarian/path-of-lament-ua': { hue: 215, motif: 'drop' },
  // bard
  'bard/college-of-lore': { hue: 230, motif: 'book' },
  'bard/college-of-valor': { hue: 0, motif: 'sword' },
  'bard/college-of-swords': { hue: 200, motif: 'dagger' },
  'bard/college-of-glamour': { hue: 320, motif: 'star' },
  'bard/college-of-whispers': { hue: 260, motif: 'mask' },
  'bard/college-of-spirits': { hue: 185, motif: 'eye' },
  'bard/college-of-the-moon': { hue: 225, motif: 'moon' },
  'bard/college-of-dance': { hue: 340, motif: 'spiral' },
  'bard/college-of-eloquence': { hue: 275, motif: 'feather' },
  'bard/college-of-creation': { hue: 45, motif: 'spark' },
  // blood hunter
  'blood-hunter/order-of-the-ghostslayer': { hue: 190, motif: 'skull', hue2: 175 },
  'blood-hunter/order-of-the-lycan': { hue: 25, motif: 'paw', hue2: 40 },
  'blood-hunter/order-of-the-mutant': { hue: 110, motif: 'drop', hue2: 80 },
  'blood-hunter/order-of-the-profane-soul': { hue: 280, motif: 'eye', hue2: 350 },
  // cleric
  'cleric/life-domain': { hue: 140, motif: 'heart' },
  'cleric/light-domain': { hue: 48, motif: 'sun', hue2: 30 },
  'cleric/death-domain': { hue: 270, motif: 'skull' },
  'cleric/grave-domain': { hue: 200, motif: 'hourglass' },
  'cleric/tempest-domain': { hue: 210, motif: 'bolt' },
  'cleric/trickery-domain': { hue: 300, motif: 'mask' },
  'cleric/war-domain': { hue: 5, motif: 'sword' },
  'cleric/knowledge-domain': { hue: 225, motif: 'book' },
  'cleric/nature-domain': { hue: 110, motif: 'leaf' },
  'cleric/forge-domain': { hue: 18, motif: 'hammer' },
  'cleric/order-domain': { hue: 220, motif: 'scales' },
  'cleric/peace-domain': { hue: 170, motif: 'heart', hue2: 200 },
  'cleric/twilight-domain': { hue: 250, motif: 'moon' },
  'cleric/arcana-domain': { hue: 260, motif: 'rune' },
  'cleric/fate-domain-ua': { hue: 290, motif: 'web' },
  'cleric/protection-domain-ua': { hue: 205, motif: 'shield' },
  'cleric/pestilence-domain-ua': { hue: 75, motif: 'drop' },
  'cleric/ambition-domain-amonkhet': { hue: 30, motif: 'crown' },
  'cleric/strength-domain-amonkhet': { hue: 10, motif: 'mountain' },
  // druid
  'druid/circle-of-the-moon': { hue: 228, motif: 'moon', hue2: 200 },
  'druid/circle-of-the-land': { hue: 75, motif: 'mountain' },
  'druid/circle-of-the-sea': { hue: 190, motif: 'wave' },
  'druid/circle-of-the-stars': { hue: 245, motif: 'star' },
  'druid/circle-of-wildfire': { hue: 18, motif: 'flame' },
  'druid/circle-of-dreams': { hue: 285, motif: 'spiral' },
  'druid/circle-of-the-shepherd': { hue: 60, motif: 'paw' },
  'druid/circle-of-spores-ua': { hue: 320, motif: 'web' },
  'druid/circle-of-twilight-ua': { hue: 265, motif: 'skull' },
  'druid/circle-of-the-primeval-ua': { hue: 100, motif: 'claw' },
  'druid/circle-of-the-titan-ua14-18-06-2026': { hue: 35, motif: 'mountain', hue2: 120 },
  'druid/circle-of-preservation-ua': { hue: 150, motif: 'tree' },
  // fighter
  'fighter/champion': { hue: 45, motif: 'crown' },
  'fighter/battle-master': { hue: 0, motif: 'scales' },
  'fighter/eldritch-knight': { hue: 255, motif: 'rune' },
  'fighter/psi-warrior': { hue: 285, motif: 'crystal' },
  'fighter/arcane-archer': { hue: 160, motif: 'arrow' },
  'fighter/banneret': { hue: 220, motif: 'shield', hue2: 45 },
  'fighter/purple-dragon-knight-ua': { hue: 275, motif: 'shield' },
  'fighter/cavalier-ua': { hue: 30, motif: 'shield' },
  'fighter/echo-knight': { hue: 190, motif: 'spiral' },
  'fighter/rune-knight': { hue: 200, motif: 'rune', hue2: 30 },
  'fighter/samurai': { hue: 355, motif: 'enso' },
  'fighter/sharpshooter': { hue: 95, motif: 'arrow', hue2: 0 },
  'fighter/monster-hunter': { hue: 20, motif: 'claw' },
  'fighter/hell-knight-ua14-18-06-2026': { hue: 8, motif: 'flame' },
  'fighter/sorrow-knight': { hue: 230, motif: 'drop' },
  'fighter/gladiator-ua': { hue: 35, motif: 'sword', hue2: 0 },
  'fighter/brute': { hue: 15, motif: 'hammer' },
  // monk
  'monk/warrior-of-the-open-hand': { hue: 35, motif: 'enso', hue2: 15 },
  'monk/warrior-of-shadow': { hue: 250, motif: 'moon' },
  'monk/warrior-of-the-elements': { hue: 190, motif: 'wave', hue2: 15 },
  'monk/warrior-of-mercy': { hue: 160, motif: 'heart' },
  'monk/way-of-the-sun-soul': { hue: 45, motif: 'sun' },
  'monk/way-of-the-long-death': { hue: 280, motif: 'skull' },
  'monk/way-of-the-drunken-master': { hue: 60, motif: 'spiral' },
  'monk/way-of-the-kensei': { hue: 355, motif: 'sword' },
  'monk/way-of-the-astral-self': { hue: 265, motif: 'star' },
  'monk/way-of-the-ascendant-dragon': { hue: 10, motif: 'flame' },
  'monk/way-of-tranquility': { hue: 175, motif: 'leaf' },
  'monk/warrior-of-venom-ua': { hue: 95, motif: 'drop' },
  'monk/warrior-of-the-mystic-arts': { hue: 240, motif: 'rune' },
  'monk/tattooed-warrior-ua8-18-09-25': { hue: 200, motif: 'feather' },
  // paladin
  'paladin/oath-of-vengeance': { hue: 355, motif: 'sword', hue2: 15 },
  'paladin/oath-of-devotion': { hue: 210, motif: 'cross', hue2: 45 },
  'paladin/oath-of-the-ancients': { hue: 120, motif: 'tree' },
  'paladin/oath-of-glory': { hue: 42, motif: 'star' },
  'paladin/oath-of-conquest': { hue: 0, motif: 'crown', hue2: 270 },
  'paladin/oath-of-redemption': { hue: 175, motif: 'heart' },
  'paladin/oath-of-the-crown': { hue: 48, motif: 'crown' },
  'paladin/oath-of-the-watchers': { hue: 250, motif: 'eye' },
  'paladin/oath-of-the-noble-genies': { hue: 190, motif: 'spark' },
  'paladin/oathbreaker-ua': { hue: 290, motif: 'skull' },
  'paladin/oath-of-treachery-ua': { hue: 310, motif: 'dagger' },
  'paladin/oath-of-heroism-ua': { hue: 25, motif: 'sun' },
  // psion
  'psion/telepath-ua9-02-10-2025': { hue: 260, motif: 'eye' },
  'psion/psykinetic-ua9-02-10-2025': { hue: 300, motif: 'bolt' },
  'psion/metamorph-ua9-02-10-2025': { hue: 150, motif: 'paw' },
  'psion/psi-warper-ua': { hue: 210, motif: 'spiral' },
  // ranger
  'ranger/hunter': { hue: 70, motif: 'arrow', hue2: 25 },
  'ranger/beast-master': { hue: 35, motif: 'paw' },
  'ranger/gloom-stalker': { hue: 240, motif: 'moon' },
  'ranger/fey-wanderer': { hue: 310, motif: 'star' },
  'ranger/drakewarden': { hue: 10, motif: 'flame' },
  'ranger/swarmkeeper': { hue: 55, motif: 'web' },
  'ranger/horizon-walker-conclave': { hue: 200, motif: 'spiral' },
  'ranger/monster-slayer-conclave': { hue: 0, motif: 'claw' },
  'ranger/winter-walker': { hue: 195, motif: 'snowflake' },
  'ranger/deep-stalker': { hue: 270, motif: 'eye' },
  'ranger/hollow-warden': { hue: 140, motif: 'tree', hue2: 30 },
  'ranger/primeval-guardian': { hue: 115, motif: 'shield' },
  // rogue
  'rogue/thief': { hue: 40, motif: 'mask' },
  'rogue/assassin': { hue: 355, motif: 'dagger', hue2: 0 },
  'rogue/arcane-trickster': { hue: 260, motif: 'rune' },
  'rogue/soulknife': { hue: 285, motif: 'crystal' },
  'rogue/swashbuckler': { hue: 15, motif: 'sword' },
  'rogue/phantom': { hue: 180, motif: 'skull' },
  'rogue/inquisitive': { hue: 220, motif: 'eye' },
  'rogue/mastermind': { hue: 300, motif: 'crown' },
  'rogue/scout': { hue: 100, motif: 'arrow' },
  'rogue/revived': { hue: 160, motif: 'hourglass' },
  // sorcerer
  'sorcerer/draconic-sorcery': { hue: 12, motif: 'claw', hue2: 40 },
  'sorcerer/wild-magic-sorcery': { hue: 300, motif: 'spiral' },
  'sorcerer/aberrant-sorcery': { hue: 275, motif: 'tentacle' },
  'sorcerer/clockwork-sorcery': { hue: 40, motif: 'gear' },
  'sorcerer/shadow-sorcery': { hue: 245, motif: 'moon' },
  'sorcerer/storm-sorcery': { hue: 205, motif: 'bolt' },
  'sorcerer/divine-soul': { hue: 48, motif: 'sun' },
  'sorcerer/lunar-sorcery': { hue: 230, motif: 'moon', hue2: 300 },
  'sorcerer/phoenix-sorcery': { hue: 22, motif: 'feather' },
  'sorcerer/pyromancy': { hue: 5, motif: 'flame' },
  'sorcerer/sea-sorcery': { hue: 190, motif: 'wave' },
  'sorcerer/stone-sorcery': { hue: 35, motif: 'mountain' },
  'sorcerer/giant-soul': { hue: 25, motif: 'mountain', hue2: 200 },
  'sorcerer/psionic-soul': { hue: 285, motif: 'crystal' },
  'sorcerer/spellfire-sorcery': { hue: 45, motif: 'flame' },
  'sorcerer/favored-soul-ua': { hue: 50, motif: 'cross' },
  // warlock
  'warlock/fiend-patron': { hue: 5, motif: 'flame', hue2: 30 },
  'warlock/archfey-patron': { hue: 310, motif: 'leaf' },
  'warlock/great-old-one-patron': { hue: 160, motif: 'tentacle' },
  'warlock/celestial-patron': { hue: 48, motif: 'sun' },
  'warlock/the-hexblade': { hue: 255, motif: 'sword' },
  'warlock/the-fathomless': { hue: 195, motif: 'tentacle', hue2: 220 },
  'warlock/the-genie': { hue: 185, motif: 'spark' },
  'warlock/the-undying': { hue: 120, motif: 'skull' },
  'warlock/the-raven-queen': { hue: 240, motif: 'feather' },
  'warlock/the-seeker': { hue: 215, motif: 'star' },
  'warlock/undead-patron': { hue: 100, motif: 'skull', hue2: 280 },
  'warlock/the-undying-light': { hue: 40, motif: 'sun', hue2: 0 },
  'warlock/lurker-in-the-deep-ua': { hue: 200, motif: 'wave' },
  'warlock/ghost-in-the-machine-ua': { hue: 170, motif: 'gear' },
  'warlock/vestige-patron': { hue: 25, motif: 'hourglass' },
  // wizard
  'wizard/abjurer': { hue: 205, motif: 'shield' },
  'wizard/conjurer': { hue: 170, motif: 'spark' },
  'wizard/diviner': { hue: 270, motif: 'eye' },
  'wizard/enchanter': { hue: 320, motif: 'heart' },
  'wizard/evoker': { hue: 10, motif: 'flame' },
  'wizard/illusionist': { hue: 290, motif: 'mask' },
  'wizard/necromancer': { hue: 130, motif: 'skull', hue2: 280 },
  'wizard/transmuter': { hue: 40, motif: 'crystal' },
  'wizard/bladesinger': { hue: 195, motif: 'sword' },
  'wizard/chronurgy-magic': { hue: 45, motif: 'hourglass' },
  'wizard/graviturgy-magic': { hue: 255, motif: 'spiral' },
  'wizard/order-of-scribes': { hue: 30, motif: 'feather' },
  'wizard/war-magic': { hue: 0, motif: 'shield', hue2: 230 },
  'wizard/lore-mastery': { hue: 220, motif: 'book' },
  'wizard/technomancy-ua': { hue: 180, motif: 'gear' },
  'wizard/theurgy-ua': { hue: 48, motif: 'cross' },
  'wizard/onomancy-ua': { hue: 260, motif: 'note' },
};

export interface ClassTheme {
  classId: string;
  subclassId: string | null;
  hue: number;
  sat: number;
  hue2: number;
  motif: Motif;
  /** Accent (text, ≥ 4.5:1) and decoration (≥ 3:1) colours on the light / dark paper. */
  accentLight: string;
  accentDark: string;
  accent2Light: string;
  accent2Dark: string;
  /** False when the class isn't known (a neutral theme derived from the id). */
  known: boolean;
}

/** Paper colours of the journal (keep in sync with --paper in styles.scss). */
export const PAPER_LIGHT = '#f1e3c2';
export const PAPER_DARK = '#2a2119';

export function themeFor(classId: string, subclassId?: string | null): ClassTheme {
  const known = classId in CLASS_THEMES;
  const base: ClassDef = known
    ? CLASS_THEMES[classId]
    : { hue: hash(classId) % 360, sat: 45, motifs: ['star', 'book', 'rune'] };
  let hue = base.hue;
  let motif = base.motifs[0];
  let hue2 = CLASS_HUE2[classId] ?? (base.hue + 180) % 360;
  const sub = subclassId ? subclassId : null;

  if (sub) {
    const h = hash(sub);
    const picked = SUBCLASS_THEMES[sub];
    if (picked) {
      hue = picked.hue;
      motif = picked.motif;
      hue2 = picked.hue2 ?? (picked.hue + 150 + (h % 61)) % 360;
    } else {
      // Variation of the class theme: hue shift, an alternative motif, its own second hue.
      hue = (base.hue + ((h % 15) - 7) * 5 + 360) % 360;
      const alts = base.motifs.slice(1);
      motif = alts[(h >>> 4) % alts.length];
      hue2 = (h >>> 9) % 360;
    }
  }

  const sat = base.sat;
  const sat2 = Math.max(40, Math.min(60, sat));
  // inks and pigments, not neon: accents are a little muted and deep
  const ink = Math.round(Math.min(50, sat) * 0.8);
  return {
    classId,
    subclassId: sub,
    hue,
    sat,
    hue2,
    motif,
    accentLight: readable(hue, ink, PAPER_LIGHT, 'darker'),
    accentDark: readable(hue, ink, PAPER_DARK, 'lighter'),
    // decoration only (not text): 3:1 is enough (WCAG 1.4.11)
    accent2Light: readable(hue2, sat2, PAPER_LIGHT, 'darker', 3.1),
    accent2Dark: readable(hue2, sat2, PAPER_DARK, 'lighter', 3.1),
    known,
  };
}

/** CSS custom properties for a theme (consumed by themes.scss). */
export function themeVars(t: ClassTheme): Record<string, string> {
  return {
    '--th-hue': String(t.hue),
    '--th-sat': `${t.sat}%`,
    '--th-hue2': String(t.hue2),
    '--th-accent-light': t.accentLight,
    '--th-accent-dark': t.accentDark,
    '--th-accent2-light': t.accent2Light,
    '--th-accent2-dark': t.accent2Dark,
  };
}

// -- colour helpers ------------------------------------------------------------------------

/** FNV-1a, 32 bits: stable across runs and platforms. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The colour of that hue/saturation closest to mid-lightness with enough contrast on paper. */
function readable(
  hue: number,
  sat: number,
  paper: string,
  dir: 'darker' | 'lighter',
  min = 4.6,
): string {
  const start = dir === 'darker' ? 42 : 58;
  const step = dir === 'darker' ? -1 : 1;
  for (let l = start; l >= 5 && l <= 95; l += step) {
    const c = hslToHex(hue, sat, l);
    if (contrast(c, paper) >= min) return c;
  }
  return dir === 'darker' ? '#000000' : '#ffffff';
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
