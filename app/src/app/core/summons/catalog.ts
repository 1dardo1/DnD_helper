import { Character } from '../models/character';
import { Ability, Monster, Spell } from '../models/compendium';
import { Sheet, SheetFeature } from '../rules/sheet';
import { Resolved, SummonContext, deriveVariants, resolveBlock } from './resolve';
import { StatBlockTemplate, extractStatBlocks } from './stat-block';

/**
 * What a character can summon: the spells and class features that bring a creature, and for each
 * the creatures it can be (a stat block with variants, or compendium monsters). Pure: it takes the
 * character, its computed sheet and the compendium lists, and returns plain data.
 */

export type Coverage =
  /** The stat block was read from the text of the spell or feature. */
  | 'structured'
  /** The creatures are compendium monsters (Find Familiar, Animate Dead…). */
  | 'monsters'
  /** No stat block to read: only the description (a card that links to it). */
  | 'text';

export interface SummonOption {
  /** Unique within the source: "air", "monster-bat". */
  key: string;
  /** English name: "Bestial Spirit (Air)", "Bat". */
  name: string;
  kind: 'block' | 'monster';
  template?: StatBlockTemplate;
  variant?: string | null;
  variants?: string[];
  monsterId?: string;
}

export interface SummonSource {
  /** "spell:summon-beast", "feature:subclass:ranger/beast-master:Primal Companion". */
  id: string;
  kind: 'spell' | 'feature';
  /** English name of the spell or feature. */
  name: string;
  /** Where its description is in the compendium. */
  ref: { type: 'spell' | 'subclass' | 'class' | 'option' | 'feat' | 'species'; id: string };
  coverage: Coverage;
  /** Class ids of the spell list (spells) or the class of the feature, to find the caster. */
  classIds: string[];
  /** Spell slot levels it can be cast at; 0 for features. */
  minSlot: number;
  maxSlot: number;
  /** The creature type is chosen when summoning (Find Familiar: celestial, fey or fiend). */
  typeChoices: string[];
  /** The type is always this one (Wild Companion: fey). */
  fixedType: string | null;
  options: SummonOption[];
}

export interface SummonCatalog {
  spells: Map<string, SummonSource>;
  monsters: Map<string, Monster>;
  spellByName: Map<string, string>;
}

// -- the hand-written part -----------------------------------------------------------------

/** Names of the variants where the table doesn't say "(X only)" for all of them. */
const VARIANTS: Record<string, string[]> = {
  'summon-fey': ['Fuming', 'Mirthful', 'Tricksy'],
  'animate-objects': ['Medium or smaller', 'Large', 'Huge'],
  'summon-shadowspawn': ['Fury', 'Despair', 'Fear'],
};

/** Rows that lack the "(X only)" tag in the data. */
const ROW_TAGS: Record<string, Record<string, string>> = {
  'summon-dinosaur': { Slam: 'Ankylosaur only' },
};

interface MonsterSpell {
  ids: string[];
  /** More creatures by rule: beasts up to this Challenge Rating. */
  filter?: { creatureType: string; cr: number };
  typeChoices?: string[];
}

/** Spells whose creatures are in the compendium's monster list. */
const MONSTER_SPELLS: Record<string, MonsterSpell> = {
  'find-familiar': {
    ids: [
      'bat',
      'cat',
      'frog',
      'hawk',
      'lizard',
      'octopus',
      'owl',
      'rat',
      'raven',
      'spider',
      'weasel',
    ],
    filter: { creatureType: 'beast', cr: 0 },
    typeChoices: ['celestial', 'fey', 'fiend'],
  },
  'animate-dead': { ids: ['skeleton', 'zombie'] },
  'danse-macabre': { ids: ['skeleton', 'zombie'] },
  'create-undead': { ids: ['ghoul', 'ghast', 'wight', 'mummy'] },
  'phantom-steed': { ids: ['riding-horse'] },
  'sticks-to-snakes': { ids: ['venomous-snake'] },
  'find-greater-steed': {
    ids: ['griffon', 'pegasus', 'dire-wolf', 'rhinoceros', 'saber-toothed-tiger'],
    typeChoices: ['celestial', 'fey', 'fiend'],
  },
};

/** Spells that bring a creature but give no stat block to read: a card with the description. */
const TEXT_SPELLS = [
  'infernal-calling',
  'summon-greater-demon',
  'summon-lesser-demons',
  'simulacrum',
  'planar-ally',
  'mordenkainens-faithful-hound',
  'conjure-barlgura-ua',
  'conjure-hezrou-ua',
  'conjure-knowbot-ua',
  'conjure-lesser-demon-ua',
  'conjure-shadow-demon-ua',
  'conjure-vrock-ua',
];

/** Spells you also have because of a feat or an invocation (their text says "you learn/have"). */
const GRANTED_BY: Record<string, string[]> = {
  'familiar-friend': ['find-familiar'],
  'warlike-familiar': ['battle-familiar'],
};

/** Forms of the Pact of the Chain familiar besides the normal ones. */
const CHAIN_FORMS = [
  'imp',
  'pseudodragon',
  'quasit',
  'sprite',
  'sphinx-of-wonder',
  'venomous-snake',
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// -- stat-block sources --------------------------------------------------------------------

/** A context with no character, to check that a template can be read in full. */
export function probeContext(level: number): SummonContext {
  const zero = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 } as Record<Ability, number>;
  return {
    slotLevel: level,
    pb: 2,
    spellAttack: 5,
    spellDc: 13,
    mods: zero,
    spellMod: 3,
    classLevels: new Proxy({}, { get: () => 5 }) as Record<string, number>,
    totalLevel: 5,
  };
}

/** Variants of a template: written in the data, or the types it offers ("Fey, or Fiend"). */
export function variantsOf(t: StatBlockTemplate, spellId?: string): string[] {
  const hand = spellId ? VARIANTS[spellId] : undefined;
  if (hand) return hand;
  const only = deriveVariants(t);
  if (only.length) return only;
  const types = typeChoicesOf(t);
  return types.length > 1 ? types.map((x) => x.replace(/^\w/, (c) => c.toUpperCase())) : [];
}

/** "Large Celestial, Fey, or Fiend (Your Choice), Neutral" → [celestial, fey, fiend]. */
export function typeChoicesOf(t: StatBlockTemplate): string[] {
  const line = t.typeLine
    .replace(/[,;]\s*[^,;]*(?:unaligned|neutral|lawful|chaotic|good|evil)[^,;]*$/i, '')
    .replace(/\([^()]*\)/g, '')
    .replace(/^(?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+\w+)?\s+/i, '');
  const words = line
    .split(/,|\bor\b/i)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  return words.length > 1 ? words : [];
}

function withRowTags(t: StatBlockTemplate, spellId: string): StatBlockTemplate {
  const extra = ROW_TAGS[spellId];
  if (!extra) return t;
  const sections = { ...t.sections };
  for (const k of Object.keys(sections) as (keyof typeof sections)[]) {
    sections[k] = sections[k].map((r) =>
      extra[r.name] && !r.tags.length ? { ...r, tags: [extra[r.name]] } : r,
    );
  }
  return { ...t, sections };
}

function blockOptions(t: StatBlockTemplate, spellId?: string): SummonOption[] {
  const variants = variantsOf(t, spellId);
  if (!variants.length) {
    return [{ key: slug(t.title) || 'creature', name: t.title, kind: 'block', template: t }];
  }
  return variants.map((v) => ({
    key: slug(v),
    name: `${t.title} (${v})`,
    kind: 'block',
    template: t,
    variant: v,
    variants,
  }));
}

/** Whether every option of a stat-block source can be worked out (no formula left unread). */
function readable(options: SummonOption[], level: number): boolean {
  return options.every(
    (o) =>
      o.kind !== 'block' ||
      !resolveBlock(o.template!, {
        id: 'probe',
        name: o.name,
        source: '',
        variant: o.variant ?? null,
        variants: o.variants ?? [],
        ctx: probeContext(level),
      }).unresolved.length,
  );
}

function monsterOption(id: string): SummonOption {
  return { key: `monster-${id}`, name: id, kind: 'monster', monsterId: id };
}

function monsterOptions(def: MonsterSpell, monsters: Map<string, Monster>): SummonOption[] {
  const ids = def.ids.filter((id) => monsters.has(id));
  if (def.filter) {
    const more = [...monsters.values()]
      .filter(
        (m) =>
          m.creatureType === def.filter!.creatureType &&
          m.cr <= def.filter!.cr &&
          !ids.includes(m.id) &&
          !m.tags.includes('swarm'),
      )
      .map((m) => m.id)
      .sort();
    ids.push(...more);
  }
  return ids.map((id) => ({ ...monsterOption(id), name: monsters.get(id)!.name }));
}

function spellSource(spell: Spell, monsters: Map<string, Monster>): SummonSource | null {
  const base = {
    id: `spell:${spell.id}`,
    kind: 'spell' as const,
    name: spell.name,
    ref: { type: 'spell' as const, id: spell.id },
    classIds: spell.classes,
    minSlot: spell.level,
    maxSlot: 9,
    typeChoices: [] as string[],
    fixedType: null,
  };
  const blocks = extractStatBlocks(`${spell.description}\n${spell.higherLevels ?? ''}`);
  if (blocks.length) {
    const options = blocks.flatMap((b) => blockOptions(withRowTags(b, spell.id), spell.id));
    if (readable(options, spell.level)) return { ...base, coverage: 'structured', options };
    return { ...base, coverage: 'text', options: [] };
  }
  const def = MONSTER_SPELLS[spell.id];
  if (def) {
    const options = monsterOptions(def, monsters);
    if (options.length) {
      return { ...base, coverage: 'monsters', typeChoices: def.typeChoices ?? [], options };
    }
  }
  if (TEXT_SPELLS.includes(spell.id)) return { ...base, coverage: 'text', options: [] };
  return null;
}

/** Reads the stat blocks of the spells once; the rest of the module works from this. */
export function buildCatalog(spells: Spell[], monsters: Monster[]): SummonCatalog {
  const byId = new Map(monsters.map((m) => [m.id, m]));
  const out = new Map<string, SummonSource>();
  for (const s of spells) {
    const source = spellSource(s, byId);
    if (source) out.set(s.id, source);
  }
  return {
    spells: out,
    monsters: byId,
    spellByName: new Map(spells.map((s) => [s.name.toLowerCase(), s.id])),
  };
}

// -- what a character has ------------------------------------------------------------------

const featureCache = new Map<string, StatBlockTemplate[]>();
function blocksOf(description: string): StatBlockTemplate[] {
  let blocks = featureCache.get(description);
  if (!blocks) {
    blocks = description.includes('Armor Class') ? extractStatBlocks(description) : [];
    featureCache.set(description, blocks);
  }
  return blocks;
}

function classIdOf(f: SheetFeature): string {
  return f.source.type === 'subclass' ? f.source.id.split('/')[0] : f.source.id;
}

/**
 * Features whose "Armor Class" table isn't a summoned creature: the Artillerist's Eldritch Cannon
 * is an object the character creates (core/artificer/cannon.ts), shown on its own card instead.
 */
const EXCLUDED_FEATURES: Record<string, string> = {
  'artificer/artillerist-ua': 'Eldritch Cannon',
};

function featureSource(f: SheetFeature, catalog: SummonCatalog): SummonSource | null {
  if (f.source.type === 'subclass' && EXCLUDED_FEATURES[f.source.id] === f.name) return null;
  const refType = f.source.type === 'background' ? 'species' : f.source.type;
  const base = {
    id: `feature:${f.source.type}:${f.source.id}:${f.name}`,
    kind: 'feature' as const,
    name: f.name,
    ref: { type: refType, id: f.source.id },
    classIds: f.source.type === 'class' || f.source.type === 'subclass' ? [classIdOf(f)] : [],
    minSlot: 0,
    maxSlot: 0,
    typeChoices: [] as string[],
  };
  const blocks = blocksOf(f.description);
  if (blocks.length) {
    const options = blocks.flatMap((b) => blockOptions(b));
    return readable(options, 0)
      ? { ...base, coverage: 'structured', fixedType: null, options }
      : { ...base, coverage: 'text', fixedType: null, options: [] };
  }
  // Wild Companion: Find Familiar as a Fey, with no slot
  if (f.source.type === 'class' && f.source.id === 'druid' && f.name === 'Wild Companion') {
    const options = monsterOptions(MONSTER_SPELLS['find-familiar'], catalog.monsters);
    return options.length ? { ...base, coverage: 'monsters', fixedType: 'fey', options } : null;
  }
  return null;
}

/** The monsters a Pact of the Chain familiar can be besides the normal forms. */
function chainSource(catalog: SummonCatalog): SummonSource | null {
  const base = catalog.spells.get('find-familiar');
  if (!base) return null;
  const extra = CHAIN_FORMS.filter((id) => catalog.monsters.has(id)).map((id) => ({
    ...monsterOption(id),
    name: catalog.monsters.get(id)!.name,
  }));
  return {
    ...base,
    id: 'option:pact-of-the-chain',
    kind: 'feature',
    name: 'Pact of the Chain',
    ref: { type: 'option', id: 'eldritch-invocation/pact-of-the-chain' },
    typeChoices: [],
    fixedType: null,
    options: [...extra, ...base.options.filter((o) => !extra.some((e) => e.key === o.key))],
  };
}

/** Ids of the spells the character has: chosen, granted by the subclass, by a feat or an option. */
export function spellIdsOf(
  character: Character,
  subclasses: Map<string, { spells: { classLevel: number; spells: string[] }[] | null }>,
  catalog: SummonCatalog,
): Set<string> {
  const ids = new Set<string>(character.choices.spells);
  for (const c of character.classes) {
    const sub = c.subclassId ? subclasses.get(c.subclassId) : undefined;
    for (const row of sub?.spells ?? []) {
      if (row.classLevel > c.level) continue;
      for (const name of row.spells) {
        const id = catalog.spellByName.get(
          name
            .replace(/\s*\([^()]*\)/g, '')
            .trim()
            .toLowerCase(),
        );
        if (id) ids.add(id);
      }
    }
  }
  for (const key of [...character.choices.options, ...character.choices.feats]) {
    for (const id of GRANTED_BY[key] ?? []) ids.add(id);
  }
  return ids;
}

/** Everything the character can summon, spells first. */
export function summonSourcesOf(
  character: Character,
  sheet: Pick<Sheet, 'features'>,
  subclasses: Map<string, { spells: { classLevel: number; spells: string[] }[] | null }>,
  catalog: SummonCatalog,
): SummonSource[] {
  const out: SummonSource[] = [];
  for (const id of spellIdsOf(character, subclasses, catalog)) {
    const s = catalog.spells.get(id);
    if (s) out.push(s);
  }
  out.sort((a, b) => a.minSlot - b.minSlot || a.name.localeCompare(b.name));
  if (character.choices.options.includes('eldritch-invocation/pact-of-the-chain')) {
    const chain = chainSource(catalog);
    if (chain) out.unshift(chain);
  }
  const seen = new Set<string>();
  for (const f of sheet.features) {
    const s = featureSource(f, catalog);
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      out.push(s);
    }
  }
  return out;
}

// -- resolving -----------------------------------------------------------------------------

const STAT_ABILITIES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** The caster's numbers for a source at a slot level. */
export function contextFor(source: SummonSource, sheet: Sheet, slotLevel: number): SummonContext {
  const mods = {} as Record<Ability, number>;
  for (const a of STAT_ABILITIES) mods[a] = sheet.abilities[a].modifier;
  const casting = sheet.spellcasting.classes;
  const caster = casting.find((c) => source.classIds.includes(c.classId)) ?? casting[0];
  const best = Math.max(mods.INT, mods.WIS, mods.CHA);
  const spellMod = caster ? mods[caster.ability] : best;
  const classLevels: Record<string, number> = {};
  for (const c of sheet.classes) classLevels[c.name.toLowerCase()] = c.level;
  return {
    slotLevel,
    pb: sheet.proficiencyBonus,
    spellAttack: caster ? caster.attack : sheet.proficiencyBonus + best,
    spellDc: caster ? caster.saveDc : 8 + sheet.proficiencyBonus + best,
    mods,
    spellMod,
    classLevels,
    totalLevel: sheet.totalLevel,
  };
}

/** Highest slot level the character can cast this source at (at least its own level). */
export function maxSlotOf(source: SummonSource, sheet: Sheet): number {
  if (source.kind !== 'spell') return 0;
  let top = 0;
  sheet.spellcasting.slots.forEach((n, i) => {
    if (n > 0) top = i + 1;
  });
  if (sheet.spellcasting.pact) top = Math.max(top, sheet.spellcasting.pact.level);
  return Math.min(9, Math.max(source.minSlot, top));
}

/** The slot level in use: the saved choice kept within what the source allows. */
export function slotLevelOf(
  source: SummonSource,
  sheet: Sheet,
  chosen: number | undefined,
): number {
  if (source.kind !== 'spell') return 0;
  const max = maxSlotOf(source, sheet);
  return Math.min(max, Math.max(source.minSlot, chosen ?? source.minSlot));
}

/** The creature of an option, with the caster's numbers (and the chosen type) worked in. */
export function resolveOption(
  source: SummonSource,
  option: SummonOption,
  ctx: SummonContext,
  catalog: SummonCatalog,
  type?: string,
): Resolved | null {
  if (option.kind === 'block') {
    return resolveBlock(option.template!, {
      id: `summon:${source.id}:${option.key}`,
      name: option.name,
      source: source.name,
      variant: option.variant ?? null,
      variants: option.variants ?? [],
      ctx,
    });
  }
  const base = catalog.monsters.get(option.monsterId!);
  if (!base) return null;
  const creatureType =
    source.fixedType ?? (type && source.typeChoices.includes(type) ? type : null);
  const patched: Monster = {
    ...base,
    ...(creatureType ? { creatureType } : {}),
    ...(source.id === 'spell:phantom-steed' ? { speed: { ...base.speed, walk: 100 } } : {}),
  };
  return { monster: patched, unresolved: [] };
}
