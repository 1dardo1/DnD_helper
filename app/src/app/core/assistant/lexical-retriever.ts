import { Bm25Index, Bm25Options, DEFAULT_BM25 } from './bm25';
import { CorpusDoc, MAX_INDEXED_CHARS } from './entry-document';
import { MAX_CONTEXT_CHARS } from './assistant.config';
import { bestPassage, snippetOf } from './passage';
import { Lang, RetrievalHit, Retriever } from './ports';
import { tokenise } from './tokenizer';

export interface LexicalOptions {
  bm25?: Bm25Options;
  /**
   * Extra score for an entry whose whole name appears in the question, per unit of the name's
   * summed idf (so a rare multi-word name like "Bola de fuego" weighs more than "Magia"). 0 = off.
   */
  nameBonus?: number;
}

export const DEFAULT_NAME_BONUS = 0.5;

interface Built {
  docs: CorpusDoc[];
  index: Bm25Index;
  names: string[][][];
}

/**
 * Lexical retriever: BM25F over the compendium (one document per entry; fields: name, head,
 * body), tokenised for Spanish or English. The index of a language is built on first use.
 * It knows nothing about where the entries come from (`load`), so tests feed it the real files.
 */
export class LexicalRetriever implements Retriever {
  private readonly built = new Map<Lang, Promise<Built>>();

  constructor(
    private readonly load: (lang: Lang) => Promise<CorpusDoc[]>,
    private readonly options: LexicalOptions = {},
  ) {}

  /** Forget the indexes (the compendium or the language changed). */
  reset(): void {
    this.built.clear();
  }

  private build(lang: Lang): Promise<Built> {
    let p = this.built.get(lang);
    if (!p) {
      p = this.load(lang).then((docs) => {
        const index = new Bm25Index(
          docs.map((d) => ({
            title: tokenise(d.title, lang),
            head: tokenise(`${d.head} ${d.facts}`, lang),
            body: tokenise(d.text.slice(0, MAX_INDEXED_CHARS), lang),
          })),
          this.options.bm25 ?? DEFAULT_BM25,
        );
        const names = docs.map((d) =>
          d.names.map((n) => tokenise(n, lang)).filter((t) => t.length),
        );
        return { docs, index, names };
      });
      p.catch(() => this.built.delete(lang));
      this.built.set(lang, p);
    }
    return p;
  }

  async search(query: string, lang: Lang, k: number): Promise<RetrievalHit[]> {
    const terms = tokenise(query, lang);
    if (!terms.length || k <= 0) return [];
    const { docs, index, names } = await this.build(lang);
    const bonus = this.options.nameBonus ?? DEFAULT_NAME_BONUS;
    const asked = new Set(terms);

    let scored = index.search(terms);
    if (bonus > 0) {
      scored = scored
        .map(({ doc, score }) => {
          let best = 0;
          for (const tokens of names[doc]) {
            if (tokens.every((t) => asked.has(t))) {
              best = Math.max(
                best,
                tokens.reduce((s, t) => s + index.idfOf(t), 0),
              );
            }
          }
          return { doc, score: score + bonus * best };
        })
        .sort((a, b) => b.score - a.score);
    }

    return scored.slice(0, k).map(({ doc, score }) => {
      const d = docs[doc];
      const body = d.text || d.facts;
      // the facts always go; the text gives the passage that fits in what's left
      const room = MAX_CONTEXT_CHARS - d.facts.length - 2;
      const passage = d.text ? bestPassage(d.text, terms, lang, Math.max(200, room)) : '';
      const text = [d.facts, passage].filter(Boolean).join('\n\n').slice(0, MAX_CONTEXT_CHARS);
      return {
        id: d.id,
        type: d.type,
        title: d.name,
        score,
        snippet: snippetOf(body, terms, lang),
        text,
      };
    });
  }
}
