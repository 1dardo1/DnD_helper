import { Entry } from '../../core/models/compendium';

/** Lower case, without accents or extra spaces: "Bola de Fuego " → "bola de fuego". */
export function normalise(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** What an entry can be found by, already normalised. */
export interface SearchDoc<T extends Entry = Entry> {
  entry: T;
  /** Every name it goes by (English and translated). */
  names: string[];
  /** Description texts; only searched when asked to. */
  text?: string;
}

export interface SearchHit<T extends Entry = Entry> {
  entry: T;
  /** Lower is better: 0 exact name, 1 name starts with it, 2 a word starts with it, 3 inside the name, 4 only in the text. */
  rank: number;
}

/** How well a normalised name matches a normalised query; null when it doesn't. Every word must appear. */
export function rankName(name: string, q: string): number | null {
  if (!q) return null;
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(/[\s\-'(/]+/).some((w) => w.startsWith(q))) return 2;
  const words = q.split(' ');
  return words.every((w) => name.includes(w)) ? 3 : null;
}

/**
 * Entries matching the query (raw: normalised here), best first and then by sortName.
 * withText also matches by description, below every name match.
 */
export function searchDocs<T extends Entry>(
  docs: SearchDoc<T>[],
  query: string,
  withText: boolean,
  sortName: (e: T) => string,
): SearchHit<T>[] {
  const q = normalise(query);
  if (!q) return [];
  const words = q.split(' ');
  const hits: SearchHit<T>[] = [];
  for (const doc of docs) {
    let rank: number | null = null;
    for (const name of doc.names) {
      const r = rankName(name, q);
      if (r !== null && (rank === null || r < rank)) rank = r;
    }
    if (rank === null && withText && doc.text && words.every((w) => doc.text!.includes(w))) {
      rank = 4;
    }
    if (rank !== null) hits.push({ entry: doc.entry, rank });
  }
  return hits.sort((a, b) => a.rank - b.rank || sortName(a.entry).localeCompare(sortName(b.entry)));
}
