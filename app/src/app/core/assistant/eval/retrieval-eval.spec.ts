import { DEFAULT_BM25 } from '../bm25';
import { LexicalRetriever, LexicalOptions } from '../lexical-retriever';
import questionSet from './questions.json';
import { EVAL_K, EvalQuestion, Metrics, formatTable, rankOf, summarise } from './metrics';
import { realCorpus } from './real-corpus.testing';

/**
 * Retrieval evaluation on the real compendium: the fixed question set (questions.json) is run
 * through the retriever and hit@1, hit@5 and MRR are computed, overall and per language.
 * `npm run eval:assistant` runs only this file and prints the tables; the floors below make a
 * regression fail the build. docs/ASSISTANT-EVAL.md explains the set and the numbers.
 */
const QUESTIONS = questionSet.questions as EvalQuestion[];

/**
 * Floors: a little below what is measured (docs/ASSISTANT-EVAL.md: all 74.0 / 90.0 / 0.820, es
 * 60.0 / 80.0 / 0.699, en 88.0 / 100 / 0.940 for hit@1 / hit@5 / MRR), so only a real drop fails.
 * One question is 2 points overall and 4 per language.
 */
const FLOORS = {
  all: { hit1: 0.7, hit5: 0.86, mrr: 0.78 },
  es: { hit1: 0.56, hit5: 0.76, mrr: 0.65 },
  en: { hit1: 0.84, hit5: 0.96, mrr: 0.9 },
};

/** Straight to the terminal: the test runner swallows console output. */
function print(text: string): void {
  const out = (globalThis as { process?: { stdout?: { write(s: string): void } } }).process?.stdout;
  if (out) out.write(text + '\n');
  else console.log(text);
}

interface Run {
  q: EvalQuestion;
  rank: number | null;
  top: string[];
}

async function run(options: LexicalOptions): Promise<Run[]> {
  const retriever = new LexicalRetriever(realCorpus, options);
  const out: Run[] = [];
  for (const q of QUESTIONS) {
    const hits = await retriever.search(q.question, q.lang, EVAL_K);
    const ids = hits.map((h) => h.id);
    out.push({ q, rank: rankOf(ids, q.expected), top: ids.slice(0, 3) });
  }
  return out;
}

const by = (runs: Run[], pick: (r: Run) => boolean): Metrics =>
  summarise(runs.filter(pick).map((r) => r.rank));

const flat: LexicalOptions = {
  nameBonus: 0,
  bm25: {
    k1: DEFAULT_BM25.k1,
    fields: {
      title: { weight: 1, b: 0.75 },
      head: { weight: 1, b: 0.75 },
      body: { weight: 1, b: 0.75 },
    },
  },
};

describe('retrieval evaluation on the real compendium', () => {
  it('has at least 40 questions, half of them in each language', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(40);
    const es = QUESTIONS.filter((q) => q.lang === 'es').length;
    expect(es).toBe(QUESTIONS.length - es);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });

  it('every expected entry exists in the compendium', async () => {
    const ids = new Set((await realCorpus('en')).map((d) => d.id));
    for (const q of QUESTIONS)
      for (const e of q.expected) expect(ids.has(e), `${q.id}: ${e}`).toBe(true);
  });

  it('meets the retrieval floors', async () => {
    const runs = await run({});
    const lines: string[] = [];

    const rows = [
      { name: 'all', m: by(runs, () => true) },
      { name: 'es', m: by(runs, (r) => r.q.lang === 'es') },
      { name: 'en', m: by(runs, (r) => r.q.lang === 'en') },
      ...(['direct', 'paraphrase', 'facts'] as const).map((k) => ({
        name: `kind=${k}`,
        m: by(runs, (r) => r.q.kind === k),
      })),
    ];
    lines.push('Retrieval on the real compendium (k=' + EVAL_K + '):', formatTable(rows));

    const types = [...new Set(QUESTIONS.map((q) => q.expected[0].split(':')[0]))];
    lines.push(
      '',
      'By type of the expected entry:',
      formatTable(
        types.map((t) => ({ name: t, m: by(runs, (r) => r.q.expected[0].startsWith(t + ':')) })),
      ),
    );

    const ablation = [
      { name: 'BM25 flat (all fields weight 1)', runs: await run(flat) },
      { name: 'BM25F (name 5, head 2, body 1)', runs: await run({ nameBonus: 0 }) },
      { name: 'BM25F + name-in-question bonus', runs },
    ];
    lines.push(
      '',
      'Ablation (all questions):',
      formatTable(ablation.map((a) => ({ name: a.name, m: by(a.runs, () => true) }))),
    );

    const misses = runs
      .filter((r) => r.rank === null || r.rank > 1)
      .sort((a, b) => (b.rank ?? 99) - (a.rank ?? 99));
    lines.push(
      '',
      'Not first (rank; expected; top 3):',
      ...misses.map(
        (r) =>
          `  ${r.q.id} [${r.q.lang}/${r.q.kind}] rank ${r.rank ?? `>${EVAL_K}`}  ${r.q.question}\n` +
          `      expected ${r.q.expected.join(' | ')}   got ${r.top.join(', ')}`,
      ),
    );
    print('\n' + lines.join('\n') + '\n');

    for (const [name, floor] of Object.entries(FLOORS)) {
      const m = by(runs, (r) => name === 'all' || r.q.lang === name);
      expect(m.hit1, `${name} hit@1`).toBeGreaterThanOrEqual(floor.hit1);
      expect(m.hit5, `${name} hit@5`).toBeGreaterThanOrEqual(floor.hit5);
      expect(m.mrr, `${name} MRR`).toBeGreaterThanOrEqual(floor.mrr);
    }
  });
});
