import { Lang } from '../ports';

/** One question of the fixed evaluation set (questions.json). */
export interface EvalQuestion {
  id: string;
  lang: Lang;
  /** direct: the name is in the question; paraphrase: it isn't; facts: answer in structured data. */
  kind: 'direct' | 'paraphrase' | 'facts';
  question: string;
  /** Any of these entries ("<type>:<id>") answers the question. */
  expected: string[];
}

/** How many hits are retrieved per question; a miss beyond this scores 0 in MRR. */
export const EVAL_K = 10;

/** 1-based position of the best-placed expected entry among the retrieved ids; null = not found. */
export function rankOf(retrieved: string[], expected: string[]): number | null {
  const i = retrieved.findIndex((id) => expected.includes(id));
  return i < 0 ? null : i + 1;
}

export interface Metrics {
  n: number;
  /** Share of questions whose answer entry is the first hit. */
  hit1: number;
  /** ...is among the first five hits (what the model gets as context). */
  hit5: number;
  /** Mean reciprocal rank over the first EVAL_K hits. */
  mrr: number;
}

export function summarise(ranks: (number | null)[]): Metrics {
  const n = ranks.length;
  const share = (f: (r: number) => boolean) => ranks.filter((r) => r !== null && f(r)).length / n;
  return {
    n,
    hit1: share((r) => r <= 1),
    hit5: share((r) => r <= 5),
    mrr: ranks.reduce<number>((s, r) => s + (r === null ? 0 : 1 / r), 0) / n,
  };
}

const pct = (x: number) => (x * 100).toFixed(1).padStart(5) + '%';

/** A plain-text table of named rows of metrics. */
export function formatTable(rows: { name: string; m: Metrics }[]): string {
  const width = Math.max(...rows.map((r) => r.name.length), 8);
  const head = `${'set'.padEnd(width)}   n   hit@1   hit@5    MRR`;
  const lines = rows.map(
    ({ name, m }) =>
      `${name.padEnd(width)} ${String(m.n).padStart(3)} ${pct(m.hit1)} ${pct(m.hit5)}  ${m.mrr.toFixed(3)}`,
  );
  return [head, '-'.repeat(head.length), ...lines].join('\n');
}
