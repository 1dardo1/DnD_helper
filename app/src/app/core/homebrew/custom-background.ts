import { Ability, Background, Item } from '../models/compendium';
import { parseStartingEquipment } from '../rules/starting-equipment';
import { ABILITIES, SKILL_ABILITY } from '../rules/tables';

/**
 * Backgrounds made by the user. They follow exactly the schema of the official ones (Background in
 * models/compendium.ts), so the rules engine, the wizard and the compendium treat them like any
 * other; `custom: true` flags them. Pure functions: validation, the equipment text and the
 * conversion from the form's draft. HomebrewStore keeps them and syncs them.
 */

/** Where they live in the repo: homebrew/backgrounds/<id>.json */
export const HOMEBREW_DIR = 'homebrew/backgrounds';
/** Ids start with this, so they can never clash with an official id. */
export const CUSTOM_PREFIX = 'custom-';

/** "Choose one kind of ..." tool kinds a custom background can offer (as the official ones write them). */
export const TOOL_KINDS = ["Artisan's Tools", 'Gaming Set', 'Musical Instrument'] as const;
export const TOOL_KIND_TEXT = (kind: string) => `Choose one kind of ${kind}`;

export const SKILL_IDS = Object.keys(SKILL_ABILITY);

/** The editable parts of the equipment, kept inside the file to edit it again. */
export interface EquipmentDraft {
  items: { itemId: string; qty: number }[];
  /** Gold of package A. */
  gold: number;
  /** Add the background's tool to the package ("Thieves' Tools" / "Gaming Set (same as above)"). */
  includeTool: boolean;
}

export interface CustomBackground extends Background {
  custom: true;
  dmApproved: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  /** What the form needs to show the equipment again (the text in `equipment` is derived from it). */
  equipmentDraft: EquipmentDraft;
}

/** What the form edits. */
export interface BackgroundDraft {
  name: string;
  description: string;
  abilityScores: Ability[];
  featId: string | null;
  skills: string[];
  /** A specific tool ("Thieves' Tools") or a kind to choose from ("Gaming Set"). */
  tool: { mode: 'specific' | 'kind'; value: string };
  equipment: EquipmentDraft;
}

export function emptyDraft(): BackgroundDraft {
  return {
    name: '',
    description: '',
    abilityScores: [],
    featId: null,
    skills: [],
    tool: { mode: 'specific', value: '' },
    equipment: { items: [], gold: 0, includeTool: true },
  };
}

export function draftOf(bg: CustomBackground): BackgroundDraft {
  const kind = TOOL_KINDS.find((k) => bg.tools === TOOL_KIND_TEXT(k));
  return {
    name: bg.name,
    description: bg.description,
    abilityScores: [...bg.abilityScores],
    featId: bg.featId,
    skills: [...bg.skills],
    tool: kind ? { mode: 'kind', value: kind } : { mode: 'specific', value: bg.tools ?? '' },
    equipment: structuredClone(bg.equipmentDraft),
  };
}

// -- validation ----------------------------------------------------------------------------------

export type DraftField = 'name' | 'description' | 'abilities' | 'feat' | 'skills' | 'tool' | 'gold';

export interface DraftError {
  field: DraftField;
  /** i18n key under homebrew.err.* */
  key:
    | 'nameEmpty'
    | 'nameTaken'
    | 'descriptionEmpty'
    | 'abilities'
    | 'feat'
    | 'skills'
    | 'tool'
    | 'gold'
    | 'qty';
  params?: Record<string, string | number>;
}

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * What is wrong with the draft (empty: it can be saved). `taken` are the normalised names of the
 * other backgrounds (official and custom, except the one being edited); `featIds` the origin feats.
 */
export function validateDraft(
  d: BackgroundDraft,
  taken: ReadonlySet<string>,
  featIds: ReadonlySet<string>,
): DraftError[] {
  const errors: DraftError[] = [];
  const name = d.name.trim();
  if (!name) errors.push({ field: 'name', key: 'nameEmpty' });
  else if (taken.has(normaliseName(name))) errors.push({ field: 'name', key: 'nameTaken' });
  if (!d.description.trim()) errors.push({ field: 'description', key: 'descriptionEmpty' });
  const abilities = new Set(d.abilityScores.filter((a) => ABILITIES.includes(a)));
  if (abilities.size !== 3 || d.abilityScores.length !== 3)
    errors.push({ field: 'abilities', key: 'abilities', params: { count: abilities.size } });
  if (!d.featId || !featIds.has(d.featId)) errors.push({ field: 'feat', key: 'feat' });
  const skills = new Set(d.skills.filter((s) => SKILL_IDS.includes(s)));
  if (skills.size !== 2 || d.skills.length !== 2)
    errors.push({ field: 'skills', key: 'skills', params: { count: skills.size } });
  const tool = d.tool.value.trim();
  if (!tool || (d.tool.mode === 'kind' && !(TOOL_KINDS as readonly string[]).includes(tool)))
    errors.push({ field: 'tool', key: 'tool' });
  const gold = d.equipment.gold;
  if (!Number.isInteger(gold) || gold < 0) errors.push({ field: 'gold', key: 'gold' });
  if (d.equipment.items.some((i) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99))
    errors.push({ field: 'gold', key: 'qty' });
  return errors;
}

// -- equipment text ----------------------------------------------------------------------------

function pluralise(name: string): string {
  if (/s$/i.test(name)) return name;
  if (/(x|ch|sh)$/i.test(name)) return `${name}es`;
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

/** "Hooded Lantern" for the compendium's "Lantern, Hooded": commas would split the list. */
function writable(name: string): string {
  const m = /^([^,]+), ([^,]+)$/.exec(name);
  return m ? `${m[2]} ${m[1]}` : name;
}

const packageOf = (line: string) => `Choose A or B: (A) ${line}; or (B) 50 GP`;

/** Does the package text give this item back when the wizard parses it? */
function roundTrips(line: string, itemId: string, qty: number, index: Map<string, Item>): boolean {
  const pkg = parseStartingEquipment(packageOf(line), index)?.[0];
  return (
    !!pkg && pkg.lines.length === 1 && pkg.lines[0].itemId === itemId && pkg.lines[0].qty === qty
  );
}

/** One line of a package for an item and quantity ("Rope", "2 Pouches"), as the books write it. */
export function itemLine(item: Item, qty: number, index: Map<string, Item>): string {
  const name = writable(item.name);
  if (qty <= 1) return name;
  for (const candidate of [pluralise(name), name]) {
    const line = `${qty} ${candidate}`;
    if (roundTrips(line, item.id, qty, index)) return line;
  }
  return `${qty} ${name}`;
}

/** Can the wizard read this item back from the text? Only those are offered in the form. */
export function isWritable(item: Item, index: Map<string, Item>): boolean {
  return roundTrips(itemLine(item, 1, index), item.id, 1, index);
}

/** The starting equipment text: "Choose A or B: (A) Rope, 2 Pouches, 12 GP; or (B) 50 GP". Empty when there is none. */
export function equipmentText(
  draft: BackgroundDraft,
  items: Map<string, Item>,
  index: Map<string, Item>,
): string {
  const lines: string[] = [];
  const { equipment: eq, tool } = draft;
  if (eq.includeTool && tool.value.trim()) {
    lines.push(tool.mode === 'kind' ? `${tool.value} (same as above)` : tool.value.trim());
  }
  for (const line of eq.items) {
    const item = items.get(line.itemId);
    if (item) lines.push(itemLine(item, line.qty, index));
  }
  if (eq.gold > 0) lines.push(`${Math.round(eq.gold)} GP`);
  if (!lines.length) return '';
  return packageOf(lines.join(', '));
}

// -- building the background ---------------------------------------------------------------------

const RANDOM_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
      .replace(/-$/, '') || 'background'
  );
}

/** "custom-<slug>-<6 random characters>" */
export function newCustomId(name: string, random: () => number = Math.random): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += RANDOM_CHARS[Math.floor(random() * RANDOM_CHARS.length)];
  return `${CUSTOM_PREFIX}${slugify(name)}-${suffix}`;
}

export function isCustomId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(CUSTOM_PREFIX);
}

export interface BuildContext {
  items: Map<string, Item>;
  index: Map<string, Item>;
  /** English name of the origin feat. */
  featName: (featId: string) => string;
  device: string;
  now?: Date;
}

/**
 * The background for a valid draft. `previous` is the one being edited: it keeps its id, creation
 * date and approval.
 */
export function buildBackground(
  draft: BackgroundDraft,
  ctx: BuildContext,
  previous?: CustomBackground,
): CustomBackground {
  const now = (ctx.now ?? new Date()).toISOString();
  const name = draft.name.trim();
  return {
    id: previous?.id ?? newCustomId(name),
    type: 'background',
    name,
    edition: '2024',
    source: null,
    description: draft.description.trim(),
    url: '',
    abilityScores: ABILITIES.filter((a) => draft.abilityScores.includes(a)),
    feat: draft.featId ? ctx.featName(draft.featId) : null,
    featId: draft.featId,
    skills: SKILL_IDS.filter((s) => draft.skills.includes(s)),
    tools: draft.tool.mode === 'kind' ? TOOL_KIND_TEXT(draft.tool.value) : draft.tool.value.trim(),
    equipment: equipmentText(draft, ctx.items, ctx.index),
    custom: true,
    dmApproved: previous?.dmApproved ?? false,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    updatedBy: ctx.device,
    equipmentDraft: structuredClone(draft.equipment),
  };
}

// -- reading files -------------------------------------------------------------------------------

/** Ids become a path in the repo (homebrew/backgrounds/<id>.json): only safe characters. */
const SAFE_ID = /^custom-[a-z0-9][a-z0-9-]{0,80}$/;

export function isSafeCustomId(id: string): boolean {
  return SAFE_ID.test(id);
}

/** A parsed file as a custom background, or null if it isn't one (wrong shape, unsafe id...). */
export function normalizeCustomBackground(raw: unknown): CustomBackground | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<CustomBackground>;
  if (typeof b.id !== 'string' || !isSafeCustomId(b.id)) return null;
  if (typeof b.name !== 'string' || !b.name.trim()) return null;
  const strings = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];
  const abilityScores = strings(b.abilityScores).filter((a): a is Ability =>
    ABILITIES.includes(a as Ability),
  );
  const skills = strings(b.skills).filter((s) => SKILL_IDS.includes(s));
  const eq = b.equipmentDraft;
  const stamp = (v: unknown) =>
    typeof v === 'string' && Date.parse(v) ? v : new Date(0).toISOString();
  return {
    id: b.id,
    type: 'background',
    name: b.name.trim(),
    edition: '2024',
    source: null,
    description: typeof b.description === 'string' ? b.description : '',
    url: '',
    abilityScores,
    feat: typeof b.feat === 'string' ? b.feat : null,
    featId: typeof b.featId === 'string' ? b.featId : null,
    skills,
    tools: typeof b.tools === 'string' ? b.tools : null,
    equipment: typeof b.equipment === 'string' ? b.equipment : '',
    custom: true,
    dmApproved: b.dmApproved === true,
    createdAt: stamp(b.createdAt),
    updatedAt: stamp(b.updatedAt),
    updatedBy: typeof b.updatedBy === 'string' ? b.updatedBy : '',
    equipmentDraft: {
      items: Array.isArray(eq?.items)
        ? eq.items.filter(
            (i) => i && typeof i.itemId === 'string' && Number.isInteger(i.qty) && i.qty >= 1,
          )
        : [],
      gold: typeof eq?.gold === 'number' && eq.gold >= 0 ? eq.gold : 0,
      includeTool: eq?.includeTool !== false,
    },
  };
}
