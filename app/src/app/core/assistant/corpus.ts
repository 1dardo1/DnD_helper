import { ENTRY_TYPES, Entry, EntryType } from '../models/compendium';
import { CorpusDoc, toCorpusDoc } from './entry-document';
import { Lang } from './ports';

export type EntriesByType = Partial<Record<EntryType, readonly Entry[]>>;

/**
 * Every entry of the compendium as a retrievable document, in the language asked for: the
 * translated entries (data/es) when they exist, the English ones otherwise. The user's own
 * homebrew (`custom`) is left out: the assistant answers from the official compendium only.
 */
export function buildCorpus(
  lang: Lang,
  english: EntriesByType,
  translated: EntriesByType = {},
): CorpusDoc[] {
  const classes = (lang === 'es' ? translated.class : undefined) ?? english.class ?? [];
  const classNames = new Map(classes.map((c) => [c.id, c.name]));
  const docs: CorpusDoc[] = [];
  for (const type of ENTRY_TYPES) {
    const en = (english[type] ?? []).filter((e) => !e.custom);
    const tr = lang === 'es' ? new Map((translated[type] ?? []).map((e) => [e.id, e])) : null;
    for (const e of en) {
      const shown = tr?.get(e.id) ?? e;
      docs.push(toCorpusDoc(shown, { lang, classNames, english: shown === e ? undefined : e }));
    }
  }
  return docs;
}
