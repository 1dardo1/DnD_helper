/**
 * The app's own navigation history: the pages visited in this tab, in the order the browser keeps
 * them, so a "back" link can tell whether the page before is one of ours (and then go there,
 * keeping its filters, step and scroll) or the visit began here (and then use its default link).
 * Pure helpers: the router events are fed in by `NavHistory`.
 */
export interface NavEntry {
  /** Final URL of the page (after redirects), with query params. */
  url: string;
  /** The router's navigation id stored in the browser's history entry (to recognise it on back). */
  id: number;
}

export interface NavStack {
  entries: NavEntry[];
  /** The page that is open. */
  index: number;
}

export const EMPTY_STACK: NavStack = { entries: [], index: -1 };

const MAX_ENTRIES = 200;

/** A page was opened: after the current one, dropping what was "forward"; or in its place. */
export function visit(stack: NavStack, entry: NavEntry, replace: boolean): NavStack {
  if (stack.index < 0) return { entries: [entry], index: 0 };
  if (replace) {
    const entries = stack.entries.slice();
    entries[stack.index] = entry;
    return { entries, index: stack.index };
  }
  let entries = [...stack.entries.slice(0, stack.index + 1), entry];
  if (entries.length > MAX_ENTRIES) entries = entries.slice(entries.length - MAX_ENTRIES);
  return { entries, index: entries.length - 1 };
}

/**
 * The browser went to a history entry (back, forward, hardware back button). If it's one we know,
 * move there; if not (the page was reloaded and the earlier entries are unknown), start over.
 */
export function popTo(stack: NavStack, entry: NavEntry): NavStack {
  const i = stack.entries.findIndex((e) => e.id === entry.id && e.url === entry.url);
  if (i >= 0) return { entries: stack.entries, index: i };
  return { entries: [entry], index: 0 };
}

/** The page before the current one, if it is one of ours. */
export function previousEntry(stack: NavStack): NavEntry | null {
  return stack.index > 0 ? stack.entries[stack.index - 1] : null;
}

export interface BackLabel {
  /** i18n key naming the page. */
  key: string;
}

export interface BackTarget {
  /** 'history': go back in the browser history; 'fallback': follow the page's default link. */
  kind: 'history' | 'fallback';
  /** What the previous page is (history only). */
  label: BackLabel | null;
}

/** Where a "back" link goes: the previous page of the app, else the page's default link. */
export function resolveBack(stack: NavStack): BackTarget {
  const prev = previousEntry(stack);
  if (!prev) return { kind: 'fallback', label: null };
  return { kind: 'history', label: describeUrl(prev.url) };
}

export function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}

/** A short name for a page, to write "← Subir de nivel" instead of a generic "← Volver". */
export function describeUrl(url: string): BackLabel {
  const parts = pathOf(url)
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  const [a, b, c, d] = parts;
  if (a === 'compendium') {
    if (!b) return { key: 'compendium.title' };
    if (b === 'search') return { key: 'back.search' };
    if (b === 'crafting') return { key: 'crafting.title' };
    if (c) return { key: 'common.back' }; // another entry: no name at hand
    return { key: `type.${b}` };
  }
  if (a === 'characters') {
    if (!b) return { key: 'characters.title' };
    if (b === 'new') return { key: 'back.creation' };
    if (c === 'edit') return { key: 'back.edit' };
    if (c === 'level-up') return { key: 'back.levelUp' };
    if (c === 'invocaciones' || d === 'invocaciones') return { key: 'back.summons' };
    return { key: 'back.sheet' };
  }
  if (a === 'dm') {
    if (b === 'combat') return { key: 'back.combat' };
    if (b === 'encounters') return { key: c ? 'back.encounter' : 'dm.encounters.title' };
    return { key: 'dm.title' };
  }
  if (a === 'settings') return { key: 'nav.settings' };
  return { key: 'common.back' };
}
