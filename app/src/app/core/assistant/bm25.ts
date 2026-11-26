/** How a field of a document weighs in the score (BM25F). */
export interface FieldConfig {
  /** Boost: a term in this field counts `weight` times as much as in a weight-1 field. */
  weight: number;
  /** Length normalisation of this field, 0 (none) .. 1 (full). */
  b: number;
}

export interface Bm25Options {
  /** Term-frequency saturation. */
  k1: number;
  fields: Record<string, FieldConfig>;
}

/** A document as its tokens per field. */
export type Bm25Doc = Record<string, string[]>;

export interface Bm25Score {
  doc: number;
  score: number;
}

export const DEFAULT_BM25: Bm25Options = {
  k1: 1.2,
  fields: {
    title: { weight: 5, b: 0.3 },
    head: { weight: 2, b: 0.5 },
    body: { weight: 1, b: 0.75 },
  },
};

/**
 * BM25F (Robertson & Zaragoza): the term frequencies of a document's fields are combined, each
 * boosted and length-normalised on its own, before the usual BM25 saturation. Pure and
 * dependency-free; the inverted index is built once with the normalised frequencies in it.
 */
export class Bm25Index {
  private readonly postings = new Map<string, { doc: number; tf: number }[]>();
  private readonly idf = new Map<string, number>();
  readonly size: number;

  constructor(
    docs: Bm25Doc[],
    private readonly options: Bm25Options = DEFAULT_BM25,
  ) {
    this.size = docs.length;
    const names = Object.keys(options.fields);
    const avg: Record<string, number> = {};
    for (const f of names) {
      avg[f] = docs.reduce((s, d) => s + (d[f]?.length ?? 0), 0) / Math.max(1, docs.length) || 1;
    }
    docs.forEach((d, doc) => {
      const weighted = new Map<string, number>();
      for (const f of names) {
        const tokens = d[f];
        if (!tokens?.length) continue;
        const { weight, b } = options.fields[f];
        const norm = 1 - b + (b * tokens.length) / avg[f];
        const counts = new Map<string, number>();
        for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
        for (const [t, c] of counts) weighted.set(t, (weighted.get(t) ?? 0) + (weight * c) / norm);
      }
      for (const [t, tf] of weighted) {
        let list = this.postings.get(t);
        if (!list) this.postings.set(t, (list = []));
        list.push({ doc, tf });
      }
    });
    for (const [t, list] of this.postings) {
      const n = list.length;
      this.idf.set(t, Math.log(1 + (this.size - n + 0.5) / (n + 0.5)));
    }
  }

  /** Inverse document frequency of a term (0 when it isn't in any document). */
  idfOf(term: string): number {
    return this.idf.get(term) ?? 0;
  }

  /** Documents containing at least one query term, best first. */
  search(terms: string[]): Bm25Score[] {
    const k1 = this.options.k1;
    const scores = new Map<number, number>();
    for (const t of new Set(terms)) {
      const list = this.postings.get(t);
      if (!list) continue;
      const idf = this.idf.get(t)!;
      for (const { doc, tf } of list) {
        scores.set(doc, (scores.get(doc) ?? 0) + (idf * tf) / (k1 + tf));
      }
    }
    return [...scores].map(([doc, score]) => ({ doc, score })).sort((a, b) => b.score - a.score);
  }
}
