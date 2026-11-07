/**
 * The pages ("tabs") the character sheet is split into, like the sections of the official sheet.
 * Pure helpers: which tabs a character has, how they go in the URL and which one was used last.
 */
export const SHEET_TABS = [
  'resumen',
  'rasgos',
  'conjuros',
  'equipo',
  'invocaciones',
  'notas',
] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

/** The tab shown when nothing else was asked (and always there). */
export const DEFAULT_TAB: SheetTab = 'resumen';

/** What decides which tabs a character gets (a slice of the computed sheet). */
export interface TabInput {
  spellcasting: { classes: readonly unknown[]; slots: readonly number[]; pact: unknown };
  classes: readonly { id: string; level: number }[];
}

export interface TabContext {
  /** Spells the feats give (Magic Initiate...). */
  featSpells: number;
  /** Creatures the character can summon with its spells and features. */
  summonSources: number;
  /** Creatures already tracked in the play state. */
  summoned?: number;
  /** The Artillerist's Eldritch Cannon (an object, not a catalog summon source). */
  hasCannon?: boolean;
}

/** Artificer level from which Replicate Magic Item (plans) shows up. */
export const REPLICATE_LEVEL = 2;

export function isSheetTab(value: unknown): value is SheetTab {
  return typeof value === 'string' && (SHEET_TABS as readonly string[]).includes(value);
}

/** Does the character cast, or have spell-like things (feat spells, plans, pact slots)? */
export function hasSpellsTab(sheet: TabInput, featSpells: number): boolean {
  const sc = sheet.spellcasting;
  const artificer = sheet.classes.find((c) => c.id === 'artificer')?.level ?? 0;
  return (
    sc.classes.length > 0 ||
    !!sc.pact ||
    sc.slots.some((n) => n > 0) ||
    featSpells > 0 ||
    artificer >= REPLICATE_LEVEL
  );
}

/** The tabs this character has, in order. Summary, Features, Equipment and Notes always show. */
export function visibleTabs(sheet: TabInput, ctx: TabContext): SheetTab[] {
  return SHEET_TABS.filter((tab) => {
    if (tab === 'conjuros') return hasSpellsTab(sheet, ctx.featSpells);
    if (tab === 'invocaciones')
      return ctx.summonSources > 0 || (ctx.summoned ?? 0) > 0 || !!ctx.hasCannon;
    return true;
  });
}

/** The tab to show for what the URL (or the memory) asked: the default if it doesn't exist here. */
export function resolveTab(
  requested: string | null | undefined,
  visible: readonly SheetTab[],
): SheetTab {
  return isSheetTab(requested) && visible.includes(requested) ? requested : DEFAULT_TAB;
}

/** The route of a tab (always explicit: the bare character URL only redirects to one). */
export function tabLink(id: string, tab: SheetTab): string[] {
  return ['/characters', id, tab];
}

/** The tab segment of a sheet URL ("/characters/x/conjuros?y" → "conjuros"), or null. */
export function tabFromUrl(url: string, id: string): string | null {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== 'characters' || parts[1] !== id) return null;
  return parts[2] ?? null;
}

// -- the last tab used, per character ------------------------------------------------------

export const LAST_TAB_PREFIX = 'dnd-helper.sheet.tab.';
type TabStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readLastTab(storage: TabStorage | null, id: string): SheetTab | null {
  try {
    const value = storage?.getItem(LAST_TAB_PREFIX + id);
    return isSheetTab(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastTab(storage: TabStorage | null, id: string, tab: SheetTab): void {
  try {
    storage?.setItem(LAST_TAB_PREFIX + id, tab);
  } catch {
    // storage full or blocked: the memory is only a convenience
  }
}
